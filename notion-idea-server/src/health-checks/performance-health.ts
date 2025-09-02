import { NotionService } from '../notion-service.js';

export interface PerformanceHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  service: string;
  timestamp: string;
  uptime: number;
  checks: {
    notion_api: HealthCheck;
    database_query: HealthCheck;
    environment: HealthCheck;
  };
  performance: {
    response_times: {
      p50: number;
      p95: number;
      avg: number;
    };
    error_rate: number;
    requests_per_minute: number;
  };
}

interface HealthCheck {
  status: 'pass' | 'fail' | 'warn';
  response_time_ms: number;
  message: string;
}

export class PerformanceHealthCheck {
  private startTime = Date.now();
  private requestTimes: { timestamp: number; responseTime: number; isError: boolean }[] = [];
  private lastHealthCheck = 0;
  private cachedHealth: PerformanceHealthStatus | null = null;

  constructor(private notionService: NotionService, private cacheIntervalMs = 30000) {}

  recordRequest(responseTime: number, isError: boolean = false) {
    const now = Date.now();
    this.requestTimes.push({ timestamp: now, responseTime, isError });
    
    // Clean old records (keep last hour)
    const oneHourAgo = now - (60 * 60 * 1000);
    this.requestTimes = this.requestTimes.filter(r => r.timestamp > oneHourAgo);
  }

  async getHealth(forceRefresh = false): Promise<PerformanceHealthStatus> {
    const now = Date.now();
    
    // Return cached result if recent enough
    if (!forceRefresh && 
        this.cachedHealth && 
        (now - this.lastHealthCheck) < this.cacheIntervalMs) {
      return this.cachedHealth;
    }

    this.cachedHealth = await this.performHealthCheck();
    this.lastHealthCheck = now;
    return this.cachedHealth;
  }

  private async performHealthCheck(): Promise<PerformanceHealthStatus> {
    const [notionCheck, dbCheck, envCheck] = await Promise.allSettled([
      this.checkNotionAPI(),
      this.checkDatabaseQuery(),
      Promise.resolve(this.checkEnvironment())
    ]);

    const checks = {
      notion_api: this.getCheckResult(notionCheck),
      database_query: this.getCheckResult(dbCheck),
      environment: this.getCheckResult(envCheck)
    };

    // Calculate overall status
    const failCount = Object.values(checks).filter(c => c.status === 'fail').length;
    const warnCount = Object.values(checks).filter(c => c.status === 'warn').length;
    
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (failCount > 0) {
      status = failCount >= 2 ? 'unhealthy' : 'degraded';
    } else if (warnCount > 0) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }

    return {
      status,
      service: 'notion-idea-server-http',
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      checks,
      performance: this.calculatePerformanceMetrics()
    };
  }

  private getCheckResult(settledResult: PromiseSettledResult<HealthCheck>): HealthCheck {
    if (settledResult.status === 'fulfilled') {
      return settledResult.value;
    } else {
      return {
        status: 'fail',
        response_time_ms: 0,
        message: `Health check failed: ${settledResult.reason?.message || 'Unknown error'}`
      };
    }
  }

  private async checkNotionAPI(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      const connected = await Promise.race([
        this.notionService.testConnection(),
        new Promise<boolean>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 5000)
        )
      ]);
      
      const responseTime = Date.now() - start;
      
      return {
        status: connected ? (responseTime > 2000 ? 'warn' : 'pass') : 'fail',
        response_time_ms: responseTime,
        message: connected ? 
          (responseTime > 2000 ? 'Notion API slow' : 'Notion API responsive') :
          'Notion API unreachable'
      };
    } catch (error) {
      const responseTime = Date.now() - start;
      return {
        status: 'fail',
        response_time_ms: responseTime,
        message: (error instanceof Error && error.message === 'Timeout') ? 'Notion API timeout' : 'Notion API error'
      };
    }
  }

  private async checkDatabaseQuery(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      await Promise.race([
        this.notionService.getIdeas(1),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 3000)
        )
      ]);
      
      const responseTime = Date.now() - start;
      
      return {
        status: responseTime > 1500 ? 'warn' : 'pass',
        response_time_ms: responseTime,
        message: responseTime > 1500 ? 'Database queries slow' : 'Database responsive'
      };
    } catch (error) {
      const responseTime = Date.now() - start;
      return {
        status: 'fail',
        response_time_ms: responseTime,
        message: (error instanceof Error && error.message === 'Timeout') ? 'Database query timeout' : 'Database query failed'
      };
    }
  }

  private checkEnvironment(): HealthCheck {
    const requiredVars = ['NOTION_API_TOKEN', 'NOTION_DATABASE_ID'];
    const missing = requiredVars.filter(v => !process.env[v]);
    
    return {
      status: missing.length === 0 ? 'pass' : 'fail',
      response_time_ms: 0,
      message: missing.length === 0 ? 'Environment OK' : `Missing: ${missing.join(', ')}`
    };
  }

  private calculatePerformanceMetrics() {
    const now = Date.now();
    const oneMinuteAgo = now - (60 * 1000);
    const recentRequests = this.requestTimes.filter(r => r.timestamp > oneMinuteAgo);
    
    const responseTimes = this.requestTimes.map(r => r.responseTime).sort((a, b) => a - b);
    const errors = this.requestTimes.filter(r => r.isError).length;
    
    return {
      response_times: {
        p50: this.getPercentile(responseTimes, 0.5),
        p95: this.getPercentile(responseTimes, 0.95),
        avg: responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0
      },
      error_rate: this.requestTimes.length > 0 ? (errors / this.requestTimes.length) * 100 : 0,
      requests_per_minute: recentRequests.length
    };
  }

  private getPercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil(sortedArray.length * percentile) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
  }
}

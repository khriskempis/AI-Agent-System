import { NotionService } from '../notion-service.js';

export interface ComprehensiveHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  service: string;
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    notion_connectivity: CheckResult;
    database_access: CheckResult;
    database_schema: CheckResult;
    environment: CheckResult;
    memory: CheckResult;
    response_time: CheckResult;
  };
  metrics: {
    total_requests: number;
    error_rate: number;
    avg_response_time: number;
  };
}

interface CheckResult {
  status: 'pass' | 'fail' | 'warn';
  message: string;
  duration_ms?: number;
  last_checked: string;
}

export class ComprehensiveHealthCheck {
  private startTime = Date.now();
  private requestCount = 0;
  private errorCount = 0;
  private responseTimes: number[] = [];

  constructor(private notionService: NotionService) {}

  recordRequest(responseTime: number, isError: boolean = false) {
    this.requestCount++;
    if (isError) this.errorCount++;
    this.responseTimes.push(responseTime);
    
    // Keep only last 100 response times for memory efficiency
    if (this.responseTimes.length > 100) {
      this.responseTimes.shift();
    }
  }

  async checkHealth(): Promise<ComprehensiveHealthStatus> {
    const startTime = Date.now();
    const checks = {
      notion_connectivity: await this.checkNotionConnectivity(),
      database_access: await this.checkDatabaseAccess(),
      database_schema: await this.checkDatabaseSchema(),
      environment: this.checkEnvironment(),
      memory: this.checkMemoryUsage(),
      response_time: this.checkResponseTime()
    };

    // Calculate overall status
    const failed = Object.values(checks).filter(c => c.status === 'fail').length;
    const warned = Object.values(checks).filter(c => c.status === 'warn').length;
    
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (failed > 0) {
      status = failed >= 2 ? 'unhealthy' : 'degraded';
    } else if (warned > 1) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }

    return {
      status,
      service: 'notion-idea-server-http',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: Date.now() - this.startTime,
      checks,
      metrics: {
        total_requests: this.requestCount,
        error_rate: this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0,
        avg_response_time: this.responseTimes.length > 0 
          ? this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length 
          : 0
      }
    };
  }

  private async checkNotionConnectivity(): Promise<CheckResult> {
    const start = Date.now();
    try {
      const connected = await this.notionService.testConnection();
      const duration = Date.now() - start;
      
      return {
        status: connected ? 'pass' : 'fail',
        message: connected ? 'Notion API is accessible' : 'Cannot connect to Notion API',
        duration_ms: duration,
        last_checked: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'fail',
        message: `Notion connectivity failed: ${error instanceof Error ? error.message : String(error)}`,
        duration_ms: Date.now() - start,
        last_checked: new Date().toISOString()
      };
    }
  }

  private async checkDatabaseAccess(): Promise<CheckResult> {
    const start = Date.now();
    try {
      // Try to query one item from the database
      await this.notionService.getIdeas(1);
      const duration = Date.now() - start;
      
      return {
        status: duration > 5000 ? 'warn' : 'pass',
        message: duration > 5000 ? 'Database access is slow' : 'Database access is normal',
        duration_ms: duration,
        last_checked: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'fail',
        message: `Database access failed: ${error instanceof Error ? error.message : String(error)}`,
        duration_ms: Date.now() - start,
        last_checked: new Date().toISOString()
      };
    }
  }

  private async checkDatabaseSchema(): Promise<CheckResult> {
    const start = Date.now();
    try {
      const schema = await this.notionService.getDatabaseSchema();
      const requiredProps = ['Name', 'Direct Prompt', 'Status', 'Tags'];
      const missingProps = requiredProps.filter(prop => !schema.properties.includes(prop));
      
      const duration = Date.now() - start;
      
      return {
        status: missingProps.length === 0 ? 'pass' : 'warn',
        message: missingProps.length === 0 
          ? 'All required database properties present'
          : `Missing properties: ${missingProps.join(', ')}`,
        duration_ms: duration,
        last_checked: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'fail',
        message: `Schema validation failed: ${error instanceof Error ? error.message : String(error)}`,
        duration_ms: Date.now() - start,
        last_checked: new Date().toISOString()
      };
    }
  }

  private checkEnvironment(): CheckResult {
    const requiredEnvVars = ['NOTION_API_TOKEN', 'NOTION_DATABASE_ID'];
    const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
    
    return {
      status: missing.length === 0 ? 'pass' : 'fail',
      message: missing.length === 0 
        ? 'All required environment variables present'
        : `Missing: ${missing.join(', ')}`,
      last_checked: new Date().toISOString()
    };
  }

  private checkMemoryUsage(): CheckResult {
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
    
    let status: 'pass' | 'warn' | 'fail' = 'pass';
    let message = `Memory usage: ${heapUsedMB.toFixed(1)}MB / ${heapTotalMB.toFixed(1)}MB`;
    
    if (heapUsedMB > 500) {
      status = 'fail';
      message += ' (Critical: >500MB)';
    } else if (heapUsedMB > 250) {
      status = 'warn';
      message += ' (Warning: >250MB)';
    }
    
    return {
      status,
      message,
      last_checked: new Date().toISOString()
    };
  }

  private checkResponseTime(): CheckResult {
    const avgTime = this.responseTimes.length > 0 
      ? this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length 
      : 0;
    
    let status: 'pass' | 'warn' | 'fail' = 'pass';
    let message = `Average response time: ${avgTime.toFixed(0)}ms`;
    
    if (avgTime > 2000) {
      status = 'fail';
      message += ' (Critical: >2s)';
    } else if (avgTime > 1000) {
      status = 'warn';  
      message += ' (Warning: >1s)';
    }
    
    return {
      status,
      message,
      last_checked: new Date().toISOString()
    };
  }
}

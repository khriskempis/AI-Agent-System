import { NotionService } from '../notion-service.js';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  service: string;
  timestamp: string;
  checks: {
    notion: 'pass' | 'fail';
    environment: 'pass' | 'fail';
  };
  uptime: number;
}

export class BasicHealthCheck {
  private startTime = Date.now();
  
  constructor(private notionService: NotionService) {}

  async checkHealth(): Promise<HealthStatus> {
    const checks = {
      notion: 'fail' as 'pass' | 'fail',
      environment: 'fail' as 'pass' | 'fail'
    };

    // Check Notion connectivity
    try {
      const connected = await this.notionService.testConnection();
      checks.notion = connected ? 'pass' : 'fail';
    } catch (error) {
      checks.notion = 'fail';
    }

    // Check environment variables
    const hasToken = !!process.env.NOTION_API_TOKEN;
    const hasDbId = !!process.env.NOTION_DATABASE_ID;
    checks.environment = (hasToken && hasDbId) ? 'pass' : 'fail';

    // Determine overall status
    const failedChecks = Object.values(checks).filter(c => c === 'fail').length;
    let status: 'healthy' | 'degraded' | 'unhealthy';
    
    if (failedChecks === 0) {
      status = 'healthy';
    } else if (failedChecks === 1) {
      status = 'degraded';  
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      service: 'notion-idea-server-http',
      timestamp: new Date().toISOString(),
      checks,
      uptime: Date.now() - this.startTime
    };
  }
}

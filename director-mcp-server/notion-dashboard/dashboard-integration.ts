/**
 * Notion Dashboard Integration
 * Connects Director MCP Server with Notion databases for UI/monitoring
 */

import { Client } from '@notionhq/client';
import { getSharedServices } from '../src/shared-services.js';
import { logger } from '../src/utils/logger.js';

interface NotionDashboardConfig {
  notion_token: string;
  workflow_executions_db: string;
  agent_status_db: string;
  workflow_results_db: string;
}

class NotionDashboard {
  private notion: Client;
  private config: NotionDashboardConfig;

  constructor(config: NotionDashboardConfig) {
    this.config = config;
    this.notion = new Client({ auth: config.notion_token });
  }

  /**
   * Log workflow execution to Notion
   */
  async logWorkflowExecution(data: {
    workflow_name: string;
    workflow_type: string;
    target_agent: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    context_id: string;
    llm_provider?: string;
    configuration?: any;
    priority?: 'high' | 'medium' | 'low';
    triggered_by?: 'manual' | 'scheduled' | 'api' | 'webhook';
  }) {
    try {
      const page = await this.notion.pages.create({
        parent: { database_id: this.config.workflow_executions_db },
        properties: {
          'Workflow Name': {
            title: [{ text: { content: data.workflow_name } }]
          },
          'Status': {
            select: { name: this.mapStatus(data.status) }
          },
          'Workflow Type': {
            select: { name: data.workflow_type }
          },
          'Target Agent': {
            select: { name: data.target_agent }
          },
          'Started': {
            date: { start: new Date().toISOString() }
          },
          'Context ID': {
            rich_text: [{ text: { content: data.context_id } }]
          },
          'LLM Provider': data.llm_provider ? {
            select: { name: data.llm_provider }
          } : undefined,
          'Configuration': data.configuration ? {
            rich_text: [{ text: { content: JSON.stringify(data.configuration, null, 2) } }]
          } : undefined,
          'Priority': data.priority ? {
            select: { name: this.mapPriority(data.priority) }
          } : undefined,
          'Triggered By': data.triggered_by ? {
            select: { name: this.capitalizeFirst(data.triggered_by) }
          } : undefined
        }
      });

      logger.info('Workflow execution logged to Notion', {
        page_id: page.id,
        workflow_name: data.workflow_name
      });

      return page.id;
    } catch (error) {
      logger.error('Failed to log workflow execution to Notion', { error });
      throw error;
    }
  }

  /**
   * Update workflow execution status
   */
  async updateWorkflowStatus(pageId: string, updates: {
    status?: 'pending' | 'running' | 'completed' | 'failed';
    duration_ms?: number;
    ideas_processed?: number;
    operations_completed?: number;
    error_message?: string;
    results_summary?: string;
  }) {
    try {
      const properties: any = {};

      if (updates.status) {
        properties['Status'] = { select: { name: this.mapStatus(updates.status) } };
      }

      if (updates.status === 'completed' || updates.status === 'failed') {
        properties['Completed'] = { date: { start: new Date().toISOString() } };
      }

      if (updates.duration_ms) {
        properties['Duration (ms)'] = { number: updates.duration_ms };
      }

      if (updates.ideas_processed) {
        properties['Ideas Processed'] = { number: updates.ideas_processed };
      }

      if (updates.operations_completed) {
        properties['Operations Completed'] = { number: updates.operations_completed };
      }

      if (updates.error_message) {
        properties['Error Message'] = {
          rich_text: [{ text: { content: updates.error_message } }]
        };
      }

      if (updates.results_summary) {
        properties['Results Summary'] = {
          rich_text: [{ text: { content: updates.results_summary } }]
        };
      }

      await this.notion.pages.update({
        page_id: pageId,
        properties
      });

      logger.info('Workflow status updated in Notion', { page_id: pageId });
    } catch (error) {
      logger.error('Failed to update workflow status in Notion', { error });
    }
  }

  /**
   * Update agent status monitoring
   */
  async updateAgentStatus(agentName: string, data: {
    status: 'healthy' | 'degraded' | 'down' | 'starting' | 'stopped';
    response_time_ms?: number;
    memory_usage_mb?: number;
    active_requests?: number;
    total_requests?: number;
    error_rate?: number;
    version?: string;
    error_details?: string;
    tools_available?: string[];
  }) {
    try {
      // First, try to find existing page for this agent
      const existingPage = await this.findAgentPage(agentName);

      const properties: any = {
        'Agent Name': {
          title: [{ text: { content: agentName } }]
        },
        'Status': {
          select: { name: this.mapAgentStatus(data.status) }
        },
        'Last Health Check': {
          date: { start: new Date().toISOString() }
        }
      };

      if (data.response_time_ms) {
        properties['Response Time (ms)'] = { number: data.response_time_ms };
      }

      if (data.memory_usage_mb) {
        properties['Memory Usage (MB)'] = { number: data.memory_usage_mb };
      }

      if (data.active_requests) {
        properties['Active Requests'] = { number: data.active_requests };
      }

      if (data.total_requests) {
        properties['Total Requests'] = { number: data.total_requests };
      }

      if (data.error_rate) {
        properties['Error Rate (%)'] = { number: data.error_rate / 100 };
      }

      if (data.version) {
        properties['Version'] = {
          rich_text: [{ text: { content: data.version } }]
        };
      }

      if (data.error_details) {
        properties['Error Details'] = {
          rich_text: [{ text: { content: data.error_details } }]
        };
        properties['Last Error'] = {
          date: { start: new Date().toISOString() }
        };
      }

      if (data.tools_available) {
        properties['Tools Available'] = {
          multi_select: data.tools_available.map(tool => ({ name: tool }))
        };
      }

      if (existingPage) {
        await this.notion.pages.update({
          page_id: existingPage,
          properties
        });
      } else {
        await this.notion.pages.create({
          parent: { database_id: this.config.agent_status_db },
          properties: {
            ...properties,
            'Agent Type': {
              select: { name: this.getAgentType(agentName) }
            }
          }
        });
      }

      logger.info('Agent status updated in Notion', { agent: agentName });
    } catch (error) {
      logger.error('Failed to update agent status in Notion', { error });
    }
  }

  /**
   * Log workflow results
   */
  async logWorkflowResults(workflowPageId: string, results: {
    ideas_categorized: number;
    projects_created: number;
    knowledge_entries: number;
    journal_entries: number;
    success_rate: number;
    processing_time: number;
    llm_tokens_used?: number;
    api_calls_made?: number;
    quality_score: 1 | 2 | 3 | 4 | 5;
    raw_results?: any;
    performance_metrics?: any;
  }) {
    try {
      const page = await this.notion.pages.create({
        parent: { database_id: this.config.workflow_results_db },
        properties: {
          'Result ID': {
            title: [{ text: { content: `result_${Date.now()}` } }]
          },
          'Workflow Execution': {
            relation: [{ id: workflowPageId }]
          },
          'Ideas Categorized': {
            number: results.ideas_categorized
          },
          'Projects Created': {
            number: results.projects_created
          },
          'Knowledge Entries': {
            number: results.knowledge_entries
          },
          'Journal Entries': {
            number: results.journal_entries
          },
          'Success Rate': {
            number: results.success_rate / 100
          },
          'Processing Time': {
            number: results.processing_time
          },
          'LLM Tokens Used': results.llm_tokens_used ? {
            number: results.llm_tokens_used
          } : undefined,
          'API Calls Made': results.api_calls_made ? {
            number: results.api_calls_made
          } : undefined,
          'Quality Score': {
            select: { name: this.mapQualityScore(results.quality_score) }
          },
          'Raw Results': results.raw_results ? {
            rich_text: [{ text: { content: JSON.stringify(results.raw_results, null, 2) } }]
          } : undefined,
          'Performance Metrics': results.performance_metrics ? {
            rich_text: [{ text: { content: JSON.stringify(results.performance_metrics, null, 2) } }]
          } : undefined
        }
      });

      logger.info('Workflow results logged to Notion', { page_id: page.id });
      return page.id;
    } catch (error) {
      logger.error('Failed to log workflow results to Notion', { error });
      throw error;
    }
  }

  /**
   * Query workflow executions for dashboard
   */
  async getDashboardData() {
    try {
      const [workflowExecutions, agentStatuses] = await Promise.all([
        this.notion.databases.query({
          database_id: this.config.workflow_executions_db,
          sorts: [
            {
              property: 'Started',
              direction: 'descending'
            }
          ],
          page_size: 10
        }),
        this.notion.databases.query({
          database_id: this.config.agent_status_db
        })
      ]);

      return {
        recent_workflows: workflowExecutions.results,
        agent_statuses: agentStatuses.results,
        summary: {
          total_workflows: workflowExecutions.results.length,
          healthy_agents: agentStatuses.results.filter(
            (agent: any) => agent.properties?.Status?.select?.name === '🟢 Healthy'
          ).length,
          failed_workflows: workflowExecutions.results.filter(
            (workflow: any) => workflow.properties?.Status?.select?.name === '❌ Failed'
          ).length
        }
      };
    } catch (error) {
      logger.error('Failed to get dashboard data from Notion', { error });
      throw error;
    }
  }

  // Helper methods
  private mapStatus(status: string): string {
    const statusMap = {
      'pending': '⏳ Pending',
      'running': '🏃 Running', 
      'completed': '✅ Completed',
      'failed': '❌ Failed',
      'paused': '⏸️ Paused'
    };
    return statusMap[status as keyof typeof statusMap] || status;
  }

  private mapAgentStatus(status: string): string {
    const statusMap = {
      'healthy': '🟢 Healthy',
      'degraded': '🟡 Degraded',
      'down': '🔴 Down',
      'starting': '🔄 Starting',
      'stopped': '⏸️ Stopped'
    };
    return statusMap[status as keyof typeof statusMap] || status;
  }

  private mapPriority(priority: string): string {
    const priorityMap = {
      'high': '🔴 High',
      'medium': '🟡 Medium', 
      'low': '🟢 Low'
    };
    return priorityMap[priority as keyof typeof priorityMap] || priority;
  }

  private mapQualityScore(score: number): string {
    const scoreMap = {
      5: '⭐⭐⭐⭐⭐ Excellent',
      4: '⭐⭐⭐⭐ Good',
      3: '⭐⭐⭐ Fair',
      2: '⭐⭐ Poor',
      1: '⭐ Failed'
    };
    return scoreMap[score as keyof typeof scoreMap] || '⭐ Failed';
  }

  private getAgentType(agentName: string): string {
    if (agentName.includes('director')) return 'director';
    if (agentName.includes('notion')) return 'notion';
    if (agentName.includes('planner')) return 'planner';
    if (agentName.includes('validation')) return 'validation';
    return agentName;
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private async findAgentPage(agentName: string): Promise<string | null> {
    try {
      const response = await this.notion.databases.query({
        database_id: this.config.agent_status_db,
        filter: {
          property: 'Agent Name',
          title: {
            equals: agentName
          }
        }
      });

      return response.results.length > 0 ? response.results[0].id : null;
    } catch (error) {
      return null;
    }
  }
}

export { NotionDashboard, type NotionDashboardConfig };

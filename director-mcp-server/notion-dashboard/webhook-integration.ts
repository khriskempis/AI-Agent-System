/**
 * Notion Webhook Integration
 * Handles bidirectional communication between Notion dashboard and MCP servers
 */

import express from 'express';
import { NotionDashboard } from './dashboard-integration.js';
import { getSharedServices } from '../src/shared-services.js';
import { logger } from '../src/utils/logger.js';
import crypto from 'crypto';

interface WebhookPayload {
  object: 'event';
  event: {
    object: 'database' | 'page';
    type: 'page.created' | 'page.updated' | 'database.updated';
    page?: {
      id: string;
      properties: any;
    };
    database?: {
      id: string;
    };
  };
}

class NotionWebhookHandler {
  private app: express.Application;
  private dashboard: NotionDashboard;
  private webhookSecret: string;

  constructor(dashboard: NotionDashboard, webhookSecret: string) {
    this.dashboard = dashboard;
    this.webhookSecret = webhookSecret;
    this.app = express();
    this.setupWebhooks();
  }

  private setupWebhooks() {
    // Middleware for webhook signature verification
    this.app.use('/webhooks/notion', express.raw({ type: 'application/json' }));
    
    this.app.post('/webhooks/notion', this.verifySignature.bind(this), async (req, res) => {
      try {
        const payload: WebhookPayload = JSON.parse(req.body.toString());
        await this.handleNotionWebhook(payload);
        res.status(200).json({ success: true });
      } catch (error) {
        logger.error('Webhook processing failed', { error });
        res.status(500).json({ error: 'Webhook processing failed' });
      }
    });

    // Manual trigger endpoints (for testing)
    this.app.use(express.json());
    
    this.app.post('/webhooks/trigger-workflow', async (req, res) => {
      try {
        const { workflow_type, target_agent, parameters } = req.body;
        const result = await this.triggerWorkflow(workflow_type, target_agent, parameters);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });
  }

  private verifySignature(req: express.Request, res: express.Response, next: express.NextFunction) {
    if (!this.webhookSecret) {
      return next(); // Skip verification if no secret configured
    }

    const signature = req.headers['notion-signature'] as string;
    if (!signature) {
      return res.status(401).json({ error: 'Missing signature' });
    }

    const computedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(req.body)
      .digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computedSignature))) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    next();
  }

  private async handleNotionWebhook(payload: WebhookPayload) {
    logger.info('Processing Notion webhook', { 
      type: payload.event.type,
      object: payload.event.object 
    });

    switch (payload.event.type) {
      case 'page.created':
        await this.handlePageCreated(payload.event.page!);
        break;
      
      case 'page.updated':  
        await this.handlePageUpdated(payload.event.page!);
        break;
        
      default:
        logger.info('Unhandled webhook type', { type: payload.event.type });
    }
  }

  private async handlePageCreated(page: any) {
    // Check if this is a workflow execution page with "Manual" trigger
    const properties = page.properties;
    const triggeredBy = properties['Triggered By']?.select?.name;
    
    if (triggeredBy === 'Manual') {
      const workflowType = properties['Workflow Type']?.select?.name;
      const targetAgent = properties['Target Agent']?.select?.name;
      const priority = properties['Priority']?.select?.name?.replace(/[🔴🟡🟢] /, '').toLowerCase();

      if (workflowType && targetAgent) {
        logger.info('Manual workflow trigger detected', {
          workflow_type: workflowType,
          target_agent: targetAgent,
          priority
        });

        // Trigger the actual workflow
        await this.triggerWorkflow(workflowType, targetAgent, {
          priority,
          notion_page_id: page.id
        });
      }
    }
  }

  private async handlePageUpdated(page: any) {
    const properties = page.properties;
    const status = properties['Status']?.select?.name;
    
    // Handle status changes that should trigger actions
    if (status === '⏸️ Paused') {
      // Could implement workflow pausing logic here
      logger.info('Workflow paused via Notion', { page_id: page.id });
    } else if (status === '🏃 Running') {
      // Could implement workflow resuming logic here  
      logger.info('Workflow resumed via Notion', { page_id: page.id });
    }
  }

  /**
   * Trigger a workflow from Notion dashboard
   */
  private async triggerWorkflow(workflowType: string, targetAgent: string, parameters: any = {}) {
    try {
      const { templateManager, contextManager, agentCommunicator } = getSharedServices();

      // Update Notion page to show it's running
      if (parameters.notion_page_id) {
        await this.dashboard.updateWorkflowStatus(parameters.notion_page_id, {
          status: 'running'
        });
      }

      // Create workflow context
      const context = contextManager.createWorkflowContext(workflowType, parameters);

      // Create agent instructions  
      const instructions = await templateManager.createAgentInstructions({
        workflow_type: workflowType,
        parameters: { ...parameters, context_id: context.context_id },
        target_agent: targetAgent
      });

      // Execute workflow
      const startTime = Date.now();
      const agentResult = await agentCommunicator.sendInstructionsToAgent(targetAgent, instructions);
      const executionTime = Date.now() - startTime;

      // Update Notion with results
      if (parameters.notion_page_id) {
        await this.dashboard.updateWorkflowStatus(parameters.notion_page_id, {
          status: agentResult.success ? 'completed' : 'failed',
          duration_ms: executionTime,
          ideas_processed: agentResult.data?.results?.ideas_processed?.length || 0,
          operations_completed: agentResult.data?.results?.operations_completed?.length || 0,
          error_message: agentResult.success ? undefined : agentResult.error,
          results_summary: JSON.stringify(agentResult.data?.results?.summary || {}, null, 2)
        });

        // Log detailed results if successful
        if (agentResult.success && agentResult.data?.results) {
          await this.dashboard.logWorkflowResults(parameters.notion_page_id, {
            ideas_categorized: agentResult.data.results.ideas_processed?.length || 0,
            projects_created: agentResult.data.results.summary?.projects || 0,
            knowledge_entries: agentResult.data.results.summary?.knowledge || 0,
            journal_entries: agentResult.data.results.summary?.journal || 0,
            success_rate: agentResult.data.results.summary?.successful || 0,
            processing_time: executionTime,
            quality_score: this.calculateQualityScore(agentResult.data.results),
            raw_results: agentResult.data.results,
            performance_metrics: {
              execution_time: executionTime,
              api_calls: agentResult.data.context_updates?.api_calls || 0,
              tools_used: agentResult.data.context_updates?.tools_used || []
            }
          });
        }
      }

      logger.info('Workflow triggered from Notion completed', {
        workflow_type: workflowType,
        success: agentResult.success,
        execution_time: executionTime
      });

      return agentResult;
    } catch (error) {
      logger.error('Workflow trigger failed', { error });
      
      if (parameters.notion_page_id) {
        await this.dashboard.updateWorkflowStatus(parameters.notion_page_id, {
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      
      throw error;
    }
  }

  private calculateQualityScore(results: any): 1 | 2 | 3 | 4 | 5 {
    // Simple quality scoring based on success metrics
    const totalProcessed = results.ideas_processed?.length || 0;
    const successful = results.operations_completed?.filter((op: any) => op.status === 'success').length || 0;
    const errorRate = results.summary?.failed || 0;
    
    if (totalProcessed === 0) return 1;
    
    const successRate = successful / totalProcessed;
    
    if (successRate >= 0.95 && errorRate === 0) return 5; // Excellent
    if (successRate >= 0.85 && errorRate <= 1) return 4;  // Good  
    if (successRate >= 0.70 && errorRate <= 2) return 3;  // Fair
    if (successRate >= 0.50) return 2;                    // Poor
    return 1;                                              // Failed
  }

  /**
   * Setup regular health monitoring updates to Notion
   */
  startHealthMonitoring(intervalMs: number = 30000) {
    setInterval(async () => {
      try {
        const { agentCommunicator } = getSharedServices();
        const healthResults = await agentCommunicator.checkAllAgentsHealth();

        for (const [agentId, health] of Object.entries(healthResults.data?.agent_results || {})) {
          await this.dashboard.updateAgentStatus(agentId, {
            status: (health as any).success ? 'healthy' : 'down',
            response_time_ms: (health as any).metadata?.execution_time_ms,
            error_details: (health as any).success ? undefined : (health as any).error
          });
        }
      } catch (error) {
        logger.error('Health monitoring update failed', { error });
      }
    }, intervalMs);

    logger.info('Health monitoring started', { interval_ms: intervalMs });
  }

  getApp() {
    return this.app;
  }
}

export { NotionWebhookHandler };

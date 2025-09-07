#!/usr/bin/env node

/**
 * HTTP Wrapper for Director MCP Server
 * Provides HTTP API endpoints that internally call MCP tools
 * This allows n8n and other HTTP clients to interact with the MCP server
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { getSharedServices, initializeSharedServices } from './shared-services.js';
import { logger } from './utils/logger.js';
import {
  WorkflowTemplateRequest,
  TemplateProcessingOptions,
  DirectorToAgentInstruction,
  AgentToDirectorResponse
} from './types/workflow.js';

// Load environment variables
dotenv.config();

class DirectorMCPHttpWrapper {
  private app: express.Application;
  private port: number;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || '3002');
    
    // Initialize shared services if not already initialized
    try {
      initializeSharedServices();
    } catch (error) {
      // Services might already be initialized, that's OK
    }
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true
    }));
    
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Request logging
    this.app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info('HTTP Request', {
          method: req.method,
          url: req.url,
          status: res.statusCode,
          duration_ms: duration
        });
      });
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        mode: 'http-wrapper',
        services: {
          template_manager: 'active',
          context_manager: 'active',
          agent_communicator: 'active'
        }
      });
    });

    // =====================================================================
    // HTTP ENDPOINTS THAT MIRROR MCP TOOLS
    // =====================================================================

    /**
     * Get Workflow Template (mirrors get_workflow_template MCP tool)
     */
    this.app.post('/api/mcp/get-workflow-template', async (req, res) => {
      try {
        const { workflow_type, parameters, cache_duration }: WorkflowTemplateRequest = req.body;

        if (!workflow_type) {
          return res.status(400).json({
            success: false,
            error: 'workflow_type is required'
          });
        }

        const { templateManager } = getSharedServices();
        const result = await templateManager.getWorkflowTemplate(workflow_type, parameters);
        
        if (cache_duration && result.success) {
          res.set('Cache-Control', `public, max-age=${cache_duration}`);
        }

        return res.json(result);
      } catch (error) {
        logger.error('Error in get-workflow-template endpoint', { 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
        return res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    });

    /**
     * Create Agent Instructions (mirrors create_agent_instructions MCP tool)
     */
    this.app.post('/api/mcp/create-agent-instructions', async (req, res) => {
      try {
        const options: TemplateProcessingOptions = req.body;

        if (!options.workflow_type || !options.target_agent) {
          return res.status(400).json({
            success: false,
            error: 'workflow_type and target_agent are required'
          });
        }

        const { templateManager } = getSharedServices();
        const instructions = await templateManager.createAgentInstructions(options);

        return res.json({
          success: true,
          data: instructions,
          metadata: {
            instruction_size: JSON.stringify(instructions).length,
            created_at: new Date().toISOString()
          }
        });
      } catch (error) {
        logger.error('Error creating agent instructions', { 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
        return res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    /**
     * Execute Workflow (mirrors execute_workflow MCP tool)
     */
    this.app.post('/api/mcp/execute-workflow', async (req, res) => {
      try {
        const { workflow_type, parameters, target_agent } = req.body;

        if (!workflow_type || !target_agent) {
          return res.status(400).json({
            success: false,
            error: 'workflow_type and target_agent are required'
          });
        }

        const { templateManager, contextManager, agentCommunicator } = getSharedServices();

        // Create workflow context
        const context = contextManager.createWorkflowContext(workflow_type, parameters);

        // Create agent instructions
        const instructions = await templateManager.createAgentInstructions({
          workflow_type,
          parameters: { ...parameters, context_id: context.context_id },
          target_agent
        });

        // Send instructions to agent
        const agentResult = await agentCommunicator.sendInstructionsToAgent(target_agent, instructions);

        if (agentResult.success) {
          // Update context with agent response
          const contextUpdate = contextManager.updateContextWithAgentResponse(
            context.context_id,
            agentResult.data as AgentToDirectorResponse
          );

          return res.json({
            success: true,
            data: {
              context_id: context.context_id,
              agent_response: agentResult.data,
              context_update: contextUpdate.data,
              workflow_complete: contextUpdate.data?.workflow_complete || false
            }
          });
        } else {
          return res.status(500).json(agentResult);
        }
      } catch (error) {
        logger.error('Error executing workflow', { 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
        return res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    /**
     * Send Agent Instructions (mirrors send_agent_instructions MCP tool)
     */
    this.app.post('/api/agents/:agentId/execute', async (req, res) => {
      try {
        const { agentId } = req.params;
        const instructions: DirectorToAgentInstruction = req.body;

        const { agentCommunicator } = getSharedServices();
        const result = await agentCommunicator.sendInstructionsToAgent(agentId, instructions);
        
        if (result.success) {
          return res.json(result);
        } else {
          return res.status(500).json(result);
        }
      } catch (error) {
        logger.error('Error sending instructions to agent', { 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
        return res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    /**
     * Check Agent Health (mirrors check_agent_health MCP tool)
     */
    this.app.get('/api/agents/:agentId/health', async (req, res) => {
      try {
        const { agentId } = req.params;
        const { agentCommunicator } = getSharedServices();
        const result = await agentCommunicator.checkAgentHealth(agentId);
        return res.json(result);
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    /**
     * Check All Agents Health (mirrors check_all_agents_health MCP tool)
     */
    this.app.get('/api/agents/health', async (req, res) => {
      try {
        const { agentCommunicator } = getSharedServices();
        const result = await agentCommunicator.checkAllAgentsHealth();
        return res.json(result);
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    /**
     * Get Workflow Context (mirrors get_workflow_context MCP tool)
     */
    this.app.get('/api/context/:contextId', (req, res) => {
      try {
        const { contextId } = req.params;
        const { contextManager } = getSharedServices();
        const context = contextManager.getWorkflowContext(contextId);
        
        if (context) {
          return res.json({
            success: true,
            data: context
          });
        } else {
          return res.status(404).json({
            success: false,
            error: 'Context not found'
          });
        }
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    /**
     * List Active Contexts (mirrors list_active_contexts MCP tool)
     */
    this.app.get('/api/context', (req, res) => {
      try {
        const { contextManager } = getSharedServices();
        const contexts = contextManager.listActiveContexts();
        return res.json({
          success: true,
          data: contexts
        });
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    /**
     * Get System Stats (mirrors get_system_stats MCP tool)
     */
    this.app.get('/api/stats', async (req, res) => {
      try {
        const { getSystemStats } = await import('./shared-services.js');
        const stats = {
          ...getSystemStats(),
          server: {
            ...getSystemStats().server,
            mode: 'http-wrapper'
          }
        };

        return res.json({
          success: true,
          data: stats,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    /**
     * Clear Template Cache (mirrors clear_template_cache MCP tool)
     */
    this.app.post('/api/admin/clear-cache', (req, res) => {
      try {
        const { templateManager } = getSharedServices();
        templateManager.clearCache();
        return res.json({
          success: true,
          message: 'Template cache cleared'
        });
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
  }

  private setupErrorHandling(): void {
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.path,
        method: req.method
      });
    });

    // Global error handler
    this.app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('Unhandled error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error.stack,
        path: req.path,
        method: req.method
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
      });
    });
  }

  async start(): Promise<void> {
    try {
      this.app.listen(this.port, () => {
        logger.info('Director MCP HTTP Wrapper started successfully', {
          port: this.port,
          environment: process.env.NODE_ENV || 'development',
          pid: process.pid
        });
        
        console.error(`✅ Director MCP HTTP Wrapper running on port ${this.port}`);
        console.error('🌐 HTTP endpoints available for n8n integration');
        console.error(`📊 Health check: http://localhost:${this.port}/health`);
        console.error(`🔧 Template endpoint: http://localhost:${this.port}/api/mcp/get-workflow-template`);
      });
    } catch (error) {
      logger.error('Failed to start Director MCP HTTP Wrapper', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }
}

// Start the HTTP wrapper
const isMainModule = process.argv[1] && (
  import.meta.url === `file://${process.argv[1]}` || 
  import.meta.url.includes('http-wrapper.ts') ||
  process.argv[1].includes('http-wrapper.ts') ||
  process.argv[1].includes('http-wrapper.js')
);

if (isMainModule) {
  console.error('Starting Director MCP HTTP Wrapper...');
  const httpWrapper = new DirectorMCPHttpWrapper();
  httpWrapper.start().catch((error) => {
    console.error('Failed to start HTTP wrapper:', error);
    logger.error('Failed to start HTTP wrapper', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    process.exit(1);
  });
}

export default DirectorMCPHttpWrapper;

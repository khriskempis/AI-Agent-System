/**
 * Director MCP Server - Main Entry Point
 * Intelligent workflow orchestration and multi-agent coordination server
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { logger, requestLogger } from './utils/logger';
import { TemplateManager } from './templates/template-manager';
import { ContextManager } from './context/context-manager';
import { AgentCommunicator } from './communication/agent-communicator';
import {
  DirectorToAgentInstruction,
  AgentToDirectorResponse,
  WorkflowTemplateRequest,
  MCPToolResult,
  TemplateProcessingOptions
} from './types/workflow';

class DirectorMCPServer {
  private app: express.Application;
  private templateManager: TemplateManager;
  private contextManager: ContextManager;
  private agentCommunicator: AgentCommunicator;
  private port: number;
  private server: any;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || '3002');
    
    // Initialize managers
    this.templateManager = new TemplateManager();
    this.contextManager = new ContextManager();
    this.agentCommunicator = new AgentCommunicator();
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Setup Express Middleware
   */
  private setupMiddleware(): void {
    // Security and performance middleware
    this.app.use(helmet());
    this.app.use(compression());
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true
    }));
    
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Request logging
    this.app.use(requestLogger);
  }

  /**
   * Setup API Routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        services: {
          template_manager: 'active',
          context_manager: 'active',
          agent_communicator: 'active'
        }
      });
    });

    // ========================================================================
    // MCP TOOLS - Core Director Agent Functions
    // ========================================================================

    /**
     * MCP Tool: Get Workflow Template
     * Primary tool for Director Agent to load workflow templates
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

        const result = await this.templateManager.getWorkflowTemplate(workflow_type, parameters);
        
        if (cache_duration && result.success) {
          res.set('Cache-Control', `public, max-age=${cache_duration}`);
        }

        return res.json(result);

      } catch (error) {
        logger.error('Error in get-workflow-template MCP tool', { error: error instanceof Error ? error.message : 'Unknown error occurred' });
        return res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    });

    /**
     * MCP Tool: Create Agent Instructions
     * Extract essential logic from templates and create focused JSON instructions
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

        const instructions = await this.templateManager.createAgentInstructions(options);

        return res.json({
          success: true,
          data: instructions,
          metadata: {
            instruction_size: JSON.stringify(instructions).length,
            created_at: new Date().toISOString()
          }
        });

      } catch (error) {
        logger.error('Error creating agent instructions', { error: error instanceof Error ? error.message : 'Unknown error occurred', options: req.body });
        return res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        });
      }
    });

    /**
     * MCP Tool: Execute Workflow
     * Full workflow execution - create instructions and send to agent
     */
    this.app.post('/api/mcp/execute-workflow', async (req, res) => {
      try {
        const { workflow_type, parameters, target_agent } = req.body;

        // Create workflow context
        const context = this.contextManager.createWorkflowContext(workflow_type, parameters);

        // Create agent instructions
        const instructions = await this.templateManager.createAgentInstructions({
          workflow_type,
          parameters: { ...parameters, context_id: context.context_id },
          target_agent
        });

        // Send instructions to agent
        const agentResult = await this.agentCommunicator.sendInstructionsToAgent(target_agent, instructions);

        if (agentResult.success) {
          // Update context with agent response
          const contextUpdate = this.contextManager.updateContextWithAgentResponse(
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
        logger.error('Error executing workflow', { error: error instanceof Error ? error.message : 'Unknown error occurred' });
        return res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        });
      }
    });

    // ========================================================================
    // AGENT COMMUNICATION ENDPOINTS
    // ========================================================================

    /**
     * Send Instructions to Agent
     */
    this.app.post('/api/agents/:agentId/execute', async (req, res) => {
      try {
        const { agentId } = req.params;
        const instructions: DirectorToAgentInstruction = req.body;

        const result = await this.agentCommunicator.sendInstructionsToAgent(agentId, instructions);
        
        if (result.success) {
          return res.json(result);
        } else {
          return res.status(500).json(result);
        }

      } catch (error) {
        logger.error('Error sending instructions to agent', { error: error instanceof Error ? error.message : 'Unknown error occurred' });
        return res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        });
      }
    });

    /**
     * Receive Agent Response
     */
    this.app.post('/api/agents/response', async (req, res) => {
      try {
        const agentResponse: AgentToDirectorResponse = req.body;
        const { context_id } = req.query;

        if (!context_id) {
          return res.status(400).json({
            success: false,
            error: 'context_id query parameter is required'
          });
        }

        const result = this.contextManager.updateContextWithAgentResponse(
          context_id as string,
          agentResponse
        );

        return res.json(result);

      } catch (error) {
        logger.error('Error processing agent response', { error: error instanceof Error ? error.message : 'Unknown error occurred' });
        return res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        });
      }
    });

    /**
     * Check Agent Health
     */
    this.app.get('/api/agents/:agentId/health', async (req, res) => {
      try {
        const { agentId } = req.params;
        const result = await this.agentCommunicator.checkAgentHealth(agentId);
        return res.json(result);
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        });
      }
    });

    /**
     * Check All Agents Health
     */
    this.app.get('/api/agents/health', async (req, res) => {
      try {
        const result = await this.agentCommunicator.checkAllAgentsHealth();
        return res.json(result);
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        });
      }
    });

    // ========================================================================
    // CONTEXT MANAGEMENT ENDPOINTS
    // ========================================================================

    /**
     * Get Workflow Context
     */
    this.app.get('/api/context/:contextId', (req, res) => {
      try {
        const { contextId } = req.params;
        const context = this.contextManager.getWorkflowContext(contextId);
        
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
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        });
      }
    });

    /**
     * List Active Contexts
     */
    this.app.get('/api/context', (req, res) => {
      try {
        const contexts = this.contextManager.listActiveContexts();
        return res.json({
          success: true,
          data: contexts
        });
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        });
      }
    });

    /**
     * Get Context for Agent
     */
    this.app.get('/api/context/:contextId/agent/:agentId', (req, res) => {
      try {
        const { contextId, agentId } = req.params;
        const context = this.contextManager.getContextForAgent(contextId, agentId);
        
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
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        });
      }
    });

    // ========================================================================
    // SYSTEM MANAGEMENT ENDPOINTS
    // ========================================================================

    /**
     * Get System Statistics
     */
    this.app.get('/api/stats', (req, res) => {
      try {
        const stats = {
          server: {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            pid: process.pid,
            version: '1.0.0'
          },
          template_manager: this.templateManager.getCacheStats(),
          context_manager: this.contextManager.getStats(),
          agent_communicator: this.agentCommunicator.getAgentStats()
        };

        return res.json({
          success: true,
          data: stats,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        });
      }
    });

    /**
     * Clear Template Cache
     */
    this.app.post('/api/admin/clear-cache', (req, res) => {
      try {
        this.templateManager.clearCache();
        return res.json({
          success: true,
          message: 'Template cache cleared'
        });
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        });
      }
    });
  }

  /**
   * Setup Error Handling
   */
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
        error: error instanceof Error ? error.message : 'Unknown error occurred',
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

  /**
   * Start the Server
   */
  async start(): Promise<void> {
    try {
      this.server = this.app.listen(this.port, () => {
        logger.info('Director MCP Server started successfully', {
          port: this.port,
          environment: process.env.NODE_ENV || 'development',
          pid: process.pid
        });
      });

      // Graceful shutdown handling
      process.on('SIGTERM', () => this.shutdown('SIGTERM'));
      process.on('SIGINT', () => this.shutdown('SIGINT'));

    } catch (error) {
      logger.error('Failed to start Director MCP Server', { 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      });
      throw error;
    }
  }

  /**
   * Graceful Shutdown
   */
  private async shutdown(signal: string): Promise<void> {
    logger.info(`Received ${signal}, starting graceful shutdown`);

    // Close HTTP server
    if (this.server) {
      this.server.close(() => {
        logger.info('HTTP server closed');
      });
    }

    // Cleanup managers
    this.contextManager.shutdown();

    logger.info('Director MCP Server shutdown complete');
    process.exit(0);
  }
}

// Start the server
if (require.main === module) {
  const server = new DirectorMCPServer();
  server.start().catch((error) => {
    logger.error('Failed to start server', { error: error instanceof Error ? error.message : 'Unknown error occurred' });
    process.exit(1);
  });
}

export default DirectorMCPServer;

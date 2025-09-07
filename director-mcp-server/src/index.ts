#!/usr/bin/env node

/**
 * Director MCP Server - Intelligent Workflow Orchestration
 * Properly implementing MCP protocol for agent communication
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import { z } from 'zod';
import { logger } from './utils/logger.js';
import { initializeSharedServices, getSharedServices, cleanupSharedServices } from './shared-services.js';
import {
  WorkflowTemplateRequest,
  TemplateProcessingOptions
} from './types/workflow.js';

// Load environment variables
dotenv.config();

// Validate environment (optional for director server)
const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  LOG_LEVEL: z.string().default('info'),
});

console.error('Starting Director MCP Server...');
try {
  const env = envSchema.parse(process.env);
  console.error('✅ Environment validation passed');
} catch (error) {
  console.error('❌ Environment validation failed:', error);
  // Don't exit - continue with defaults
}

const env = envSchema.parse(process.env);

// Initialize shared services
console.error('Initializing Director MCP Server components...');
let templateManager, contextManager, agentCommunicator;

try {
  const services = initializeSharedServices();
  ({ templateManager, contextManager, agentCommunicator } = services);
  console.error('✅ All components initialized');
} catch (error) {
  console.error('❌ Component initialization failed:', error);
  process.exit(1);
}

// Create MCP server
const server = new Server(
  {
    name: 'director-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // ====================================================================
      // WORKFLOW TEMPLATE TOOLS
      // ====================================================================
      {
        name: 'get_workflow_template',
        description: 'Retrieve and load a workflow template by type',
        inputSchema: {
          type: 'object',
          properties: {
            workflow_type: {
              type: 'string',
              description: 'The type of workflow template to load (e.g., "idea-categorization-v1")',
            },
            parameters: {
              type: 'object',
              description: 'Optional parameters to customize the template',
              additionalProperties: true,
            },
            cache_duration: {
              type: 'number',
              description: 'Cache duration in seconds (optional)',
            },
          },
          required: ['workflow_type'],
        },
      },
      {
        name: 'create_agent_instructions',
        description: 'Extract essential logic from template and create focused JSON instructions for a target agent',
        inputSchema: {
          type: 'object',
          properties: {
            workflow_type: {
              type: 'string',
              description: 'The workflow template type to process',
            },
            target_agent: {
              type: 'string',
              description: 'The target agent ID (notion, planner, validation)',
            },
            parameters: {
              type: 'object',
              description: 'Runtime parameters to populate in the template',
              additionalProperties: true,
            },
            phase_override: {
              type: 'string',
              description: 'Optional specific phase to override automatic phase selection',
            },
          },
          required: ['workflow_type', 'target_agent'],
        },
      },
      {
        name: 'execute_workflow',
        description: 'Full workflow execution - create instructions and send to agent',
        inputSchema: {
          type: 'object',
          properties: {
            workflow_type: {
              type: 'string',
              description: 'The workflow template type to execute',
            },
            target_agent: {
              type: 'string',
              description: 'The agent to execute the workflow',
            },
            parameters: {
              type: 'object',
              description: 'Workflow parameters and data',
              additionalProperties: true,
            },
          },
          required: ['workflow_type', 'target_agent'],
        },
      },

      // ====================================================================
      // AGENT COMMUNICATION TOOLS
      // ====================================================================
      {
        name: 'send_agent_instructions',
        description: 'Send structured instructions to a specific agent',
        inputSchema: {
          type: 'object',
          properties: {
            agent_id: {
              type: 'string',
              description: 'Target agent ID',
            },
            instructions: {
              type: 'object',
              description: 'Complete DirectorToAgentInstruction object',
              additionalProperties: true,
            },
          },
          required: ['agent_id', 'instructions'],
        },
      },
      {
        name: 'check_agent_health',
        description: 'Check the health status of a specific agent',
        inputSchema: {
          type: 'object',
          properties: {
            agent_id: {
              type: 'string',
              description: 'Agent ID to check (notion, planner, validation)',
            },
          },
          required: ['agent_id'],
        },
      },
      {
        name: 'check_all_agents_health',
        description: 'Check health status of all configured agents',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_agent_capabilities',
        description: 'Get capabilities and specifications for an agent',
        inputSchema: {
          type: 'object',
          properties: {
            agent_id: {
              type: 'string',
              description: 'Agent ID to get capabilities for',
            },
          },
          required: ['agent_id'],
        },
      },

      // ====================================================================
      // CONTEXT MANAGEMENT TOOLS  
      // ====================================================================
      {
        name: 'create_workflow_context',
        description: 'Create a new workflow context for tracking multi-phase workflows',
        inputSchema: {
          type: 'object',
          properties: {
            workflow_id: {
              type: 'string',
              description: 'Workflow identifier',
            },
            parameters: {
              type: 'object',
              description: 'Initial workflow parameters',
              additionalProperties: true,
            },
          },
          required: ['workflow_id'],
        },
      },
      {
        name: 'get_workflow_context',
        description: 'Retrieve current state of a workflow context',
        inputSchema: {
          type: 'object',
          properties: {
            context_id: {
              type: 'string',
              description: 'Context ID to retrieve',
            },
          },
          required: ['context_id'],
        },
      },
      {
        name: 'update_context_with_agent_response',
        description: 'Update workflow context with an agent response',
        inputSchema: {
          type: 'object',
          properties: {
            context_id: {
              type: 'string',
              description: 'Context ID to update',
            },
            agent_response: {
              type: 'object',
              description: 'AgentToDirectorResponse object',
              additionalProperties: true,
            },
          },
          required: ['context_id', 'agent_response'],
        },
      },
      {
        name: 'get_context_for_agent',
        description: 'Get relevant context information for agent decision making',
        inputSchema: {
          type: 'object',
          properties: {
            context_id: {
              type: 'string',
              description: 'Context ID',
            },
            agent_id: {
              type: 'string',
              description: 'Agent ID requesting context',
            },
          },
          required: ['context_id', 'agent_id'],
        },
      },
      {
        name: 'list_active_contexts',
        description: 'List all currently active workflow contexts',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },

      // ====================================================================
      // SYSTEM MANAGEMENT TOOLS
      // ====================================================================
      {
        name: 'get_system_stats',
        description: 'Get comprehensive system statistics and status',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'clear_template_cache',
        description: 'Clear the template cache to force reload',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // =====================================================================
      // WORKFLOW TEMPLATE TOOLS
      // =====================================================================
      case 'get_workflow_template': {
        const workflow_type = args?.workflow_type as string;
        const parameters = args?.parameters as Record<string, any>;
        const cache_duration = args?.cache_duration as number;

        if (!workflow_type) {
          throw new McpError(ErrorCode.InvalidParams, 'workflow_type parameter is required');
        }

        const result = await templateManager.getWorkflowTemplate(workflow_type, parameters);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'create_agent_instructions': {
        const workflow_type = args?.workflow_type as string;
        const target_agent = args?.target_agent as string;
        const parameters = args?.parameters as Record<string, any> || {};
        const phase_override = args?.phase_override as string;

        if (!workflow_type) {
          throw new McpError(ErrorCode.InvalidParams, 'workflow_type parameter is required');
        }
        if (!target_agent) {
          throw new McpError(ErrorCode.InvalidParams, 'target_agent parameter is required');
        }

        const options: TemplateProcessingOptions = {
          workflow_type,
          parameters,
          target_agent,
          phase_override
        };

        const instructions = await templateManager.createAgentInstructions(options);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                data: instructions,
                metadata: {
                  instruction_size: JSON.stringify(instructions).length,
                  created_at: new Date().toISOString()
                }
              }, null, 2),
            },
          ],
        };
      }

      case 'execute_workflow': {
        const workflow_type = args?.workflow_type as string;
        const target_agent = args?.target_agent as string;
        const parameters = args?.parameters as Record<string, any> || {};

        if (!workflow_type) {
          throw new McpError(ErrorCode.InvalidParams, 'workflow_type parameter is required');
        }
        if (!target_agent) {
          throw new McpError(ErrorCode.InvalidParams, 'target_agent parameter is required');
        }

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
            agentResult.data
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  data: {
                    context_id: context.context_id,
                    agent_response: agentResult.data,
                    context_update: contextUpdate.data,
                    workflow_complete: contextUpdate.data?.workflow_complete || false
                  }
                }, null, 2),
              },
            ],
          };
        } else {
          throw new McpError(ErrorCode.InternalError, `Workflow execution failed: ${agentResult.error}`);
        }
      }

      // =====================================================================
      // AGENT COMMUNICATION TOOLS
      // =====================================================================
      case 'send_agent_instructions': {
        const agent_id = args?.agent_id as string;
        const instructions = args?.instructions as any;

        if (!agent_id) {
          throw new McpError(ErrorCode.InvalidParams, 'agent_id parameter is required');
        }
        if (!instructions) {
          throw new McpError(ErrorCode.InvalidParams, 'instructions parameter is required');
        }

        const result = await agentCommunicator.sendInstructionsToAgent(agent_id, instructions);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'check_agent_health': {
        const agent_id = args?.agent_id as string;
        
        if (!agent_id) {
          throw new McpError(ErrorCode.InvalidParams, 'agent_id parameter is required');
        }

        const result = await agentCommunicator.checkAgentHealth(agent_id);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'check_all_agents_health': {
        const result = await agentCommunicator.checkAllAgentsHealth();
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'get_agent_capabilities': {
        const agent_id = args?.agent_id as string;
        
        if (!agent_id) {
          throw new McpError(ErrorCode.InvalidParams, 'agent_id parameter is required');
        }

        const result = await agentCommunicator.getAgentCapabilities(agent_id);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      // =====================================================================
      // CONTEXT MANAGEMENT TOOLS
      // =====================================================================
      case 'create_workflow_context': {
        const workflow_id = args?.workflow_id as string;
        const parameters = args?.parameters as Record<string, any>;

        if (!workflow_id) {
          throw new McpError(ErrorCode.InvalidParams, 'workflow_id parameter is required');
        }

        const context = contextManager.createWorkflowContext(workflow_id, parameters);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                data: context
              }, null, 2),
            },
          ],
        };
      }

      case 'get_workflow_context': {
        const context_id = args?.context_id as string;

        if (!context_id) {
          throw new McpError(ErrorCode.InvalidParams, 'context_id parameter is required');
        }

        const context = contextManager.getWorkflowContext(context_id);
        
        if (!context) {
          throw new McpError(ErrorCode.InvalidParams, `Context not found: ${context_id}`);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                data: context
              }, null, 2),
            },
          ],
        };
      }

      case 'update_context_with_agent_response': {
        const context_id = args?.context_id as string;
        const agent_response = args?.agent_response as any;

        if (!context_id) {
          throw new McpError(ErrorCode.InvalidParams, 'context_id parameter is required');
        }
        if (!agent_response) {
          throw new McpError(ErrorCode.InvalidParams, 'agent_response parameter is required');
        }

        const result = contextManager.updateContextWithAgentResponse(context_id, agent_response);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'get_context_for_agent': {
        const context_id = args?.context_id as string;
        const agent_id = args?.agent_id as string;

        if (!context_id) {
          throw new McpError(ErrorCode.InvalidParams, 'context_id parameter is required');
        }
        if (!agent_id) {
          throw new McpError(ErrorCode.InvalidParams, 'agent_id parameter is required');
        }

        const context = contextManager.getContextForAgent(context_id, agent_id);
        
        if (!context) {
          throw new McpError(ErrorCode.InvalidParams, `Context not found for agent: ${agent_id}`);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                data: context
              }, null, 2),
            },
          ],
        };
      }

      case 'list_active_contexts': {
        const contexts = contextManager.listActiveContexts();
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                data: contexts
              }, null, 2),
            },
          ],
        };
      }

      // =====================================================================
      // SYSTEM MANAGEMENT TOOLS
      // =====================================================================
      case 'get_system_stats': {
        const { getSystemStats } = await import('./shared-services.js');
        const stats = getSystemStats();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                data: stats,
                timestamp: new Date().toISOString()
              }, null, 2),
            },
          ],
        };
      }

      case 'clear_template_cache': {
        templateManager.clearCache();
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: 'Template cache cleared'
              }, null, 2),
            },
          ],
        };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Error executing tool ${name}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Director MCP Server running on stdio');
  
  // Keep the process alive for Docker daemon mode
  const keepAlive = setInterval(() => {
    // Do nothing, just keep the process alive
  }, 30000); // Check every 30 seconds
  
  // Handle stdin close (normal for daemon mode)
  process.stdin.on('close', () => {
    console.error('stdin closed, but keeping process alive for Docker...');
  });
  
  process.stdin.on('error', (err) => {
    console.error('stdin error (expected in Docker):', err.message);
  });
  
  // Handle process termination gracefully
  process.on('SIGINT', () => {
    console.error('Received SIGINT, shutting down...');
    clearInterval(keepAlive);
    cleanupSharedServices();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.error('Received SIGTERM, shutting down...');
    clearInterval(keepAlive);
    cleanupSharedServices();
    process.exit(0);
  });
  
  // Resume stdin to handle input if available
  process.stdin.resume();
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
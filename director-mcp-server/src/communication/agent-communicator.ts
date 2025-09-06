/**
 * Agent Communicator - Handles communication between Director and individual agents
 * Manages HTTP API calls, response processing, and agent coordination
 */

import axios, { AxiosResponse } from 'axios';
import { logger } from '../utils/logger';
import {
  DirectorToAgentInstruction,
  AgentToDirectorResponse,
  MCPToolResult
} from '../types/workflow';

export interface AgentEndpoint {
  agent_id: string;
  base_url: string;
  endpoints: {
    execute: string;
    health: string;
    status: string;
  };
  timeout_ms: number;
  retry_attempts: number;
}

export class AgentCommunicator {
  private agentEndpoints: Map<string, AgentEndpoint> = new Map();
  private defaultTimeout = 180000; // 3 minutes
  private defaultRetries = 2;

  constructor() {
    this.initializeAgentEndpoints();
  }

  /**
   * Initialize Agent Endpoints
   * Configure communication endpoints for all available agents
   */
  private initializeAgentEndpoints(): void {
    // Notion Agent (n8n webhook)
    this.agentEndpoints.set('notion', {
      agent_id: 'notion',
      base_url: 'http://host.docker.internal:5678', // n8n on Docker host
      endpoints: {
        execute: '/webhook/notion-agent-execute',
        health: '/webhook/notion-agent-health',
        status: '/webhook/notion-agent-status'
      },
      timeout_ms: this.defaultTimeout,
      retry_attempts: this.defaultRetries
    });

    // Planner Agent (future)
    this.agentEndpoints.set('planner', {
      agent_id: 'planner',
      base_url: 'http://host.docker.internal:5678',
      endpoints: {
        execute: '/webhook/planner-agent-execute',
        health: '/webhook/planner-agent-health',
        status: '/webhook/planner-agent-status'
      },
      timeout_ms: this.defaultTimeout,
      retry_attempts: this.defaultRetries
    });

    // Validation Agent (future)
    this.agentEndpoints.set('validation', {
      agent_id: 'validation',
      base_url: 'http://host.docker.internal:5678',
      endpoints: {
        execute: '/webhook/validation-agent-execute',
        health: '/webhook/validation-agent-health',
        status: '/webhook/validation-agent-status'
      },
      timeout_ms: this.defaultTimeout,
      retry_attempts: this.defaultRetries
    });

    logger.info('Agent endpoints initialized', {
      agents: Array.from(this.agentEndpoints.keys())
    });
  }

  /**
   * Send Instructions to Agent
   * Core function for sending JSON instructions to agents
   */
  async sendInstructionsToAgent(
    agentId: string, 
    instructions: DirectorToAgentInstruction
  ): Promise<MCPToolResult> {
    const startTime = Date.now();
    
    logger.info('Sending instructions to agent', {
      agent_id: agentId,
      task_id: instructions.task_id,
      instruction_type: instructions.instruction.task_type,
      instruction_size: JSON.stringify(instructions).length
    });

    try {
      const endpoint = this.agentEndpoints.get(agentId);
      if (!endpoint) {
        return {
          success: false,
          error: `Agent endpoint not configured: ${agentId}`,
          metadata: { available_agents: Array.from(this.agentEndpoints.keys()) }
        };
      }

      // Send instructions with retry logic
      const response = await this.sendWithRetry(endpoint, instructions);
      
      const executionTime = Date.now() - startTime;
      
      logger.info('Agent response received', {
        agent_id: agentId,
        task_id: instructions.task_id,
        execution_time_ms: executionTime,
        response_size: JSON.stringify(response.data).length,
        status_code: response.status
      });

      // Validate response format
      const validation = this.validateAgentResponse(response.data);
      if (!validation.success) {
        return {
          success: false,
          error: `Invalid agent response: ${validation.error}`,
          metadata: { raw_response: response.data }
        };
      }

      return {
        success: true,
        data: response.data as AgentToDirectorResponse,
        metadata: {
          execution_time_ms: executionTime,
          response_size: JSON.stringify(response.data).length,
          agent_endpoint: endpoint.base_url + endpoint.endpoints.execute
        }
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      logger.error('Error sending instructions to agent', {
        agent_id: agentId,
        task_id: instructions.task_id,
        execution_time_ms: executionTime,
        error: this.getErrorMessage(error),
        error_type: this.categorizeError(error)
      });

      return {
        success: false,
        error: `Agent communication failed: ${this.getErrorMessage(error)}`,
        metadata: {
          execution_time_ms: executionTime,
          error_type: this.categorizeError(error),
          retry_attempts: this.agentEndpoints.get(agentId)?.retry_attempts || 0
        }
      };
    }
  }

  /**
   * Send with Retry Logic
   */
  private async sendWithRetry(
    endpoint: AgentEndpoint, 
    instructions: DirectorToAgentInstruction
  ): Promise<AxiosResponse> {
    const url = endpoint.base_url + endpoint.endpoints.execute;
    const config = {
      timeout: endpoint.timeout_ms,
      headers: {
        'Content-Type': 'application/json',
        'X-Director-Task-ID': instructions.task_id,
        'X-Director-Workflow-ID': instructions.workflow_id || 'unknown'
      }
    };

    let lastError: any;
    
    for (let attempt = 1; attempt <= endpoint.retry_attempts + 1; attempt++) {
      try {
        logger.debug(`Sending to agent (attempt ${attempt})`, {
          agent_id: endpoint.agent_id,
          url: url,
          timeout: endpoint.timeout_ms
        });

        const response = await axios.post(url, instructions, config);
        
        if (attempt > 1) {
          logger.info(`Agent call succeeded on attempt ${attempt}`, {
            agent_id: endpoint.agent_id,
            task_id: instructions.task_id
          });
        }

        return response;

      } catch (error) {
        lastError = error;
        
        if (attempt <= endpoint.retry_attempts) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Exponential backoff, max 10s
          
          logger.warn(`Agent call failed, retrying in ${delay}ms`, {
            agent_id: endpoint.agent_id,
            task_id: instructions.task_id,
            attempt: attempt,
            error: this.getErrorMessage(error)
          });

          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Validate Agent Response
   */
  private validateAgentResponse(response: any): { success: boolean; error?: string } {
    if (!response) {
      return { success: false, error: 'Empty response' };
    }

    // Check required fields
    const requiredFields = ['agent_id', 'task_id', 'phase', 'timestamp', 'results', 'status'];
    for (const field of requiredFields) {
      if (!(field in response)) {
        return { success: false, error: `Missing required field: ${field}` };
      }
    }

    // Validate status object
    if (!response.status || typeof response.status.success !== 'boolean') {
      return { success: false, error: 'Invalid status object' };
    }

    // Validate timestamp
    if (!this.isValidISO8601(response.timestamp)) {
      return { success: false, error: 'Invalid timestamp format' };
    }

    return { success: true };
  }

  /**
   * Check Agent Health
   */
  async checkAgentHealth(agentId: string): Promise<MCPToolResult> {
    try {
      const endpoint = this.agentEndpoints.get(agentId);
      if (!endpoint) {
        return {
          success: false,
          error: `Agent endpoint not configured: ${agentId}`
        };
      }

      const url = endpoint.base_url + endpoint.endpoints.health;
      const response = await axios.get(url, { timeout: 5000 });

      return {
        success: true,
        data: {
          agent_id: agentId,
          status: 'healthy',
          response_time_ms: response.headers['x-response-time'] || 'unknown',
          endpoint: url
        }
      };

    } catch (error) {
      return {
        success: false,
        error: `Agent health check failed: ${this.getErrorMessage(error)}`,
        metadata: {
          agent_id: agentId,
          error_type: this.categorizeError(error)
        }
      };
    }
  }

  /**
   * Check All Agents Health
   */
  async checkAllAgentsHealth(): Promise<MCPToolResult> {
    const results: any = {};
    const agents = Array.from(this.agentEndpoints.keys());

    logger.info('Checking health of all agents', { agents });

    const healthChecks = agents.map(async (agentId) => {
      const result = await this.checkAgentHealth(agentId);
      results[agentId] = result;
    });

    await Promise.all(healthChecks);

    const healthyAgents = Object.values(results).filter((r: any) => r.success).length;
    const totalAgents = agents.length;

    return {
      success: healthyAgents > 0,
      data: {
        summary: {
          total_agents: totalAgents,
          healthy_agents: healthyAgents,
          unhealthy_agents: totalAgents - healthyAgents,
          health_percentage: Math.round((healthyAgents / totalAgents) * 100)
        },
        agent_results: results
      },
      metadata: {
        checked_at: new Date().toISOString(),
        agents_checked: agents
      }
    };
  }

  /**
   * Get Agent Capabilities
   */
  async getAgentCapabilities(agentId: string): Promise<MCPToolResult> {
    // Future implementation - load from agent capabilities schema
    const capabilities = this.getStaticCapabilities(agentId);
    
    if (!capabilities) {
      return {
        success: false,
        error: `No capabilities defined for agent: ${agentId}`
      };
    }

    return {
      success: true,
      data: capabilities
    };
  }

  /**
   * Get Static Capabilities (placeholder for future schema loading)
   */
  private getStaticCapabilities(agentId: string): any {
    const capabilities: Record<string, any> = {
      notion: {
        agent_id: 'notion',
        primary_functions: ['database_operations', 'content_analysis', 'multi_idea_parsing'],
        supported_task_types: ['multi_idea_categorization', 'database_page_updates', 'content_processing'],
        supported_formats: ['json'],
        database_types: ['notion'],
        batch_operations: true,
        max_operations_per_call: 50,
        specializations: ['multi_idea_parsing', 'metadata_extraction', 'database_routing'],
        tools: ['get_ideas', 'get_idea_by_id', 'search_ideas', 'update_idea', 'get_database_schema', 'update_database_page']
      },
      planner: {
        agent_id: 'planner',
        primary_functions: ['strategic_planning', 'task_decomposition'],
        supported_task_types: ['project_planning', 'task_breakdown', 'execution_strategy'],
        supported_formats: ['json'],
        specializations: ['project_management', 'resource_planning', 'timeline_optimization'],
        tools: ['analyze_requirements', 'create_plan', 'optimize_workflow']
      },
      validation: {
        agent_id: 'validation',
        primary_functions: ['quality_assurance', 'consistency_checking'],
        supported_task_types: ['result_validation', 'consistency_check', 'quality_assessment'],
        supported_formats: ['json'],
        specializations: ['data_validation', 'workflow_verification', 'error_detection'],
        tools: ['validate_data', 'check_consistency', 'generate_report']
      }
    };

    return capabilities[agentId] || null;
  }

  /**
   * Get Error Message
   */
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return 'Unknown error occurred';
  }

  /**
   * Categorize Error Type
   */
  private categorizeError(error: any): string {
    if (error.code === 'ECONNREFUSED') return 'connection_refused';
    if (error.code === 'ETIMEDOUT') return 'timeout';
    if (error.response?.status >= 400 && error.response?.status < 500) return 'client_error';
    if (error.response?.status >= 500) return 'server_error';
    if (error.code === 'ENOTFOUND') return 'dns_error';
    return 'unknown_error';
  }

  /**
   * Validate ISO8601 timestamp
   */
  private isValidISO8601(timestamp: string): boolean {
    const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
    return iso8601Regex.test(timestamp) && !isNaN(Date.parse(timestamp));
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Update Agent Endpoint Configuration
   */
  updateAgentEndpoint(agentId: string, endpoint: Partial<AgentEndpoint>): void {
    const existing = this.agentEndpoints.get(agentId);
    if (existing) {
      this.agentEndpoints.set(agentId, { ...existing, ...endpoint });
      logger.info(`Updated endpoint configuration for agent: ${agentId}`);
    } else {
      logger.warn(`Cannot update endpoint for unknown agent: ${agentId}`);
    }
  }

  /**
   * Get Agent Statistics
   */
  getAgentStats(): { configured_agents: number; agent_ids: string[] } {
    return {
      configured_agents: this.agentEndpoints.size,
      agent_ids: Array.from(this.agentEndpoints.keys())
    };
  }
}

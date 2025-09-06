/**
 * Context Manager - Handles shared workflow context and agent coordination
 * Maintains state across workflow phases, tracks agent results, and manages context updates
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import {
  SharedWorkflowContext,
  AgentToDirectorResponse,
  PhaseResult,
  WorkflowState,
  PerformanceMetrics,
  ErrorEntry,
  MCPToolResult
} from '../types/workflow';

export class ContextManager {
  private contexts: Map<string, SharedWorkflowContext> = new Map();
  private maxContextAge = 24 * 60 * 60 * 1000; // 24 hours
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Start periodic cleanup of old contexts
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldContexts();
    }, 60 * 60 * 1000); // Every hour
  }

  /**
   * Create New Workflow Context
   */
  createWorkflowContext(workflowId: string, parameters?: Record<string, any>): SharedWorkflowContext {
    const contextId = this.generateContextId();
    
    const context: SharedWorkflowContext = {
      context_id: contextId,
      workflow_id: workflowId,
      current_phase: 'initialization',
      iteration: 1,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      phase_results: {},
      workflow_state: {
        databases_involved: [],
        total_operations: 0,
        error_count: 0,
        current_agents: [],
        pending_tasks: []
      },
      performance_metrics: {
        total_execution_time_ms: 0,
        api_calls_total: 0,
        token_usage_estimate: 0,
        agent_response_times: {},
        bottlenecks: []
      },
      error_log: []
    };

    // Add initial parameters to context
    if (parameters) {
      (context as any).initial_parameters = parameters;
    }

    this.contexts.set(contextId, context);
    
    logger.info('Workflow context created', {
      context_id: contextId,
      workflow_id: workflowId,
      parameters: parameters ? Object.keys(parameters) : []
    });

    return context;
  }

  /**
   * Get Workflow Context
   */
  getWorkflowContext(contextId: string): SharedWorkflowContext | null {
    const context = this.contexts.get(contextId);
    if (!context) {
      logger.warn(`Workflow context not found: ${contextId}`);
      return null;
    }
    return context;
  }

  /**
   * Update Context with Agent Response
   * Core function for integrating agent results into shared context
   */
  updateContextWithAgentResponse(
    contextId: string, 
    agentResponse: AgentToDirectorResponse
  ): MCPToolResult {
    try {
      const context = this.getWorkflowContext(contextId);
      if (!context) {
        return {
          success: false,
          error: `Context not found: ${contextId}`
        };
      }

      logger.info('Updating context with agent response', {
        context_id: contextId,
        agent_id: agentResponse.agent_id,
        task_id: agentResponse.task_id,
        phase: agentResponse.phase
      });

      // Create phase result
      const phaseResult: PhaseResult = {
        agent: agentResponse.agent_id,
        completed_at: agentResponse.timestamp,
        status: agentResponse.status.success ? 'success' : 'failed',
        execution_time_ms: agentResponse.execution_time_ms,
        results_summary: this.summarizeResults(agentResponse.results),
        next_action: agentResponse.status.next_phase,
        error_details: agentResponse.status.errors.length > 0 ? 
                      agentResponse.status.errors.join('; ') : undefined
      };

      // Update phase results
      context.phase_results[agentResponse.phase] = phaseResult;

      // Update current phase
      context.current_phase = agentResponse.phase;
      context.updated_at = new Date().toISOString();

      // Update workflow state
      this.updateWorkflowState(context, agentResponse);

      // Update performance metrics
      this.updatePerformanceMetrics(context, agentResponse);

      // Handle errors
      if (!agentResponse.status.success) {
        this.addErrorToContext(context, agentResponse);
      }

      // Determine next phase
      const nextPhase = this.determineNextPhase(context, agentResponse);
      
      logger.info('Context updated successfully', {
        context_id: contextId,
        current_phase: context.current_phase,
        next_phase: nextPhase,
        total_phases: Object.keys(context.phase_results).length
      });

      return {
        success: true,
        data: {
          context_id: contextId,
          current_phase: context.current_phase,
          next_phase: nextPhase,
          workflow_complete: nextPhase === 'complete',
          summary: this.getContextSummary(context)
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error updating context with agent response', {
        context_id: contextId,
        agent_id: agentResponse.agent_id,
        error: errorMessage
      });

      return {
        success: false,
        error: `Failed to update context: ${errorMessage}`
      };
    }
  }

  /**
   * Update Workflow State
   */
  private updateWorkflowState(context: SharedWorkflowContext, agentResponse: AgentToDirectorResponse): void {
    const state = context.workflow_state;

    // Update current agents
    if (!state.current_agents.includes(agentResponse.agent_id)) {
      state.current_agents.push(agentResponse.agent_id);
    }

    // Count operations
    if (agentResponse.results.operations_completed) {
      state.total_operations += agentResponse.results.operations_completed.length;
    }

    if (agentResponse.results.ideas_processed) {
      state.total_operations += agentResponse.results.ideas_processed.length;
    }

    // Track databases involved
    if (agentResponse.results.ideas_processed) {
      agentResponse.results.ideas_processed.forEach(idea => {
        if (idea.target_database_id && !state.databases_involved.includes(idea.target_database_id)) {
          state.databases_involved.push(idea.target_database_id);
        }
      });
    }

    // Update error count
    if (!agentResponse.status.success) {
      state.error_count++;
    }
  }

  /**
   * Update Performance Metrics
   */
  private updatePerformanceMetrics(context: SharedWorkflowContext, agentResponse: AgentToDirectorResponse): void {
    const metrics = context.performance_metrics;

    // Update total execution time
    metrics.total_execution_time_ms += agentResponse.execution_time_ms;

    // Track API calls
    if (agentResponse.context_updates.api_calls) {
      metrics.api_calls_total += agentResponse.context_updates.api_calls;
    }

    // Track agent response times
    metrics.agent_response_times[agentResponse.agent_id] = agentResponse.execution_time_ms;

    // Estimate token usage based on response size
    const responseSize = JSON.stringify(agentResponse).length;
    metrics.token_usage_estimate += Math.ceil(responseSize / 4); // Rough token estimation

    // Detect bottlenecks
    if (agentResponse.execution_time_ms > 60000) { // Over 1 minute
      metrics.bottlenecks.push(`${agentResponse.agent_id} slow response: ${agentResponse.execution_time_ms}ms`);
    }
  }

  /**
   * Add Error to Context
   */
  private addErrorToContext(context: SharedWorkflowContext, agentResponse: AgentToDirectorResponse): void {
    agentResponse.status.errors.forEach(error => {
      const errorEntry: ErrorEntry = {
        timestamp: agentResponse.timestamp,
        error_type: 'agent_execution_error',
        error_message: error,
        context: {
          agent_id: agentResponse.agent_id,
          task_id: agentResponse.task_id,
          phase: agentResponse.phase
        },
        suggested_action: this.suggestErrorAction(error),
        agent_id: agentResponse.agent_id,
        phase: agentResponse.phase
      };

      context.error_log.push(errorEntry);
    });
  }

  /**
   * Suggest Error Action
   */
  private suggestErrorAction(error: string): string {
    if (error.includes('timeout')) {
      return 'Increase timeout or optimize agent processing';
    }
    if (error.includes('database')) {
      return 'Check database connectivity and permissions';
    }
    if (error.includes('validation')) {
      return 'Review input parameters and schema validation';
    }
    if (error.includes('tool')) {
      return 'Verify MCP tool availability and configuration';
    }
    return 'Review error details and agent logs for specific resolution';
  }

  /**
   * Determine Next Phase
   */
  private determineNextPhase(context: SharedWorkflowContext, agentResponse: AgentToDirectorResponse): string {
    // Use agent's suggested next phase
    if (agentResponse.status.next_phase) {
      if (agentResponse.status.next_phase === 'workflow_complete') {
        return 'complete';
      }
      return agentResponse.status.next_phase;
    }

    // Default phase progression logic
    const currentPhase = agentResponse.phase;
    
    if (currentPhase.includes('categorization')) {
      return 'execution_planning';
    }
    
    if (currentPhase.includes('planning')) {
      return 'execution';
    }
    
    if (currentPhase.includes('execution')) {
      return 'validation';
    }
    
    if (currentPhase.includes('validation')) {
      return 'complete';
    }

    return 'unknown';
  }

  /**
   * Summarize Results
   */
  private summarizeResults(results: any): any {
    let summary: any = {};

    if (results.summary) {
      summary = { ...results.summary };
    }

    if (results.ideas_processed) {
      summary.ideas_count = results.ideas_processed.length;
      summary.databases_targeted = [...new Set(results.ideas_processed.map((idea: any) => idea.target_database))];
    }

    if (results.operations_completed) {
      summary.operations_count = results.operations_completed.length;
      summary.successful_operations = results.operations_completed.filter((op: any) => op.status === 'success').length;
    }

    return summary;
  }

  /**
   * Get Context Summary
   */
  getContextSummary(context: SharedWorkflowContext): any {
    return {
      context_id: context.context_id,
      workflow_id: context.workflow_id,
      current_phase: context.current_phase,
      iteration: context.iteration,
      duration_ms: new Date().getTime() - new Date(context.started_at).getTime(),
      phases_completed: Object.keys(context.phase_results).length,
      agents_involved: context.workflow_state.current_agents,
      total_operations: context.workflow_state.total_operations,
      error_count: context.workflow_state.error_count,
      performance: {
        total_time_ms: context.performance_metrics.total_execution_time_ms,
        api_calls: context.performance_metrics.api_calls_total,
        token_usage: context.performance_metrics.token_usage_estimate
      }
    };
  }

  /**
   * Get Context for Agent
   * Returns relevant context information for agent decision making
   */
  getContextForAgent(contextId: string, agentId: string): any {
    const context = this.getWorkflowContext(contextId);
    if (!context) {
      return null;
    }

    return {
      context_id: contextId,
      workflow_id: context.workflow_id,
      current_phase: context.current_phase,
      iteration: context.iteration,
      previous_results: this.getPreviousResults(context, agentId),
      workflow_state: context.workflow_state,
      recent_errors: context.error_log.slice(-3) // Last 3 errors
    };
  }

  /**
   * Get Previous Results
   */
  private getPreviousResults(context: SharedWorkflowContext, currentAgent: string): any {
    const results: any = {};
    
    Object.entries(context.phase_results).forEach(([phase, result]) => {
      if (result.agent !== currentAgent && result.status === 'success') {
        results[phase] = {
          agent: result.agent,
          completed_at: result.completed_at,
          summary: result.results_summary
        };
      }
    });

    return results;
  }

  /**
   * List Active Contexts
   */
  listActiveContexts(): Array<{ context_id: string; workflow_id: string; current_phase: string; age_ms: number }> {
    const now = new Date().getTime();
    
    return Array.from(this.contexts.entries()).map(([contextId, context]) => ({
      context_id: contextId,
      workflow_id: context.workflow_id,
      current_phase: context.current_phase,
      age_ms: now - new Date(context.started_at).getTime()
    }));
  }

  /**
   * Cleanup Old Contexts
   */
  private cleanupOldContexts(): void {
    const now = new Date().getTime();
    const expiredContexts: string[] = [];

    this.contexts.forEach((context, contextId) => {
      const age = now - new Date(context.started_at).getTime();
      if (age > this.maxContextAge) {
        expiredContexts.push(contextId);
      }
    });

    expiredContexts.forEach(contextId => {
      this.contexts.delete(contextId);
      logger.info(`Cleaned up expired context: ${contextId}`);
    });

    if (expiredContexts.length > 0) {
      logger.info(`Cleaned up ${expiredContexts.length} expired contexts`);
    }
  }

  /**
   * Generate Context ID
   */
  private generateContextId(): string {
    return `ctx_${uuidv4().replace(/-/g, '')}`;
  }

  /**
   * Shutdown cleanup
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  /**
   * Get Statistics
   */
  getStats(): { active_contexts: number; total_processed: number; memory_usage: number } {
    return {
      active_contexts: this.contexts.size,
      total_processed: this.contexts.size, // Simplified - in production, track separately
      memory_usage: process.memoryUsage().heapUsed
    };
  }
}

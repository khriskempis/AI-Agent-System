/**
 * Shared interfaces for all TypeScript agent classes.
 * Every agent receives AgentInput and returns AgentOutput —
 * this contract replaces the n8n webhook request/response format.
 */

export interface AgentInput {
  /** Unique ID for the top-level daily/manual workflow run */
  workflowId: string;
  /** Correlation ID from the WorkflowContext that owns this run */
  contextId: string;
  /** Agent-specific parameters passed from the scheduler or prior phase results */
  parameters: Record<string, unknown>;
}

export interface AgentOutput {
  /** Identifier for the agent that produced this output */
  agentId: string;
  /** Phase name this output belongs to (e.g. "notion", "planner", "validation") */
  phase: string;
  /** Whether the agent completed its work without fatal errors */
  success: boolean;
  /** Wall-clock duration of the agent's execute() call in milliseconds */
  durationMs: number;
  /** Agent-specific result data passed to downstream agents via WorkflowContext */
  results: Record<string, unknown>;
  /** Non-fatal errors logged during execution (fatal errors throw instead) */
  errors: string[];
}

/**
 * Read-only view of the WorkflowContext passed to agents that need
 * awareness of prior phase results (e.g. ValidationAgent).
 */
export interface AgentContext {
  contextId: string;
  workflowId: string;
  phases: string[];
  getPhaseResult(phase: string): AgentOutput | undefined;
}

import { randomUUID } from "crypto";
import type { AgentOutput, AgentContext } from "../agents/types.js";

export interface WorkflowContextSummary {
  contextId: string;
  workflowId: string;
  phases: string[];
  overallSuccess: boolean;
  totalDurationMs: number;
}

/**
 * Lightweight, synchronous, per-run context object.
 *
 * Lives only for the duration of one scheduler trigger — not a server-level
 * singleton. Intentionally simpler than director-mcp-server's ContextManager,
 * which tracks concurrent multi-session state with TTL cleanup.
 *
 * Implements AgentContext so it can be passed read-only to agents.
 */
export class WorkflowContext implements AgentContext {
  readonly contextId: string;
  readonly workflowId: string;
  private readonly phaseResults: Map<string, AgentOutput>;

  constructor(workflowId: string) {
    this.contextId = randomUUID();
    this.workflowId = workflowId;
    this.phaseResults = new Map();
  }

  get phases(): string[] {
    return Array.from(this.phaseResults.keys());
  }

  recordPhaseResult(phase: string, output: AgentOutput): void {
    this.phaseResults.set(phase, output);
  }

  getPhaseResult(phase: string): AgentOutput | undefined {
    return this.phaseResults.get(phase);
  }

  /** Returns all phase results as a plain object for passing via AgentInput.parameters */
  getAll(): Record<string, AgentOutput> {
    return Object.fromEntries(this.phaseResults);
  }

  toSummary(): WorkflowContextSummary {
    const results = Array.from(this.phaseResults.values());
    return {
      contextId: this.contextId,
      workflowId: this.workflowId,
      phases: this.phases,
      overallSuccess: results.length > 0 && results.every((r) => r.success),
      totalDurationMs: results.reduce((sum, r) => sum + r.durationMs, 0),
    };
  }
}

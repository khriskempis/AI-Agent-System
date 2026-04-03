import { logger } from "../logger.js";
import { runPlanningProcessing } from "../pipelines/run-planning.js";
import type { AgentInput, AgentOutput } from "./types.js";

/**
 * PlannerAgent — Layer 2 agent that drives the planning pipeline.
 *
 * Delegates all work to runPlanningProcessing(), which fetches all "In progress"
 * ideas from Notion and generates a structured plan for each via Claude.
 *
 * Does not call NotionAgent directly — that is handled inside run-planning.ts.
 */
export class PlannerAgent {
  async execute(input: AgentInput): Promise<AgentOutput> {
    const start = Date.now();

    logger.info(`[PlannerAgent] Starting — workflowId: ${input.workflowId}`);

    const result = await runPlanningProcessing();

    return {
      ...result,
      agentId: "planner-agent",
      phase: "planner",
      durationMs: Date.now() - start,
    };
  }
}

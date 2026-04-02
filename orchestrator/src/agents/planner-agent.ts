import { logger } from "../logger.js";
import type { AgentInput, AgentOutput } from "./types.js";

/**
 * PlannerAgent — stub implementation.
 *
 * Will build structured execution plans from NotionAgent output in a future phase
 * (e.g. ordering database item creation tasks, resolving dependencies between ideas).
 *
 * For now it passes through NotionAgent results so the scheduler chain stays intact.
 */
export class PlannerAgent {
  async execute(input: AgentInput): Promise<AgentOutput> {
    const start = Date.now();

    logger.info(`[PlannerAgent] Running (stub) — workflowId: ${input.workflowId}`);
    logger.info("[PlannerAgent] Full planning logic will be added in a later phase");

    return {
      agentId: "planner-agent",
      phase: "planner",
      success: true,
      durationMs: Date.now() - start,
      results: {
        stub: true,
        passthrough: input.parameters.notionResults ?? {},
      },
      errors: [],
    };
  }
}

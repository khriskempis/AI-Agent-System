import { NotionAgent } from "../agents/notion-agent.js";
import { planIdea } from "./plan-idea.js";
import { logger } from "../logger.js";
import type { AgentOutput } from "../agents/types.js";

/**
 * Planning pipeline.
 *
 * Uses NotionAgent (Layer 1 capability) to fetch all "In progress" ideas —
 * those that have already been categorized by the daily-processing pipeline —
 * then runs each through the plan-idea pipeline (Layer 2 use case).
 *
 * Returns an AgentOutput so the scheduler can record it in WorkflowContext.
 */
export async function runPlanningProcessing(): Promise<AgentOutput> {
  const start = Date.now();
  const notion = new NotionAgent();
  const errors: string[] = [];

  logger.info('[run-planning] Fetching projects with status "Ready for Planning"');

  let ideas;
  try {
    ideas = await notion.getReadyForPlanningProjects();
  } catch (err) {
    const msg = `Failed to fetch Ready for Planning projects: ${String(err)}`;
    logger.error(`[run-planning] ${msg}`);
    return {
      agentId: "run-planning",
      phase: "planner",
      success: false,
      durationMs: Date.now() - start,
      results: {},
      errors: [msg],
    };
  }

  logger.info(`[run-planning] Found ${ideas.length} project(s) ready for planning`);

  if (ideas.length === 0) {
    logger.info("[run-planning] Nothing to plan — done");
    return {
      agentId: "run-planning",
      phase: "planner",
      success: true,
      durationMs: Date.now() - start,
      results: { total: 0, processed: 0, failed: 0, processedIds: [], failedIds: [] },
      errors: [],
    };
  }

  const processedIds: string[] = [];
  const failedIds: string[] = [];

  for (const idea of ideas) {
    logger.info(`[run-planning] → "${idea.title}" (${idea.id})`);
    try {
      await planIdea(idea.id);
      processedIds.push(idea.id);
    } catch (err) {
      const msg = `"${idea.title}" (${idea.id}): ${String(err)}`;
      logger.error(`[run-planning] Failed — ${msg}`);
      errors.push(msg);
      failedIds.push(idea.id);
    }
  }

  const total = ideas.length;
  const processed = processedIds.length;
  const failed = failedIds.length;

  logger.info(`[run-planning] Complete — ${processed}/${total} planned, ${failed} failed`);

  return {
    agentId: "run-planning",
    phase: "planner",
    success: failed === 0,
    durationMs: Date.now() - start,
    results: { total, processed, failed, processedIds, failedIds },
    errors,
  };
}

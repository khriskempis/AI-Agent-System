import { NotionAgent } from "../agents/notion-agent.js";
import { categorizeIdea } from "./categorize-idea.js";
import { logger } from "../logger.js";
import type { AgentOutput } from "../agents/types.js";

/**
 * Daily processing pipeline.
 *
 * Uses NotionAgent (Layer 1 capability) to fetch all unprocessed ideas,
 * then runs each through the categorize-idea pipeline (Layer 2 use case).
 *
 * Returns an AgentOutput so the scheduler can record it in WorkflowContext.
 */
export async function runDailyProcessing(): Promise<AgentOutput> {
  const start = Date.now();
  const notion = new NotionAgent();
  const errors: string[] = [];

  logger.info("[daily-processing] Fetching unprocessed ideas");

  let ideas;
  try {
    ideas = await notion.getAllUnprocessed();
  } catch (err) {
    const msg = `Failed to fetch unprocessed ideas: ${String(err)}`;
    logger.error(`[daily-processing] ${msg}`);
    return {
      agentId: "daily-processing",
      phase: "notion",
      success: false,
      durationMs: Date.now() - start,
      results: {},
      errors: [msg],
    };
  }

  logger.info(`[daily-processing] Found ${ideas.length} idea(s) to process`);

  if (ideas.length === 0) {
    logger.info("[daily-processing] Nothing to process — done");
    return {
      agentId: "daily-processing",
      phase: "notion",
      success: true,
      durationMs: Date.now() - start,
      results: { total: 0, processed: 0, failed: 0, processedIds: [], failedIds: [] },
      errors: [],
    };
  }

  const processedIds: string[] = [];
  const failedIds: string[] = [];

  for (const idea of ideas) {
    logger.info(`[daily-processing] → "${idea.name}" (${idea.id})`);
    try {
      await categorizeIdea(idea.id);
      processedIds.push(idea.id);
    } catch (err) {
      const msg = `"${idea.name}" (${idea.id}): ${String(err)}`;
      logger.error(`[daily-processing] Failed — ${msg}`);
      errors.push(msg);
      failedIds.push(idea.id);
    }
  }

  const total = ideas.length;
  const processed = processedIds.length;
  const failed = failedIds.length;

  logger.info(`[daily-processing] Complete — ${processed}/${total} processed, ${failed} failed`);

  return {
    agentId: "daily-processing",
    phase: "notion",
    // "Needs Review" outcomes are handled inside categorizeIdea — not failures here
    success: failed === 0,
    durationMs: Date.now() - start,
    results: { total, processed, failed, processedIds, failedIds },
    errors,
  };
}

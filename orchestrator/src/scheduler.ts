import "dotenv/config";
import cron from "node-cron";
import { randomUUID } from "crypto";
import { runDailyProcessing } from "./pipelines/daily-processing.js";
import { PlannerAgent } from "./agents/planner-agent.js";
import { ValidationAgent } from "./agents/validation-agent.js";
import { WorkflowContext } from "./context/workflow-context.js";
import { withRetry } from "./workflow.js";
import { logger } from "./logger.js";

/**
 * Starts the node-cron scheduler.
 * Fires the daily workflow at 09:00 America/New_York.
 * The cron timer keeps the event loop alive — no explicit keep-alive needed.
 */
export function startScheduler(): void {
  cron.schedule(
    "0 9 * * *",
    () => {
      runDailyWorkflow().catch((err) => {
        logger.error(`[scheduler] Daily workflow crashed unexpectedly: ${String(err)}`);
      });
    },
    { timezone: "America/New_York" }
  );

  logger.info("[scheduler] Daily workflow scheduled — 09:00 America/New_York");
  logger.info("[scheduler] Process is running. Press Ctrl+C to stop.");
}

/**
 * Orchestrates the full daily multi-agent run:
 *
 *   daily-processing pipeline  (Layer 2: use case, uses NotionAgent as tool)
 *   → PlannerAgent             (AI agent, stub — full logic in a later phase)
 *   → ValidationAgent          (AI agent, assesses overall run quality)
 *
 * Each phase result is recorded in WorkflowContext so downstream agents
 * can inspect what prior phases produced.
 */
async function runDailyWorkflow(): Promise<void> {
  const date = new Date().toISOString().slice(0, 10);
  const workflowId = `daily-${date}-${randomUUID().slice(0, 8)}`;
  const context = new WorkflowContext(workflowId);

  logger.info(`\n${"=".repeat(60)}`);
  logger.info(`[scheduler] Starting daily workflow`);
  logger.info(`[scheduler] workflowId: ${workflowId}`);
  logger.info(`[scheduler] contextId:  ${context.contextId}`);
  logger.info("=".repeat(60));

  // ── Phase 1: Daily processing pipeline ───────────────────────
  // NotionAgent (capability layer) is used inside this pipeline —
  // the scheduler never calls NotionAgent directly.
  const notionResult = await withRetry(
    () => runDailyProcessing(),
    { label: "DAILY_PROCESSING", maxAttempts: 2, backoffMs: 2000 }
  );
  context.recordPhaseResult("notion", notionResult);

  if (!notionResult.success) {
    logger.error("[scheduler] Daily processing failed — aborting run");
    if (notionResult.errors.length > 0) {
      logger.json("[scheduler] Errors", notionResult.errors);
    }
    return;
  }

  // ── Phase 2: Planner (stub) ───────────────────────────────────
  const plannerResult = await withRetry(
    () =>
      new PlannerAgent().execute({
        workflowId,
        contextId: context.contextId,
        parameters: { notionResults: notionResult.results },
      }),
    { label: "PLANNER_AGENT", maxAttempts: 2, backoffMs: 2000 }
  );
  context.recordPhaseResult("planner", plannerResult);

  // ── Phase 3: Validation ───────────────────────────────────────
  const validationResult = await withRetry(
    () =>
      new ValidationAgent().execute({
        workflowId,
        contextId: context.contextId,
        parameters: { phaseResults: context.getAll() },
      }),
    { label: "VALIDATION_AGENT", maxAttempts: 2, backoffMs: 2000 }
  );
  context.recordPhaseResult("validation", validationResult);

  // ── Summary ───────────────────────────────────────────────────
  const summary = context.toSummary();
  logger.info(`\n[scheduler] Daily workflow complete`);
  logger.json("[scheduler] Summary", summary);
}

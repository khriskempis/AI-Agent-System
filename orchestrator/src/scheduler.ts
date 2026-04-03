import "dotenv/config";
import cron from "node-cron";
import { randomUUID } from "crypto";
import { runDailyProcessing } from "./pipelines/daily-processing.js";
import { ValidationAgent } from "./agents/validation-agent.js";
import { WorkflowContext } from "./context/workflow-context.js";
import { withRetry } from "./workflow.js";
import { logger } from "./logger.js";

/**
 * Starts the node-cron scheduler.
 * Fires the daily categorization workflow at 09:00 America/New_York.
 *
 * Planning is a separate, user-triggered path:
 *   npx tsx src/index.ts plan-idea --all
 *   npx tsx src/index.ts plan-idea --id <page-id>
 *
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

  logger.info("[scheduler] Daily categorization scheduled — 09:00 America/New_York");
  logger.info("[scheduler] Planning runs separately: npx tsx src/index.ts plan-idea --all");
  logger.info("[scheduler] Process is running. Press Ctrl+C to stop.");
}

/**
 * Daily categorization workflow:
 *
 *   Phase 1: runDailyProcessing()  — fetches "Not started" ideas from Notion,
 *                                    classifies each, routes to projects/journal/knowledge DB
 *   Phase 2: ValidationAgent       — structural QA of phase 1 results
 *
 * Planning (plan-idea pipeline) is intentionally excluded — it runs only on
 * projects the user has explicitly marked "Ready for Planning".
 */
async function runDailyWorkflow(): Promise<void> {
  const date = new Date().toISOString().slice(0, 10);
  const workflowId = `daily-${date}-${randomUUID().slice(0, 8)}`;
  const context = new WorkflowContext(workflowId);

  logger.info(`\n${"=".repeat(60)}`);
  logger.info(`[scheduler] Starting daily categorization workflow`);
  logger.info(`[scheduler] workflowId: ${workflowId}`);
  logger.info(`[scheduler] contextId:  ${context.contextId}`);
  logger.info("=".repeat(60));

  // ── Phase 1: Categorization ───────────────────────────────────
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

  // ── Phase 2: Validation ───────────────────────────────────────
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
  logger.info(`\n[scheduler] Daily workflow complete`);
  logger.json("[scheduler] Summary", context.toSummary());
}

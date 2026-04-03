import { NotionAgent } from "../agents/notion-agent.js";
import type { ProjectPage } from "../notion-client.js";
import { ask } from "../models/ollama.js";
import { logger } from "../logger.js";
import { withRetry } from "../workflow.js";
import {
  createRun,
  isRunning,
  updateRunStage,
  completeRun,
  logEvent,
} from "../db/workflow-store.js";

// ─── Prompts ──────────────────────────────────────────────────────────────────

/**
 * Produces an agent-executable implementation plan for a new project.
 * Output MUST begin with "# Plan - <short plan name>" so future runs can detect it.
 *
 * The plan is designed to be handed directly to Claude Code agents — each phase
 * maps to a specific agent, includes concrete steps/commands/file paths, and
 * explicitly marks where human input is required before work can continue.
 */
const SYSTEM_PROMPT_FIRST_RUN = `You are a senior software architect producing an executable implementation plan for a Claude Code agent team.
The plan will be handed directly to AI coding agents to execute, with the human available for decisions and reviews.

Start your response with exactly: # Plan - <short descriptive name>

Then produce the following sections:

## Objective
One sentence: what this project accomplishes and for whom.

## Tech Stack
Bulleted list of languages, frameworks, key libraries, and infrastructure. Be specific — no vague entries like "backend framework". State the actual choice and one-line rationale.

## Phases
Break the work into 2-5 sequential phases. For each phase:

### Phase N: <Name>
**Goal**: One sentence.
**Agent**: Which agent executes this (e.g. typescript-pipeline-engineer, notion-api-engineer, devops-engineer).
**Requires human**: List any decisions or approvals needed before this phase can start. Write "None" if fully autonomous.

Steps:
1. Concrete step with file paths, commands, or API calls where relevant
2. ...

**Done when**: Specific, testable acceptance criteria (not vague like "it works").

## Human Checkpoints
Numbered list of all points where the human must review or decide before work continues. Reference the phase each checkpoint belongs to.

## Open Questions
Bulleted list of unresolved technical or product questions that will affect implementation. Flag any that block Phase 1.

Be concrete and opinionated. If the idea is underspecified, state your assumption explicitly. Output clean markdown only.`;

/**
 * Used on re-run: plan header detected, user has added feedback below the existing plan.
 * Revises the plan to incorporate feedback while keeping the same executable structure.
 */
const SYSTEM_PROMPT_REVISION = `You are a senior software architect revising an executable implementation plan based on developer feedback.
The page body contains a previous plan (starting with "# Plan - ...") followed by feedback or comments the developer added below it.

Start your response with exactly: # Plan - <short descriptive name>

Revise the plan to address the feedback, keeping all sections: Objective, Tech Stack, Phases, Human Checkpoints, Open Questions.
Each phase must still specify: Goal, Agent, Requires human, Steps, Done when.
If the feedback does not affect a section, carry it forward unchanged.
If no new feedback is present, lightly tighten the plan without changing its substance.
Output clean markdown only; do not add meta-commentary.`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * A plan exists if the page body starts with "# Plan" (case-insensitive).
 * This is the standard marker written by the plan-idea pipeline on every run.
 * Avoids false positives from categorization descriptions that may be long.
 */
function hasPriorPlan(page: ProjectPage): boolean {
  return page.content.trimStart().toLowerCase().startsWith("# plan");
}

function buildUserMessage(page: ProjectPage): string {
  const contentSection = page.content.trim()
    ? `## Page Content\n\n${page.content.trim()}`
    : "## Page Content\n\n(none — develop from the title alone)";

  return `# ${page.title}\n\n${contentSection}`;
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

export interface PipelineOptions {
  dryRun?: boolean;
}

export async function planIdea(
  pageId: string,
  options: PipelineOptions = {}
): Promise<void> {
  // Idempotency guard — skip if a run is already active for this page
  if (await isRunning(pageId)) {
    logger.warn(`[plan-idea] Run already active for project page ${pageId} — skipping`);
    return;
  }

  const runId = await createRun("plan-idea", pageId);
  logger.info(`[plan-idea] Started run ${runId}`);

  if (options.dryRun) {
    logger.info("--- DRY RUN MODE --- (no writes to Notion)");
  }

  try {
    // ─── STAGE 1: FETCH ───────────────────────────────────────────────────────
    logger.stage("FETCH", `Fetching project page: ${pageId}`);
    await logEvent(runId, "FETCH", "STARTED", 1);
    const fetchStart = Date.now();

    const notion = new NotionAgent();
    const page = await withRetry(() => notion.getProjectPage(pageId), { label: "FETCH" });
    const isRevision = hasPriorPlan(page);

    await logEvent(runId, "FETCH", "COMPLETED", 1, { title: page.title, isRevision }, undefined, Date.now() - fetchStart);
    await updateRunStage(runId, "FETCH", { fetch: { id: pageId, title: page.title, isRevision } });
    logger.success(`Fetched: "${page.title}" (${isRevision ? "revision run" : "first plan"})`);

    // ─── STAGE 2: PLAN ────────────────────────────────────────────────────────
    logger.stage("PLAN", isRevision ? "Revising existing plan" : "Generating project plan");
    await logEvent(runId, "PLAN", "STARTED", 1);
    const planStart = Date.now();

    const systemPrompt = isRevision ? SYSTEM_PROMPT_REVISION : SYSTEM_PROMPT_FIRST_RUN;
    const userMessage = buildUserMessage(page);

    let plan: string;
    try {
      plan = await withRetry(
        () => ask("deepseek-r1:14b", systemPrompt, userMessage),
        { label: "PLAN" }
      );
      await logEvent(runId, "PLAN", "COMPLETED", 1, { length: plan.length, isRevision }, undefined, Date.now() - planStart);
    } catch (err) {
      await logEvent(runId, "PLAN", "FAILED", 1, undefined, String(err), Date.now() - planStart);
      throw err;
    }

    await updateRunStage(runId, "PLAN", { plan: { length: plan.length, isRevision } });
    logger.success(`Plan generated (${plan.length} chars)`);

    // ─── STAGE 3: WRITE ───────────────────────────────────────────────────────
    logger.stage("WRITE", 'Writing plan to project page, status → "Pending Review"');
    await logEvent(runId, "WRITE", "STARTED", 1);
    const writeStart = Date.now();

    if (options.dryRun) {
      logger.info("[dry-run] Would write plan:");
      logger.info(plan.slice(0, 300) + (plan.length > 300 ? "\n...(truncated)" : ""));
      logger.info('[dry-run] Would set status: "Pending Review"');
      await logEvent(runId, "WRITE", "COMPLETED", 1, { dryRun: true }, undefined, Date.now() - writeStart);
    } else {
      try {
        await withRetry(
          () => notion.updateProjectPage(pageId, {
            content: plan,
            status: "Pending Review",
          }),
          { label: "WRITE" }
        );
        await logEvent(runId, "WRITE", "COMPLETED", 1, { written: true }, undefined, Date.now() - writeStart);
        logger.success(`Project page "${page.title}" updated — status set to "Pending Review"`);
      } catch (err) {
        await logEvent(runId, "WRITE", "FAILED", 1, undefined, String(err), Date.now() - writeStart);
        throw err;
      }
    }

    await completeRun(runId, "COMPLETED");
    logger.info(`[plan-idea] Run ${runId} completed`);
  } catch (err) {
    await completeRun(runId, "FAILED");
    logger.info(`[plan-idea] Run ${runId} failed`);
    throw err;
  }
}

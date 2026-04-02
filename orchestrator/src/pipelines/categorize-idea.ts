import { getIdea, updateIdea, type NotionIdea } from "../notion-client.js";
import { parseIdeas } from "../parser.js";
import { classifyIdeas, evaluateQA, type ClassifyResult, type RoutingDestination } from "../agents/director.js";
import { validateClassification } from "../agents/validator.js";
import { NotionAgent } from "../agents/notion-agent.js";
import { logger } from "../logger.js";
import { withRetry } from "../workflow.js";
import {
  createRun,
  isRunning,
  updateRunStage,
  completeRun,
  logEvent,
} from "../db/workflow-store.js";

const MAX_RETRIES = 2;

export interface PipelineOptions {
  dryRun?: boolean;
}

export async function categorizeIdea(
  id: string,
  options: PipelineOptions = {}
): Promise<void> {
  // Idempotency guard — prevent two runs processing the same page simultaneously
  if (await isRunning(id)) {
    logger.warn(`[workflow] Run already active for Notion page ${id} — skipping`);
    return;
  }

  const runId = await createRun("categorize-idea", id);
  logger.info(`[workflow] Started run ${runId}`);

  try {
    // ─── STAGE 1: FETCH ───────────────────────────────────────────────────────
    logger.stage("FETCH", `Fetching Notion page: ${id}`);
    await logEvent(runId, "FETCH", "STARTED", 1);
    const fetchStart = Date.now();

    const idea = await withRetry(() => getIdea(id), { label: "FETCH" });

    await logEvent(runId, "FETCH", "COMPLETED", 1, { name: idea.name, status: idea.status }, undefined, Date.now() - fetchStart);
    await updateRunStage(runId, "FETCH", { fetch: { id: idea.id, name: idea.name, status: idea.status } });
    logger.success(`Fetched: "${idea.name}" (status: ${idea.status})`);

    // ─── STAGE 2: PARSE ───────────────────────────────────────────────────────
    logger.stage("PARSE", "Parsing ideas from page content");
    await logEvent(runId, "PARSE", "STARTED", 1);
    const parseStart = Date.now();

    const parsedIdeas = parseIdeas(idea.content);

    await logEvent(runId, "PARSE", "COMPLETED", 1, { count: parsedIdeas.length }, undefined, Date.now() - parseStart);
    await updateRunStage(runId, "PARSE", { parse: parsedIdeas });
    logger.success(`Parsed ${parsedIdeas.length} idea(s)`);
    parsedIdeas.forEach((p, i) => {
      logger.info(`${i + 1}. ${p.text}${p.link ? ` → ${p.link}` : ""}`);
    });

    // ─── STAGES 3-5: CLASSIFY → VALIDATE → EVALUATE (QA loop) ───────────────
    let classifyResult: ClassifyResult | null = null;
    let attempts = 0;

    while (attempts < MAX_RETRIES) {
      attempts++;

      // CLASSIFY
      logger.stage("CLASSIFY", `Classifying ideas (attempt ${attempts}/${MAX_RETRIES})`);
      await logEvent(runId, "CLASSIFY", "STARTED", attempts);
      const classifyStart = Date.now();
      try {
        classifyResult = await withRetry(() => classifyIdeas(parsedIdeas), { label: "CLASSIFY" });
        await logEvent(runId, "CLASSIFY", "COMPLETED", attempts, classifyResult, undefined, Date.now() - classifyStart);
      } catch (err) {
        await logEvent(runId, "CLASSIFY", "FAILED", attempts, undefined, String(err), Date.now() - classifyStart);
        throw err;
      }
      logger.json("Classification", classifyResult);

      // VALIDATE
      logger.stage("VALIDATE", "Validating classification");
      await logEvent(runId, "VALIDATE", "STARTED", attempts);
      const validateStart = Date.now();
      let validation;
      try {
        validation = await withRetry(
          () => validateClassification(parsedIdeas, classifyResult!),
          { label: "VALIDATE" }
        );
        await logEvent(runId, "VALIDATE", "COMPLETED", attempts, validation, undefined, Date.now() - validateStart);
      } catch (err) {
        await logEvent(runId, "VALIDATE", "FAILED", attempts, undefined, String(err), Date.now() - validateStart);
        throw err;
      }
      logger.json("Validation", validation);

      // EVALUATE
      logger.stage("EVALUATE", "Evaluating QA result");
      await logEvent(runId, "EVALUATE", "STARTED", attempts);
      const evaluateStart = Date.now();
      let evaluation;
      try {
        evaluation = await withRetry(
          () => evaluateQA(parsedIdeas, classifyResult!, validation.score, validation.feedback),
          { label: "EVALUATE" }
        );
        await logEvent(runId, "EVALUATE", "COMPLETED", attempts, evaluation, undefined, Date.now() - evaluateStart);
      } catch (err) {
        await logEvent(runId, "EVALUATE", "FAILED", attempts, undefined, String(err), Date.now() - evaluateStart);
        throw err;
      }
      logger.json("Evaluation", evaluation);

      await updateRunStage(runId, "EVALUATE", { classify: classifyResult, attempts });

      if (evaluation.accepted) {
        logger.success(`Accepted after ${attempts} attempt(s)`);
        break;
      }

      logger.warn(`Rejected: ${evaluation.reason}`);

      if (attempts >= MAX_RETRIES) {
        logger.warn("Max retries reached — marking as Needs Review");
        await writeResult(idea, null, parsedIdeas.length, options);
        await completeRun(runId, "NEEDS_REVIEW");
        return;
      }
    }

    // ─── STAGE 6: WRITE ───────────────────────────────────────────────────────
    await writeResult(idea, classifyResult!, parsedIdeas.length, options);
    await completeRun(runId, "COMPLETED");
    logger.info(`[workflow] Run ${runId} completed`);
  } catch (err) {
    await completeRun(runId, "FAILED");
    logger.info(`[workflow] Run ${runId} failed`);
    throw err;
  }
}

const DESTINATION_DB: Record<RoutingDestination, string | undefined> = {
  projects: process.env.NOTION_PROJECTS_DATABASE_ID,
  knowledge: process.env.NOTION_KNOWLEDGE_DATABASE_ID,
  journal: process.env.NOTION_JOURNAL_DATABASE_ID,
};

async function writeResult(
  idea: NotionIdea,
  classifyResult: ClassifyResult | null,
  ideaCount: number,
  options: PipelineOptions
): Promise<void> {
  if (classifyResult === null) {
    logger.stage("WRITE", "Writing Needs Review status");
    if (!options.dryRun) {
      await updateIdea(idea.id, { status: "Needs Review" });
    } else {
      logger.info("[dry-run] Would set status: Needs Review");
    }
    return;
  }

  logger.stage("WRITE", `Routing ${classifyResult.length} idea(s) to destination tables`);

  const notionAgent = new NotionAgent();

  // Route each classified idea to its destination database
  for (const classification of classifyResult) {
    const dbId = DESTINATION_DB[classification.destination];
    if (!dbId) {
      logger.warn(`No database ID configured for destination "${classification.destination}" — skipping idea: "${classification.text.slice(0, 60)}"`);
      continue;
    }

    const content = classification.text;

    if (options.dryRun) {
      logger.info(`[dry-run] Would create page in ${classification.destination} (${dbId.slice(0, 8)}...): "${classification.text.slice(0, 60)}"`);
      logger.json("classification", { destination: classification.destination, tags: classification.tags, reasoning: classification.reasoning });
      continue;
    }

    try {
      const created = await notionAgent.createPage(dbId, classification.text, content, classification.tags);
      logger.success(`Created in ${classification.destination}: "${classification.text.slice(0, 60)}" → ${created.url}`);
    } catch (err) {
      logger.warn(`Failed to create page in ${classification.destination}: ${String(err)}`);
    }
  }

  // Collect all tags from across all classifications and merge with existing
  const allNewTags = [...new Set(classifyResult.flatMap((c) => c.tags))];
  const existingTags = new Set(idea.tags);
  const mergedTags = [...idea.tags, ...allNewTags.filter((t) => !existingTags.has(t))];

  const sourcePayload = {
    tags: mergedTags,
    howManyIdeas: ideaCount,
    status: "Done" as const,
  };

  if (options.dryRun) {
    logger.info("[dry-run] Would update source idea:");
    logger.json("sourcePayload", sourcePayload);
    return;
  }

  await updateIdea(idea.id, sourcePayload);
  logger.success(`Source idea marked Done: tags=${mergedTags.join(", ")}, howManyIdeas=${ideaCount}`);
}

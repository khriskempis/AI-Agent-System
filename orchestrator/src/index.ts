import "dotenv/config";
import { categorizeIdea } from "./pipelines/categorize-idea.js";
import { planIdea } from "./pipelines/plan-idea.js";
import { getAllUnprocessedIdeas } from "./notion-client.js";
import { NotionAgent } from "./agents/notion-agent.js";
import { logger } from "./logger.js";

function parseArgs(argv: string[]): {
  pipeline: string | null;
  id: string | null;
  all: boolean;
  dryRun: boolean;
} {
  const args = argv.slice(2);
  const pipeline = args[0] ?? null;
  const id = args.includes("--id") ? args[args.indexOf("--id") + 1] : null;
  const all = args.includes("--all");
  const dryRun = args.includes("--dry-run");
  return { pipeline, id, all, dryRun };
}

async function main(): Promise<void> {
  const { pipeline, id, all, dryRun } = parseArgs(process.argv);

  if (pipeline === "categorize-idea") {
    if (dryRun) {
      logger.info("--- DRY RUN MODE --- (no writes to Notion)");
    }

    if (id) {
      await categorizeIdea(id, { dryRun });
    } else if (all) {
      logger.info("Fetching all unprocessed ideas...");
      const ideas = await getAllUnprocessedIdeas();
      logger.info(`Found ${ideas.length} idea(s) with status Not Started`);

      for (const idea of ideas) {
        console.log(`\n${"=".repeat(60)}`);
        console.log(`Processing: ${idea.title} (${idea.id})`);
        console.log("=".repeat(60));
        await categorizeIdea(idea.id, { dryRun });
      }
    } else {
      console.error("Usage:");
      console.error("  npx tsx src/index.ts categorize-idea --id <notion-page-id>");
      console.error("  npx tsx src/index.ts categorize-idea --all");
      console.error("  npx tsx src/index.ts categorize-idea --id <id> --dry-run");
      process.exit(1);
    }
  } else if (pipeline === "plan-idea") {
    if (id) {
      await planIdea(id, { dryRun });
    } else if (all) {
      logger.info('Fetching all projects with status "Ready for Planning"...');
      const notion = new NotionAgent();
      const projects = await notion.getReadyForPlanningProjects();
      logger.info(`Found ${projects.length} project(s) ready for planning`);

      for (const project of projects) {
        console.log(`\n${"=".repeat(60)}`);
        console.log(`Planning: ${project.title} (${project.id})`);
        console.log("=".repeat(60));
        await planIdea(project.id, { dryRun });
      }
    } else {
      console.error("Usage:");
      console.error("  npx tsx src/index.ts plan-idea --id <notion-page-id>");
      console.error("  npx tsx src/index.ts plan-idea --all");
      console.error("  npx tsx src/index.ts plan-idea --id <id> --dry-run");
      process.exit(1);
    }
  } else if (pipeline === "embed-tiktok") {
    const { runTiktokEmbedding } = await import("./pipelines/embed-tiktok.js");
    const { closeTiktokDb } = await import("./tiktok-client.js");

    const argv = process.argv;
    const limitIdx = argv.indexOf("--limit");
    const limit   = limitIdx !== -1 ? Number(argv[limitIdx + 1]) : undefined;
    const reindex = argv.includes("--reindex");

    await runTiktokEmbedding({ limit, reindex });
    await closeTiktokDb();
  } else if (pipeline === "analyze-tiktok") {
    const { runTiktokAnalysis } = await import("./pipelines/analyze-tiktok.js");
    const { closeTiktokDb } = await import("./tiktok-client.js");

    const argv = process.argv;
    const limitIdx = argv.indexOf("--limit");
    const limit = limitIdx !== -1 ? Number(argv[limitIdx + 1]) : undefined;

    if (!id && !all && !limit) {
      console.error("Usage:");
      console.error("  npx tsx src/index.ts analyze-tiktok --id <video_id>");
      console.error("  npx tsx src/index.ts analyze-tiktok --limit 50");
      console.error("  npx tsx src/index.ts analyze-tiktok --all");
      process.exit(1);
    }

    await runTiktokAnalysis({ id: id ?? undefined, limit, all });
    await closeTiktokDb();
  } else if (pipeline === "queue-tiktok") {
    const { runQueueTiktok } = await import("./pipelines/queue-tiktok.js");
    const { closeTiktokDb } = await import("./tiktok-client.js");

    const argv = process.argv;
    const idsIdx      = argv.indexOf("--ids");
    const fileIdx     = argv.indexOf("--file");
    const authorIdx   = argv.indexOf("--author");
    const minPlaysIdx = argv.indexOf("--min-plays");

    await runQueueTiktok({
      id:        id ?? undefined,
      ids:       idsIdx      !== -1 ? argv[idsIdx + 1]                : undefined,
      file:      fileIdx     !== -1 ? argv[fileIdx + 1]               : undefined,
      bookmarked: argv.includes("--bookmarked"),
      liked:     argv.includes("--liked"),
      author:    authorIdx   !== -1 ? argv[authorIdx + 1]             : undefined,
      minPlays:  minPlaysIdx !== -1 ? Number(argv[minPlaysIdx + 1])   : undefined,
      list:      argv.includes("--list"),
      stats:     argv.includes("--stats"),
    });
    await closeTiktokDb();
  } else if (pipeline === "scheduler") {
    const { startScheduler } = await import("./scheduler.js");
    startScheduler();
    // node-cron keeps the event loop alive — process stays running until Ctrl+C
  } else {
    console.error(`Unknown pipeline: "${pipeline}"`);
    console.error("Available pipelines: categorize-idea, plan-idea, queue-tiktok, analyze-tiktok, embed-tiktok, scheduler");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

# Daily Processing

## How It Works

The orchestrator runs a `node-cron` scheduler that fires at **09:00 America/New_York** every day. The scheduler is the Layer 3 director — it decides what pipelines to run and chains them together.

```
node-cron (09:00 ET)
  └─ runDailyWorkflow()
       ├─ Phase 1: runDailyProcessing()   ← Layer 2 pipeline
       │    ├─ NotionAgent.getAllUnprocessed()  ← Layer 1 tool
       │    └─ categorizeIdea(id) per idea     ← Layer 2 pipeline
       ├─ Phase 2: PlannerAgent.execute()
       └─ Phase 3: ValidationAgent.execute()
```

Each phase result is stored in `WorkflowContext` so downstream agents can inspect what prior phases produced.

## Starting the Scheduler

```bash
# Via Docker (production)
docker-compose up -d orchestrator

# Locally (development)
cd orchestrator
npm start                    # compiles + runs scheduler
# or
npx tsx src/index.ts scheduler
```

The process stays alive — `node-cron` keeps the event loop running. Press `Ctrl+C` to stop.

## Running a Manual One-Off

```bash
cd orchestrator

# Process a single idea by Notion page ID
npx tsx src/index.ts categorize-idea --id <notion-page-id>

# Process all unprocessed ideas (status = "Not Started") right now
npx tsx src/index.ts categorize-idea --all

# Dry-run — fetch and classify but don't write back to Notion
npx tsx src/index.ts categorize-idea --id <notion-page-id> --dry-run
```

## Pipeline Stages

The `categorizeIdea` pipeline runs these stages in order:

| Stage | What it does |
|---|---|
| FETCH | Load the idea page from Notion via `NotionAgent.getIdea()` |
| PARSE | Extract title, description, tags from raw Notion properties |
| CLASSIFY | Ask Claude to assign a category (Projects / Knowledge / Journal) |
| VALIDATE | Ask Claude to verify the classification is well-reasoned |
| EVALUATE | Check if the classification passes quality bar; loop if not |
| WRITE | Call `NotionAgent.updateIdea()` to write tags + status back to Notion |

The CLASSIFY → VALIDATE → EVALUATE loop retries up to `MAX_RETRIES = 2` times before setting status to "Needs Review".

## Retry Behavior

Each stage is wrapped with `withRetry()`:

```
withRetry(fn, { maxAttempts: 3, backoffMs: 1000 })
```

Retries use exponential backoff: 1s, 2s, 3s. Retries are per-stage — a failed VALIDATE does not restart from FETCH.

The scheduler wraps each phase with `maxAttempts: 2, backoffMs: 2000`.

## Idempotency

Before starting, `categorizeIdea` checks `isRunning(notionPageId)` against MySQL. If a run is already in progress for that page ID, it skips — preventing duplicate processing if the scheduler fires twice.

## Inspecting Run History

```bash
docker exec -it orchestrator-mysql mysql -u orchestrator -porchestrator orchestrator

-- What ran today?
SELECT notion_page_name, status, current_stage, started_at
FROM workflow_runs
WHERE DATE(started_at) = CURDATE()
ORDER BY started_at DESC;

-- Detailed events for a run
SELECT stage, status, attempt, duration_ms, error_message
FROM workflow_events
WHERE run_id = '<run-id>'
ORDER BY id;
```

## Changing the Schedule

The cron expression is in `orchestrator/src/scheduler.ts`:

```typescript
cron.schedule(
  "0 9 * * *",          // 09:00 daily
  () => { runDailyWorkflow()... },
  { timezone: "America/New_York" }
);
```

Change the first argument to any valid cron expression. Common alternatives:

| Goal | Cron expression |
|---|---|
| Every day at 6 AM ET | `0 6 * * *` |
| Weekdays only, 9 AM ET | `0 9 * * 1-5` |
| Every Monday at 7 AM ET | `0 7 * * 1` |

# Orchestrator Setup

The orchestrator is a TypeScript process that runs a daily multi-agent pipeline: it fetches unprocessed ideas from Notion, runs each through Claude for categorization, then hands off to a planner and validation agent. Results are recorded in MySQL.

## Prerequisites

- Node.js 18+
- Docker (for MySQL and notion-idea-server-http)
- An Anthropic API key
- A configured `notion-idea-server` with Notion credentials

## Environment Variables

Create `orchestrator/.env`:

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...

# Notion HTTP API — use localhost when running orchestrator locally,
# or the Docker service name when running in Docker
NOTION_API_URL=http://localhost:3001

# MySQL — omit entirely to run without audit logging
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=orchestrator
MYSQL_PASSWORD=orchestrator
MYSQL_DATABASE=orchestrator
```

## Running Locally

```bash
# 1. Start the Notion HTTP API
docker-compose --profile dev up -d notion-idea-server-http-dev

# 2. (Optional) Start MySQL
docker-compose up -d mysql

# 3. Install dependencies
cd orchestrator && npm install

# 4. Compile TypeScript
npm run build

# 5. Run a pipeline
npx tsx src/index.ts categorize-idea --id <notion-page-id> --dry-run
```

## CLI Commands

```bash
# Categorize a specific idea (by Notion page ID)
npx tsx src/index.ts categorize-idea --id <notion-page-id>

# Dry-run — classify but don't write back to Notion
npx tsx src/index.ts categorize-idea --id <notion-page-id> --dry-run

# Process all ideas with status "Not Started"
npx tsx src/index.ts categorize-idea --all

# Start the daily scheduler (fires at 09:00 America/New_York)
npx tsx src/index.ts scheduler
# or after build:
npm start
```

## Running in Docker

The orchestrator is included in `docker-compose.yml`:

```bash
# Build and start everything
./scripts/start-full-project.sh

# Or start just the orchestrator and its dependencies
docker-compose up -d mysql notion-idea-server-http orchestrator

# Follow logs
docker-compose logs -f orchestrator
```

The container runs `node dist/index.js scheduler` — the daily cron fires at 09:00 ET.

Docker service dependencies:
- Waits for `mysql` healthcheck before starting
- Waits for `notion-idea-server-http` to be started

## MySQL Schema

The schema is auto-loaded on first MySQL container startup from `orchestrator/src/db/schema.sql`.

**`workflow_runs`** — one row per pipeline execution:
| Column | Type | Description |
|---|---|---|
| `id` | UUID | Run ID (used to correlate events) |
| `pipeline` | varchar | Pipeline name (`categorize-idea`) |
| `notion_page_id` | varchar | Notion page being processed |
| `notion_page_name` | varchar | Human-readable page title |
| `status` | ENUM | `running`, `completed`, `failed`, `needs_review` |
| `current_stage` | varchar | Last stage reached |
| `attempts` | int | Total retry count |
| `stage_results` | JSON | Output from each stage |
| `started_at` | datetime | When the run started |
| `completed_at` | datetime | When it finished (null if still running) |

**`workflow_events`** — immutable audit log, one row per stage execution:
| Column | Type | Description |
|---|---|---|
| `id` | auto-increment | Event ordering key |
| `run_id` | UUID FK | Links to `workflow_runs.id` |
| `stage` | varchar | Stage name (FETCH, CLASSIFY, etc.) |
| `status` | ENUM | `started`, `completed`, `failed` |
| `attempt` | int | Which retry attempt |
| `result` | JSON | Stage output |
| `error_message` | text | Error if failed |
| `duration_ms` | int | How long the stage took |
| `created_at` | datetime | Event timestamp |

## Useful MySQL Queries

```sql
-- Recent runs with status
SELECT notion_page_name, status, current_stage, attempts, started_at
FROM workflow_runs ORDER BY started_at DESC LIMIT 20;

-- Detailed stage trace for a run
SELECT stage, status, attempt, duration_ms, error_message
FROM workflow_events WHERE run_id = '<run-id>' ORDER BY id;

-- Ideas that need manual review (failed QA loop)
SELECT notion_page_name, attempts, updated_at
FROM workflow_runs WHERE status = 'needs_review';

-- Average time per stage across all runs
SELECT stage, ROUND(AVG(duration_ms)) AS avg_ms, COUNT(*) AS count
FROM workflow_events WHERE status = 'completed'
GROUP BY stage ORDER BY avg_ms DESC;
```

## Troubleshooting

**`NOTION_API_URL` not reachable**
Run `./scripts/sync-agent-configs.sh` to check connectivity. Make sure `notion-idea-server-http` is up.

**MySQL connection refused**
Either start the MySQL container (`docker-compose up -d mysql`) or remove `MYSQL_HOST` from `.env` to run without audit logging.

**Ideas not appearing in `getAllUnprocessed()`**
Check that the Notion status property value is exactly `"Not Started"`. See [Notion Property Fix](../troubleshooting/NOTION_PROPERTY_FIX.md).

**Run stuck in `running` status**
A previous run crashed without updating its status. Run:
```sql
UPDATE workflow_runs SET status = 'failed', completed_at = NOW()
WHERE status = 'running' AND started_at < DATE_SUB(NOW(), INTERVAL 1 HOUR);
```

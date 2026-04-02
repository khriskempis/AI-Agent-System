# Testing

## Quick Health Check

```bash
# Verify all services are up and orchestrator can run
./scripts/sync-agent-configs.sh
```

## Testing the Notion HTTP API

The Notion server exposes a REST API on port 3001. Start it first:

```bash
docker-compose up -d notion-idea-server-http
# or dev mode with hot reload:
docker-compose --profile dev up -d notion-idea-server-http-dev
```

Then test with curl:

```bash
# Health
curl http://localhost:3001/health

# List unprocessed ideas
curl "http://localhost:3001/api/ideas?status=Not%20Started"

# Get a single idea
curl http://localhost:3001/api/ideas/<notion-page-id>

# Get idea content (raw blocks)
curl http://localhost:3001/api/ideas/<notion-page-id>/content

# Update idea status
curl -X PUT http://localhost:3001/api/ideas/<notion-page-id> \
  -H "Content-Type: application/json" \
  -d '{"status": "In Progress"}'

# Summary counts by status
curl http://localhost:3001/api/ideas/summary
```

See [API Endpoints](../docs/setup/API_ENDPOINTS.md) for the full reference.

## Testing the Orchestrator

### Dry-run a single idea (no writes to Notion)

```bash
cd orchestrator
npx tsx src/index.ts categorize-idea --id <notion-page-id> --dry-run
```

### Process a single idea end-to-end

```bash
cd orchestrator
npx tsx src/index.ts categorize-idea --id <notion-page-id>
```

### Process all unprocessed ideas once

```bash
cd orchestrator
npx tsx src/index.ts categorize-idea --all
```

### Start the full scheduler (fires at 09:00 ET)

```bash
cd orchestrator
npm start
```

## Inspecting MySQL Audit Log

```bash
docker exec -it orchestrator-mysql mysql -u orchestrator -porchestrator orchestrator

-- Recent runs
SELECT notion_page_name, status, current_stage, attempts, started_at
FROM workflow_runs
ORDER BY started_at DESC
LIMIT 20;

-- Events for a specific run (full stage trace)
SELECT stage, status, attempt, duration_ms, error_message
FROM workflow_events
WHERE run_id = '<run-id>'
ORDER BY id;

-- Ideas that landed in "Needs Review" (failed QA loop)
SELECT notion_page_name, attempts, updated_at
FROM workflow_runs
WHERE status = 'needs_review';

-- Average duration per pipeline stage
SELECT stage, AVG(duration_ms) AS avg_ms, COUNT(*) AS count
FROM workflow_events
WHERE status = 'completed'
GROUP BY stage
ORDER BY avg_ms DESC;
```

## Testing the Director MCP Server

The director server communicates over stdio. Use the MCP inspector:

```bash
npx @modelcontextprotocol/inspector stdio "node director-mcp-server/dist/index.js"
```

Available tools to test: `get_workflow_template`, `create_agent_instructions`, `create_workflow_context`, `get_system_stats`.

## Test Data

Sample Notion page IDs and database IDs are in `example-data/`. These reference real Notion resources — make sure your `.env` has a valid API token before running against them.

## Postman Collections

Pre-built collections for the Notion HTTP API are in `postman-collections/`. Import into Postman and set the `base_url` variable to `http://localhost:3001`.

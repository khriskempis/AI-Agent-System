# Testing vs Production Environment

## Environment Differences

| Config | Local Dev | Docker Production |
|---|---|---|
| `NOTION_API_URL` | `http://localhost:3001` | `http://notion-idea-server-http:3001` |
| `MYSQL_HOST` | `localhost` (or unset — history disabled) | `mysql` |
| `MYSQL_PORT` | `3306` | `3306` |
| `ANTHROPIC_API_KEY` | In `orchestrator/.env` | In `orchestrator/.env` (mounted) |
| `NODE_ENV` | `development` | `production` |

## Local Development

Run the Notion HTTP API in Docker, everything else locally:

```bash
# Start only the Notion API
docker-compose --profile dev up -d notion-idea-server-http-dev

# Run the orchestrator locally against it
cd orchestrator
NOTION_API_URL=http://localhost:3001 npx tsx src/index.ts categorize-idea --id <id>
```

MySQL is optional locally. Without it, `workflow_runs` and `workflow_events` are silently skipped — the pipeline still processes ideas, you just lose the audit log.

## Docker Production

All services run in the `mcp-servers-network` Docker network. The orchestrator reaches the Notion server by container name:

```yaml
environment:
  - NOTION_API_URL=http://notion-idea-server-http:3001
  - MYSQL_HOST=mysql
```

The orchestrator container waits for MySQL to pass its healthcheck before starting (`depends_on: mysql: condition: service_healthy`).

## Verifying Before Running

```bash
# Check all required services are reachable
./scripts/sync-agent-configs.sh
```

This script checks `NOTION_API_URL` reachability and `ANTHROPIC_API_KEY` presence, and reports whether MySQL is available.

## Production Deployment Checklist

1. `notion-idea-server/.env` — Notion API token + database IDs set
2. `orchestrator/.env` — `ANTHROPIC_API_KEY` set
3. Docker network exists: `docker network create mcp-servers-network`
4. Start stack: `./scripts/start-full-project.sh`
5. Verify: `./scripts/sync-agent-configs.sh`
6. Check logs: `docker-compose logs -f orchestrator`

## Inspecting Production State

```bash
# Recent workflow runs
docker exec -it orchestrator-mysql mysql -u orchestrator -porchestrator orchestrator \
  -e "SELECT notion_page_name, status, current_stage, started_at FROM workflow_runs ORDER BY started_at DESC LIMIT 10;"

# Ideas currently in "Needs Review" (failed QA loop)
docker exec -it orchestrator-mysql mysql -u orchestrator -porchestrator orchestrator \
  -e "SELECT notion_page_name, attempts, updated_at FROM workflow_runs WHERE status = 'needs_review';"
```

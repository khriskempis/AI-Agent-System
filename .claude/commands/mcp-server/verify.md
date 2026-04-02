# Command: /mcp-server verify

Run the environment readiness check and verify all services are reachable.

## Steps

1. Run the environment check script:
```bash
./scripts/sync-agent-configs.sh
```

2. Check Notion HTTP API health:
```bash
curl -s http://localhost:3001/health | jq .
```

3. Verify unprocessed ideas are reachable:
```bash
curl -s "http://localhost:3001/api/ideas?status=Not%20Started" | jq 'length'
```

4. Check MySQL is up (if running):
```bash
docker exec orchestrator-mysql mysqladmin ping -u orchestrator -porchestrator --silent 2>/dev/null && echo "MySQL: OK" || echo "MySQL: not running"
```

5. Run a dry-run pipeline on the most recent unprocessed idea:
```bash
FIRST_ID=$(curl -s "http://localhost:3001/api/ideas?status=Not%20Started" | jq -r '.[0].id')
cd orchestrator && npx tsx src/index.ts categorize-idea --id "$FIRST_ID" --dry-run
```

6. Check running containers:
```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

## Expected Outcomes

- `sync-agent-configs.sh` exits 0
- `/health` returns `{ "status": "healthy" }`
- Ideas list returns at least 0 items (empty is fine, error is not)
- Dry-run reaches CLASSIFY stage without error
- All expected containers show `Up` status

## If Something Fails

| Failure | Fix |
|---|---|
| Notion API unreachable | `docker-compose up -d notion-idea-server-http` |
| MySQL unreachable | `docker-compose up -d mysql` |
| `ANTHROPIC_API_KEY` missing | Add to `orchestrator/.env` |
| Docker network missing | `docker network create mcp-servers-network` |

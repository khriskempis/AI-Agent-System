#!/bin/bash
# Startup script — brings up all services and processes any unhandled Notion ideas.
#
# What this does:
#   1. Starts all Docker services (MySQL, Ollama, Whisper, Qdrant, Notion server,
#      Orchestrator with its 09:00 ET daily cron)
#   2. Waits for MySQL and Notion server to be ready
#   3. Runs categorize-idea --all to clear any backlog immediately on boot
#
# Run this after booting your computer:
#   ./scripts/start.sh

set -e

cd "$(dirname "$0")/.."

# ── 1. Start all services ─────────────────────────────────────────────────────
echo "Starting services..."
docker-compose up -d --build
echo ""

# ── 2. Wait for MySQL ─────────────────────────────────────────────────────────
echo "Waiting for MySQL..."
until docker exec orchestrator-mysql mysqladmin ping -h localhost -u orchestrator -porchestrator --silent 2>/dev/null; do
  sleep 2
done
echo "  MySQL ready"

# ── 3. Wait for Notion server ─────────────────────────────────────────────────
echo "Waiting for Notion server..."
until curl -sf http://localhost:3001/health > /dev/null 2>&1; do
  sleep 2
done
echo "  Notion server ready"

# ── 4. Wait for Orchestrator container ───────────────────────────────────────
echo "Waiting for Orchestrator..."
until docker ps --filter "name=^orchestrator$" --filter "status=running" --format "{{.Names}}" | grep -q "^orchestrator$"; do
  sleep 2
done
echo "  Orchestrator ready"

# ── 5. Run startup backlog — categorize any unprocessed Notion ideas ──────────
echo ""
echo "Running categorize-idea --all (clearing backlog)..."
echo "============================================================"
docker exec orchestrator node dist/index.js categorize-idea --all
echo "============================================================"
echo ""

# ── 6. Status summary ─────────────────────────────────────────────────────────
echo "All services running:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" \
  --filter "name=orchestrator" \
  --filter "name=orchestrator-mysql" \
  --filter "name=mcp-notion-idea-server-http" \
  --filter "name=ollama" \
  --filter "name=whisper" \
  --filter "name=qdrant" \
  --filter "name=portainer"
echo ""
echo "Endpoints:"
echo "  Notion API:  http://localhost:3001"
echo "  Ollama:      http://localhost:11434"
echo "  Whisper:     http://localhost:9000"
echo "  Qdrant:      http://localhost:6333"
echo "  Portainer:   http://localhost:9001"
echo ""
echo "Orchestrator cron is running — next daily categorization at 09:00 ET"
echo "Logs: docker-compose logs -f orchestrator"

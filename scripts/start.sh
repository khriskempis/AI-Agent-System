#!/bin/bash
# Start all services: notion-idea-server-http, orchestrator, mysql

set -e

cd "$(dirname "$0")/.."

echo "Starting services..."
docker-compose up -d

echo "Waiting for MySQL to be healthy..."
until docker exec orchestrator-mysql mysqladmin ping -h localhost -u orchestrator -porchestrator --silent 2>/dev/null; do
  sleep 2
done

echo ""
echo "Services running:"
docker ps --filter "name=mcp-notion-idea-server-http" --filter "name=orchestrator" --filter "name=orchestrator-mysql" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "Notion HTTP API: http://localhost:3001"
echo "Logs: docker-compose logs -f"

#!/bin/bash

# =============================================================================
# MCP Server Project Stop Script
# =============================================================================
# Stops all running containers and cleans up
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🛑 Stopping MCP Server Project${NC}"
echo "=================================================================="

# Show what's currently running
echo -e "${BLUE}📦 Currently Running:${NC}"
docker ps --filter "name=mcp" --filter "name=n8n" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo
echo -e "${YELLOW}🛑 Stopping all containers...${NC}"

# Stop all services (including development profile)
docker-compose --profile dev down --remove-orphans

echo -e "${GREEN}✅ All containers stopped${NC}"

# Optional cleanup
echo
read -p "Remove unused Docker images? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}🧹 Cleaning up unused images...${NC}"
    docker image prune -f
    echo -e "${GREEN}✅ Cleanup complete${NC}"
fi

echo
echo -e "${GREEN}🎉 MCP Server Project Stopped${NC}"
echo -e "${BLUE}💡 To restart:${NC}"
echo "   Full Project:    ./scripts/start-full-project.sh"
echo "   Development:     ./scripts/start-development.sh"

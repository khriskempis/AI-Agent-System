#!/bin/bash

# =============================================================================
# MCP Server Development Mode Startup Script
# =============================================================================
# This script starts development environment with hot reload:
# - Notion MCP Server (stdio + hot reload)
# - Notion HTTP API (hot reload) → Port 3001
# - Director MCP Server (stdio)
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Starting MCP Server Development Environment${NC}"
echo "=================================================================="
echo -e "${BLUE}Development Services:${NC}"
echo "   🔹 Notion MCP Server (stdio + hot reload)"
echo "   🔹 Notion HTTP API (hot reload) → Port 3001"
echo "   🔹 Director MCP Server (stdio)"
echo

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker Desktop first.${NC}"
    exit 1
fi

# Stop existing containers
echo -e "${YELLOW}🛑 Stopping existing containers...${NC}"
docker-compose down --remove-orphans

# Build development containers
echo -e "${BLUE}🔨 Building development containers...${NC}"
docker-compose build notion-idea-server-dev director-mcp-server-dev --no-cache

# Start development containers
echo -e "${GREEN}🚀 Starting development containers with hot reload...${NC}"
docker-compose --profile dev up -d notion-idea-server-dev director-mcp-server-dev

# Start Notion HTTP API server for testing
echo -e "${BLUE}   Starting Notion HTTP API server (development mode with hot reload)...${NC}"
docker-compose --profile dev up -d notion-idea-server-http-dev

# Wait for services to be ready
echo -e "${YELLOW}⏳ Waiting for services to start...${NC}"
sleep 5

# Check all service health
echo -e "${BLUE}🔍 Performing health checks...${NC}"

if curl -s http://localhost:3001/health >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Notion HTTP API (dev): healthy (port 3001)${NC}"
else
    echo -e "${YELLOW}⏳ Notion HTTP API (dev): still starting up...${NC}"
fi

echo
echo -e "${GREEN}🎉 Development Environment Ready!${NC}"
echo "=================================================================="
echo -e "${BLUE}🔧 Development Features:${NC}"
echo "   📝 Hot Reload: Edit .ts files → changes apply instantly"
echo "   📦 Volume Mounted: ./notion-idea-server/src → /app/src"
echo "   🔍 TypeScript Compiler: tsx handles ES modules"
echo
echo -e "${BLUE}🔗 Access URLs:${NC}"
echo "   📋 Notion HTTP API:    http://localhost:3001 (dev mode with hot reload)"
echo "   📊 Health Check:       http://localhost:3001/health"
echo "   💡 Quick Test:         http://localhost:3001/api/ideas/summary"
echo
echo -e "${BLUE}📱 Development Workflow:${NC}"
echo "   1. Edit files in:"
echo "      - Notion Server: ./notion-idea-server/src/"
echo "      - Director Server: ./director-mcp-server/src/"
echo "      - Orchestrator:   ./orchestrator/src/"
echo "   2. Save → Changes apply automatically (hot reload)"
echo "   3. Run orchestrator locally:"
echo "      cd orchestrator && npx tsx src/index.ts categorize-idea --help"
echo "   4. View logs:"
echo "      docker-compose logs -f notion-idea-server-http-dev"
echo "      docker-compose logs -f director-mcp-server-dev"
echo
echo -e "${BLUE}📦 Running Containers:${NC}"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo
echo -e "${GREEN}✨ Happy coding! 🚀${NC}"

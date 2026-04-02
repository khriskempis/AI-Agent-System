#!/bin/bash

# =============================================================================
# MCP Server Full Project Startup Script
# =============================================================================
# Starts all production services:
# - Notion MCP Server (stdio + HTTP API on port 3001)
# - Director MCP Server (stdio)
# - Orchestrator (scheduler + pipelines)
# - MySQL (workflow history on port 3306)
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting MCP Server Full Project${NC}"
echo "=================================================================="

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker Desktop first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker is running${NC}"

# Check if .env files exist
if [[ ! -f "./notion-idea-server/.env" ]]; then
    echo -e "${YELLOW}⚠️  Warning: ./notion-idea-server/.env not found${NC}"
    echo -e "${YELLOW}   Please copy notion-idea-server/env.template to .env and configure${NC}"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo -e "${BLUE}📋 Project Services:${NC}"
echo "   🔹 Notion MCP Server (stdio) → For direct MCP clients"
echo "   🔹 Notion HTTP API → Port 3001"
echo "   🔹 Director MCP Server (stdio) → Workflow orchestration"
echo "   🔹 Orchestrator → Daily pipeline scheduler"
echo "   🔹 MySQL → Workflow history on port 3306"
echo

# Stop any existing containers to ensure clean start
echo -e "${YELLOW}🛑 Stopping existing containers...${NC}"
docker-compose down --remove-orphans

# Build services
echo -e "${BLUE}🔨 Building services...${NC}"
docker-compose build notion-idea-server notion-idea-server-http director-mcp-server orchestrator

# Start services
echo -e "${GREEN}🚀 Starting all services...${NC}"

echo -e "${BLUE}   Starting MySQL...${NC}"
docker-compose up -d mysql

echo -e "${BLUE}   Starting Notion MCP Server (stdio)...${NC}"
docker-compose up -d notion-idea-server

echo -e "${BLUE}   Starting Notion HTTP API Server...${NC}"
docker-compose up -d notion-idea-server-http

echo -e "${BLUE}   Starting Director MCP Server (stdio)...${NC}"
docker-compose up -d director-mcp-server

echo -e "${BLUE}   Starting Orchestrator...${NC}"
docker-compose up -d orchestrator

# Wait for services to be ready
echo -e "${YELLOW}⏳ Waiting for services to start...${NC}"
sleep 8

# Health checks
echo -e "${BLUE}🔍 Performing health checks...${NC}"

if curl -s http://localhost:3001/health >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Notion HTTP API: healthy (port 3001)${NC}"
else
    echo -e "${RED}❌ Notion HTTP API: not responding${NC}"
fi

if docker exec orchestrator-mysql mysqladmin ping -h localhost -u orchestrator -porchestrator --silent 2>/dev/null; then
    echo -e "${GREEN}✅ MySQL: healthy (port 3306)${NC}"
else
    echo -e "${YELLOW}⏳ MySQL: still starting up...${NC}"
fi

# Display status
echo
echo -e "${GREEN}🎉 MCP Server Project Started!${NC}"
echo "=================================================================="
echo -e "${BLUE}🔗 Access:${NC}"
echo "   🔌 Notion HTTP API:  http://localhost:3001"
echo "   📊 Health Check:     http://localhost:3001/health"
echo "   💡 Ideas Summary:    http://localhost:3001/api/ideas/summary"
echo "   🗄️  MySQL:           localhost:3306 (db: orchestrator)"
echo
echo -e "${BLUE}📚 Useful Commands:${NC}"
echo "   # View orchestrator logs"
echo "   docker-compose logs -f orchestrator"
echo
echo "   # Inspect workflow run history"
echo "   docker exec -it orchestrator-mysql mysql -u orchestrator -porchestrator orchestrator"
echo "   > SELECT notion_page_name, status, current_stage, started_at FROM workflow_runs ORDER BY started_at DESC LIMIT 10;"
echo
echo "   # Run a single pipeline manually"
echo "   cd orchestrator && npx tsx src/index.ts categorize-idea --help"
echo
echo -e "${YELLOW}🔧 Development Mode:${NC}"
echo "   ./scripts/start-development.sh"
echo

echo -e "${BLUE}📦 Running Containers:${NC}"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo
echo -e "${GREEN}✨ Project ready!${NC}"

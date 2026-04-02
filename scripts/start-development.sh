#!/bin/bash

# =============================================================================
# MCP Server Development Mode Startup Script
# =============================================================================
# This script starts development environment with hot reload:
# - Notion MCP Server (Development with hot reload)
# - Optional: HTTP API server for testing
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
echo "   🔹 Director HTTP API (for n8n workflows) → Port 3002"
echo "   🔹 n8n Workflow Platform → Port 5678"
echo "   🔹 Automatic workflow configuration"
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
docker-compose build notion-idea-server-dev director-mcp-server-dev director-mcp-server-http --no-cache

# Start development containers
echo -e "${GREEN}🚀 Starting development containers with hot reload...${NC}"
docker-compose --profile dev up -d notion-idea-server-dev director-mcp-server-dev

# Start HTTP API servers for testing (automatically)
echo -e "${BLUE}   Starting Notion HTTP API server (development mode with hot reload)...${NC}"
docker-compose --profile dev up -d notion-idea-server-http-dev

echo -e "${BLUE}   Starting Director HTTP API server (for n8n workflows)...${NC}"
docker run -d --name mcp-director-server-http-dev --network mcp-servers-network -p 3002:3002 -v "$(pwd)/director-mcp:/app/director-mcp:ro" mcpserver-director-mcp-server-http node dist/http-wrapper.js || echo "   Director HTTP container already running"

# Start n8n workflow platform (automatically)
echo -e "${BLUE}   Starting n8n workflow platform...${NC}"
docker-compose up -d n8n

# Configure workflows for development environment
echo -e "${BLUE}🔧 Configuring workflows for development environment...${NC}"
if [ -f "./n8n/workflows/config/config-switcher.js" ]; then
    cd n8n/workflows/config
    echo -e "${YELLOW}   Switching all workflows to testing configuration...${NC}"
    if node config-switcher.js --env testing --all; then
        echo -e "${GREEN}   ✅ All workflows configured for development (localhost URLs)${NC}"
    else
        echo -e "${YELLOW}   ⚠️  Warning: Some workflows may not have been configured${NC}"
    fi
    cd ../../..
else
    echo -e "${YELLOW}   ⚠️  Config switcher not found, workflows may need manual configuration${NC}"
fi

# Wait for all services to be ready
echo -e "${YELLOW}⏳ Waiting for all services to start...${NC}"
sleep 8

# Check all service health
echo -e "${BLUE}🔍 Performing health checks...${NC}"

# Check HTTP API Server
if curl -s http://localhost:3001/health >/dev/null 2>&1; then
    echo -e "${GREEN}✅ HTTP API Server (dev): healthy (port 3001)${NC}"
else
    echo -e "${YELLOW}⏳ HTTP API Server (dev): starting up...${NC}"
fi

# Check Director HTTP API Server
if curl -s http://localhost:3002/health >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Director HTTP API Server: healthy (port 3002)${NC}"
else
    echo -e "${YELLOW}⏳ Director HTTP API Server: starting up...${NC}"
    sleep 2
    if curl -s http://localhost:3002/health >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Director HTTP API Server: healthy (port 3002)${NC}"
    fi
fi

# Check n8n Platform
if curl -s http://localhost:5678/healthz >/dev/null 2>&1; then
    echo -e "${GREEN}✅ n8n Platform: healthy (port 5678)${NC}"
else
    echo -e "${YELLOW}⏳ n8n Platform: still starting up...${NC}"
fi

echo
echo -e "${GREEN}🎉 Development Environment Ready!${NC}"
echo "=================================================================="
echo -e "${BLUE}🔧 Development Features:${NC}"
echo "   📝 Hot Reload: Edit Notion .ts files → changes apply instantly"
echo "   📦 Volume Mounted: ./notion-idea-server/src → /app/src"
echo "   🔍 TypeScript Compiler: tsx handles ES modules"
echo "   🌐 n8n Platform: Full workflow testing environment"
echo "   🎯 Director HTTP API: Ready for n8n workflow calls"
echo "   ⚙️ Automatic workflow configuration for localhost URLs"
echo
echo -e "${BLUE}🔗 Access URLs:${NC}"
echo "   📊 n8n Platform:       http://localhost:5678"
echo "   📋 Notion HTTP API:    http://localhost:3001 (dev mode with hot reload)"
echo "   🎯 Director HTTP API:  http://localhost:3002 (ready for n8n workflows)"
echo "   📊 Health Checks:"
echo "      Notion Health:      http://localhost:3001/health"
echo "      Director Health:    http://localhost:3002/health"
echo "      System Stats:       http://localhost:3002/api/stats"
echo "   💡 Quick Tests:"
echo "      Ideas Summary:      http://localhost:3001/api/ideas/summary"
echo "      Template Loading:   http://localhost:3002/api/mcp/get-workflow-template"
echo
echo -e "${BLUE}📱 Development Workflow:${NC}"
echo "   1. Edit files in:"
echo "      - Notion Server: ./notion-idea-server/src/"
echo "      - Director Server: ./director-mcp-server/src/"
echo "   2. Save → Changes apply automatically (hot reload for all servers)"
echo "   3. Test Director MCP Server: ./testing/test-director-endpoints.sh"
echo "   4. Test workflows in n8n: http://localhost:5678"
echo "   5. View logs:"
echo "      - Notion MCP: docker-compose logs -f notion-idea-server-dev"
echo "      - Notion HTTP: docker-compose logs -f notion-idea-server-http-dev"
echo "      - Director MCP: docker-compose logs -f director-mcp-server-dev"
echo "      - n8n: docker-compose logs -f n8n"
echo
echo -e "${BLUE}📦 Running Containers:${NC}"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo
echo -e "${GREEN}✨ Happy coding! 🚀${NC}"

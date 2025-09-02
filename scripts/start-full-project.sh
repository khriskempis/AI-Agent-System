#!/bin/bash

# =============================================================================
# MCP Server + AI Agents Full Project Startup Script
# =============================================================================
# This script starts all services needed for the complete MCP Server ecosystem:
# - Notion MCP Server (HTTP API)
# - n8n AI Workflow Platform  
# - All supporting services
# =============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting MCP Server + AI Agents Full Project${NC}"
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

echo -e "${BLUE}📋 Project Services Overview:${NC}"
echo "   🔹 Main MCP Server (stdio) → For direct MCP clients"
echo "   🔹 Notion MCP Server (HTTP API) → Port 3001"  
echo "   🔹 n8n AI Workflow Platform → Port 5678"
echo "   🔹 All services connected via mcp-network"
echo

# Stop any existing containers to ensure clean start
echo -e "${YELLOW}🛑 Stopping existing containers...${NC}"
docker-compose down --remove-orphans

# Build services (in case of code changes)
echo -e "${BLUE}🔨 Building services...${NC}"
docker-compose build notion-idea-server notion-idea-server-http

# Start core services for AI agents
echo -e "${GREEN}🚀 Starting all MCP services...${NC}"

# Start main MCP server (stdio mode for direct MCP clients)
echo -e "${BLUE}   Starting Main MCP Server (stdio)...${NC}"
docker-compose up -d notion-idea-server

# Start MCP HTTP API server (required for n8n agents)
echo -e "${BLUE}   Starting Notion MCP HTTP API Server...${NC}"
docker-compose up -d notion-idea-server-http

# Start n8n workflow platform
echo -e "${BLUE}   Starting n8n AI Workflow Platform...${NC}"
docker-compose up -d n8n

# Wait for services to be ready
echo -e "${YELLOW}⏳ Waiting for services to start...${NC}"
sleep 5

# Health checks
echo -e "${BLUE}🔍 Performing health checks...${NC}"

# Check MCP HTTP API
if curl -s http://localhost:3001/health >/dev/null 2>&1; then
    echo -e "${GREEN}✅ MCP HTTP API Server: healthy (port 3001)${NC}"
else
    echo -e "${RED}❌ MCP HTTP API Server: not responding${NC}"
fi

# Check n8n
if curl -s http://localhost:5678 >/dev/null 2>&1; then
    echo -e "${GREEN}✅ n8n Platform: healthy (port 5678)${NC}"
else
    echo -e "${YELLOW}⏳ n8n Platform: still starting up...${NC}"
fi

# Display status
echo
echo -e "${GREEN}🎉 MCP Server + AI Agents Project Started!${NC}"
echo "=================================================================="
echo -e "${BLUE}🔗 Access URLs:${NC}"
echo "   📊 n8n AI Platform:    http://localhost:5678"
echo "   🔌 MCP HTTP API:       http://localhost:3001"
echo "   📋 API Health Check:   http://localhost:3001/health"
echo "   💡 Ideas Summary:      http://localhost:3001/api/ideas/summary"
echo
echo -e "${BLUE}📱 Docker Desktop:${NC}"
echo "   All containers visible in Docker Desktop"
echo "   Container names: mcp-notion-idea-server, mcp-notion-idea-server-http, n8n-server"
echo
echo -e "${BLUE}📚 Next Steps:${NC}"
echo "   1. Visit http://localhost:5678 to access n8n"
echo "   2. Import workflows from: ./n8n/workflows/"
echo "   3. Configure n8n agents to use: http://host.docker.internal:3001"
echo
echo -e "${YELLOW}🔧 Development Mode:${NC}"
echo "   To start development with hot reload:"
echo "   ./scripts/start-development.sh"
echo

# Show running containers
echo -e "${BLUE}📦 Running Containers:${NC}"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo
echo -e "${GREEN}✨ Project ready for AI agent workflows!${NC}"

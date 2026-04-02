#!/bin/bash

# =============================================================================
# MCP Server Production Environment Startup Script
# =============================================================================
# This script starts the production environment with proper HTTP services:
# - Notion MCP Server (HTTP API - production)
# - Director MCP Server (HTTP API - production)
# - n8n Workflow Platform
# - Automatic workflow configuration for production
# =============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting MCP Server Production Environment${NC}"
echo "=================================================================="
echo -e "${BLUE}Production Services:${NC}"
echo "   🔹 Notion MCP Server (HTTP API - production)"
echo "   🔹 Director MCP Server (HTTP API - production)" 
echo "   🔹 n8n Workflow Platform"
echo "   🔹 Automatic workflow configuration"
echo

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

# Stop any existing containers to ensure clean start
echo -e "${YELLOW}🛑 Stopping existing containers...${NC}"
docker-compose down --remove-orphans

# Build production services
echo -e "${BLUE}🔨 Building production services...${NC}"
docker-compose build notion-idea-server-http director-mcp-server-http

# Start production HTTP services
echo -e "${GREEN}🚀 Starting production HTTP services...${NC}"

# Start Notion MCP HTTP API server (production)
echo -e "${BLUE}   Starting Notion MCP HTTP API Server (production)...${NC}"
docker-compose up -d notion-idea-server-http

# Start Director MCP HTTP API server (production)
echo -e "${BLUE}   Starting Director MCP HTTP API Server (production)...${NC}"
docker-compose up -d director-mcp-server-http

# Start n8n workflow platform
echo -e "${BLUE}   Starting n8n Workflow Platform...${NC}"
docker-compose up -d n8n

# Configure workflows for production environment
echo -e "${BLUE}🔧 Configuring workflows for production environment...${NC}"
if [ -f "./n8n/workflows/config/config-switcher.js" ]; then
    cd n8n/workflows/config
    echo -e "${YELLOW}   Switching all workflows to production configuration...${NC}"
    if node config-switcher.js --env production --all; then
        echo -e "${GREEN}   ✅ All workflows configured for production (Docker service URLs)${NC}"
        echo -e "${GREEN}   ✅ Production settings applied (higher limits, timeouts)${NC}"
    else
        echo -e "${YELLOW}   ⚠️  Warning: Some workflows may not have been configured${NC}"
    fi
    cd ../../..
else
    echo -e "${YELLOW}   ⚠️  Config switcher not found, workflows may need manual configuration${NC}"
fi

# Wait for services to be ready
echo -e "${YELLOW}⏳ Waiting for services to start...${NC}"
sleep 8

# Health checks
echo -e "${BLUE}🔍 Performing health checks...${NC}"

# Check Notion MCP HTTP API
if curl -s http://localhost:3001/health >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Notion MCP HTTP API: healthy (port 3001)${NC}"
else
    echo -e "${RED}❌ Notion MCP HTTP API: not responding${NC}"
fi

# Check Director MCP HTTP API
if curl -s http://localhost:3002/health >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Director MCP HTTP API: healthy (port 3002)${NC}"
else
    echo -e "${YELLOW}⏳ Director MCP HTTP API: still starting up...${NC}"
fi

# Check n8n
if curl -s http://localhost:5678/healthz >/dev/null 2>&1; then
    echo -e "${GREEN}✅ n8n Platform: healthy (port 5678)${NC}"
else
    echo -e "${YELLOW}⏳ n8n Platform: still starting up...${NC}"
fi

# Display status
echo
echo -e "${GREEN}🎉 Production Environment Ready!${NC}"
echo "=================================================================="
echo -e "${BLUE}🔗 Access URLs:${NC}"
echo "   📊 n8n Platform:        http://localhost:5678"
echo "   🔌 Notion MCP API:      http://localhost:3001"
echo "   🎯 Director MCP API:    http://localhost:3002"
echo "   📋 Health Checks:"
echo "      Notion Health:       http://localhost:3001/health"
echo "      Director Health:     http://localhost:3002/health"
echo "      System Stats:        http://localhost:3002/api/stats"
echo "   💡 Quick Tests:"
echo "      Ideas Summary:       http://localhost:3001/api/ideas/summary"
echo "      Template Loading:    http://localhost:3002/api/mcp/get-workflow-template"
echo

echo -e "${BLUE}🔧 Production Configuration:${NC}"
echo "   ✅ Workflows use Docker service names (mcp-director-server-http:3002)"
echo "   ✅ Production timeouts and limits applied"
echo "   ✅ Optimized for stability and performance"
echo "   ✅ All services on mcp-servers-network"
echo

echo -e "${BLUE}📚 Next Steps:${NC}"
echo "   1. Visit http://localhost:5678 to access n8n"
echo "   2. Import workflows from: ./n8n/workflows/"
echo "   3. Workflows are pre-configured with production URLs:"
echo "      - Notion API: http://mcp-notion-idea-server-http:3001"
echo "      - Director API: http://mcp-director-server-http:3002"
echo "   4. Test workflows with production configuration"
echo

echo -e "${YELLOW}⚠️  Production Notes:${NC}"
echo "   🔒 Make sure production database IDs are configured"
echo "   🔒 Verify all environment variables are set"
echo "   🔒 Monitor logs for any issues"
echo "   🔒 Use 'docker-compose logs -f <service>' to view logs"
echo

# Show running containers
echo -e "${BLUE}📦 Running Containers:${NC}"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo
echo -e "${GREEN}✨ Production environment ready for deployment! 🚀${NC}"

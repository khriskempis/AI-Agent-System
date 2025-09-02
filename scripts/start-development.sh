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

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker Desktop first.${NC}"
    exit 1
fi

# Stop existing containers
echo -e "${YELLOW}🛑 Stopping existing containers...${NC}"
docker-compose down --remove-orphans

# Build development container
echo -e "${BLUE}🔨 Building development container...${NC}"
docker-compose build notion-idea-server-dev --no-cache

# Start development container
echo -e "${GREEN}🚀 Starting development container with hot reload...${NC}"
docker-compose --profile dev up -d notion-idea-server-dev

# Ask if user wants HTTP API for testing
echo
read -p "Start HTTP API server for testing? (Y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
    echo -e "${BLUE}   Starting HTTP API server...${NC}"
    docker-compose up -d notion-idea-server-http
    
    # Wait and test
    sleep 3
    if curl -s http://localhost:3001/health >/dev/null 2>&1; then
        echo -e "${GREEN}✅ HTTP API Server: healthy (port 3001)${NC}"
    else
        echo -e "${YELLOW}⏳ HTTP API Server: starting up...${NC}"
    fi
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
echo "   📋 MCP HTTP API:       http://localhost:3001 (if started)"
echo "   📊 API Health Check:   http://localhost:3001/health"
echo
echo -e "${BLUE}📱 Development Workflow:${NC}"
echo "   1. Edit files in: ./notion-idea-server/src/"
echo "   2. Save → Changes apply automatically"
echo "   3. View logs: docker-compose logs -f notion-idea-server-dev"
echo
echo -e "${BLUE}📦 Running Containers:${NC}"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo
echo -e "${GREEN}✨ Happy coding! 🚀${NC}"

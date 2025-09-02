#!/bin/bash

# Docker build script for Notion Idea MCP Server
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo -e "${GREEN}Building Notion Idea MCP Server Docker Image${NC}"
echo "Project directory: $PROJECT_DIR"

# Change to project directory
cd "$PROJECT_DIR"

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}Warning: .env file not found. Creating from template...${NC}"
    if [ -f "env.template" ]; then
        cp env.template .env
        echo -e "${YELLOW}Please edit .env file with your Notion credentials before running the container${NC}"
    else
        echo -e "${RED}Error: env.template not found${NC}"
        exit 1
    fi
fi

# Build the Docker image
echo -e "${GREEN}Building Docker image...${NC}"
docker build -t notion-idea-mcp-server:latest .

echo -e "${GREEN}Build complete!${NC}"
echo ""
echo "Available commands:"
echo "  Run production:  docker-compose up"
echo "  Run development: docker-compose --profile dev up notion-idea-server-dev"
echo "  View logs:       docker-compose logs -f"
echo "  Stop:            docker-compose down" 
#!/bin/bash

# Docker run script for Notion Idea MCP Server
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Default mode
MODE="production"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--dev|--development)
            MODE="development"
            shift
            ;;
        -p|--prod|--production)
            MODE="production"
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -d, --dev, --development    Run in development mode"
            echo "  -p, --prod, --production    Run in production mode (default)"
            echo "  -h, --help                  Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

echo -e "${GREEN}Running Notion Idea MCP Server in $MODE mode${NC}"

# Change to project directory
cd "$PROJECT_DIR"

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo -e "${RED}Error: .env file not found${NC}"
    echo -e "${YELLOW}Please copy env.template to .env and configure your Notion credentials${NC}"
    exit 1
fi

# Validate required environment variables
if ! grep -q "NOTION_API_TOKEN=secret_" .env && ! grep -q "NOTION_API_TOKEN=your_" .env; then
    if [ -z "$(grep '^NOTION_API_TOKEN=' .env | cut -d'=' -f2)" ]; then
        echo -e "${RED}Error: NOTION_API_TOKEN not configured in .env file${NC}"
        exit 1
    fi
fi

if ! grep -q "NOTION_DATABASE_ID=your_" .env; then
    if [ -z "$(grep '^NOTION_DATABASE_ID=' .env | cut -d'=' -f2)" ]; then
        echo -e "${RED}Error: NOTION_DATABASE_ID not configured in .env file${NC}"
        exit 1
    fi
fi

# Run based on mode
if [ "$MODE" = "development" ]; then
    echo -e "${BLUE}Starting development server with hot reload...${NC}"
    docker-compose --profile dev up notion-idea-server-dev
else
    echo -e "${BLUE}Starting production server...${NC}"
    docker-compose up notion-idea-server
fi 
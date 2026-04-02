#!/bin/bash

# Apply Development Configuration to N8N Workflows
# This script should be run after any modification to n8n workflow files

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="$SCRIPT_DIR/config"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Applying Development Configuration to N8N Workflows${NC}"
echo "=================================================================="

# Check if config switcher exists
if [ ! -f "$CONFIG_DIR/config-switcher.js" ]; then
    echo -e "${YELLOW}⚠️  Config switcher not found at: $CONFIG_DIR/config-switcher.js${NC}"
    exit 1
fi

# Change to config directory
cd "$CONFIG_DIR"

echo -e "${YELLOW}📋 Switching all workflows to development (testing) environment...${NC}"

# Run config switcher for testing environment
if node config-switcher.js --env testing --all; then
    echo -e "${GREEN}✅ All workflows configured for development environment${NC}"
    echo -e "${GREEN}   - Service URLs: mcp-*-server-*-dev:port${NC}"
    echo -e "${GREEN}   - Development settings applied${NC}"
    echo -e "${GREEN}   - Backups created automatically${NC}"
else
    echo -e "${YELLOW}⚠️  Warning: Some workflows may not have been configured properly${NC}"
    exit 1
fi

echo
echo -e "${BLUE}🎯 Ready for development testing!${NC}"
echo "=================================================================="
echo -e "${GREEN}✅ All n8n workflows now use development service configurations${NC}"


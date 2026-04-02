#!/bin/bash

# Verify N8N Workflows are configured for development
# Checks if workflows use development service names

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Verifying N8N Workflow Development Configuration${NC}"
echo "=================================================================="

# Find main workflow JSON files (exclude config, archive, examples, and individual agents)
WORKFLOW_FILES=$(find "$SCRIPT_DIR" -maxdepth 1 -name "*.json")

DEV_CONFIGURED=true
TOTAL_WORKFLOWS=0
DEV_WORKFLOWS=0

for workflow in $WORKFLOW_FILES; do
    WORKFLOW_NAME=$(basename "$workflow" .json)
    TOTAL_WORKFLOWS=$((TOTAL_WORKFLOWS + 1))
    
    echo -e "${BLUE}Checking: ${WORKFLOW_NAME}${NC}"
    
    # Check for development service URLs
    DEV_DIRECTOR=$(grep -c "mcp-director-server-http-dev:" "$workflow" 2>/dev/null || echo "0")
    DEV_NOTION=$(grep -c "mcp-notion-idea-server-http-dev:" "$workflow" 2>/dev/null || echo "0")
    
    # Check for production service URLs (without -dev)
    PROD_DIRECTOR=$(grep -c "mcp-director-server-http:[^-]" "$workflow" 2>/dev/null || echo "0")
    PROD_NOTION=$(grep -c "mcp-notion-idea-server-http:[^-]" "$workflow" 2>/dev/null || echo "0")
    
    if [ "$DEV_DIRECTOR" -gt 0 ] || [ "$DEV_NOTION" -gt 0 ]; then
        echo -e "  ✅ Uses development service URLs"
        DEV_WORKFLOWS=$((DEV_WORKFLOWS + 1))
    elif [ "$PROD_DIRECTOR" -gt 0 ] || [ "$PROD_NOTION" -gt 0 ]; then
        echo -e "  ❌ Uses production service URLs - NEEDS CONFIG UPDATE"
        DEV_CONFIGURED=false
    else
        echo -e "  ⚪ No service URLs found (may not need configuration)"
    fi
done

echo
echo "=================================================================="

if [ "$DEV_CONFIGURED" = true ]; then
    echo -e "${GREEN}✅ All workflows properly configured for development!${NC}"
    echo -e "${GREEN}   $DEV_WORKFLOWS/$TOTAL_WORKFLOWS workflows use development service names${NC}"
else
    echo -e "${RED}❌ Some workflows need development configuration${NC}"
    echo -e "${YELLOW}   Run: ./n8n/workflows/apply-dev-config.sh${NC}"
    exit 1
fi

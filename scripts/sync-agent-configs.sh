#!/bin/bash

# =============================================================================
# Orchestrator Environment Check
# =============================================================================
# Verifies that all required environment variables and services are reachable
# before running the orchestrator pipeline.
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Orchestrator Environment Check${NC}"
echo "======================================"

issues=0

# --- Check NOTION_API_URL ---
NOTION_URL="${NOTION_API_URL:-http://localhost:3001}"
echo -e "${YELLOW}Checking Notion HTTP API at ${NOTION_URL}...${NC}"
if curl -s "${NOTION_URL}/health" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Notion HTTP API: reachable${NC}"
else
    echo -e "${RED}❌ Notion HTTP API: not reachable at ${NOTION_URL}${NC}"
    echo -e "   Start with: docker-compose up -d notion-idea-server-http"
    ((issues++))
fi

# --- Check ANTHROPIC_API_KEY ---
if [[ -n "$ANTHROPIC_API_KEY" ]]; then
    echo -e "${GREEN}✅ ANTHROPIC_API_KEY: set${NC}"
else
    # Check orchestrator .env file
    if [[ -f "./orchestrator/.env" ]] && grep -q "ANTHROPIC_API_KEY" ./orchestrator/.env 2>/dev/null; then
        echo -e "${GREEN}✅ ANTHROPIC_API_KEY: found in orchestrator/.env${NC}"
    else
        echo -e "${RED}❌ ANTHROPIC_API_KEY: not set${NC}"
        echo -e "   Add it to orchestrator/.env"
        ((issues++))
    fi
fi

# --- Check MySQL (optional — orchestrator works without it) ---
MYSQL_HOST="${MYSQL_HOST:-localhost}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
echo -e "${YELLOW}Checking MySQL at ${MYSQL_HOST}:${MYSQL_PORT}...${NC}"
if command -v mysqladmin >/dev/null 2>&1; then
    if mysqladmin ping -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "${MYSQL_USER:-orchestrator}" -p"${MYSQL_PASSWORD:-orchestrator}" --silent 2>/dev/null; then
        echo -e "${GREEN}✅ MySQL: reachable${NC}"
    else
        echo -e "${YELLOW}⚠️  MySQL: not reachable (workflow history disabled)${NC}"
        echo -e "   Start with: docker-compose up -d mysql"
    fi
elif docker ps --format '{{.Names}}' 2>/dev/null | grep -q "orchestrator-mysql"; then
    echo -e "${GREEN}✅ MySQL container: running${NC}"
else
    echo -e "${YELLOW}⚠️  MySQL: status unknown (workflow history may be disabled)${NC}"
fi

# --- Summary ---
echo
echo "======================================"
if [[ $issues -eq 0 ]]; then
    echo -e "${GREEN}✅ Environment ready — orchestrator can run${NC}"
    echo
    echo -e "${BLUE}Run options:${NC}"
    echo "   # Full daily pipeline (scheduler fires at 09:00 ET)"
    echo "   cd orchestrator && npm start"
    echo
    echo "   # Process a single idea now"
    echo "   cd orchestrator && npx tsx src/index.ts categorize-idea --id <notion-page-id>"
    echo
    echo "   # Trigger daily run once (skips 9am wait)"
    echo "   cd orchestrator && npx tsx src/index.ts scheduler --run-now"
else
    echo -e "${RED}❌ Found ${issues} issue(s) — fix above before running the orchestrator${NC}"
    exit 1
fi

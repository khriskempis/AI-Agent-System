#!/bin/bash

# Agent Configuration Sync Checker
# Ensures individual agent tests stay in sync with main workflow

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔄 Agent Configuration Sync Checker${NC}"
echo -e "${BLUE}======================================${NC}"

# Paths
MAIN_WORKFLOW="n8n/workflows/multi-agent-workflow-system.json"
INDIVIDUAL_DIR="n8n/workflows/individual-agents"
NOTION_INDIVIDUAL="$INDIVIDUAL_DIR/notion-agent.json"
DIRECTOR_INDIVIDUAL="$INDIVIDUAL_DIR/director-agent.json"

# Check if files exist
echo -e "${YELLOW}📁 Checking file locations...${NC}"
if [[ ! -f "$MAIN_WORKFLOW" ]]; then
    echo -e "${RED}❌ Main workflow not found: $MAIN_WORKFLOW${NC}"
    exit 1
fi

if [[ ! -f "$NOTION_INDIVIDUAL" ]]; then
    echo -e "${RED}❌ Notion individual test not found: $NOTION_INDIVIDUAL${NC}"
    exit 1
fi

if [[ ! -f "$DIRECTOR_INDIVIDUAL" ]]; then
    echo -e "${RED}❌ Director individual test not found: $DIRECTOR_INDIVIDUAL${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All workflow files found${NC}"

# Function to extract system message from JSON
extract_system_message() {
    local file="$1"
    local agent_name="$2"
    
    # Use jq to extract system message for specific agent
    jq -r ".nodes[] | select(.name == \"$agent_name\") | .parameters.options.systemMessage // empty" "$file" 2>/dev/null || echo ""
}

# Function to extract tool descriptions
extract_tool_descriptions() {
    local file="$1"
    local tool_pattern="$2"
    
    # Extract tool descriptions matching pattern
    jq -r ".nodes[] | select(.name | test(\"$tool_pattern\")) | .parameters.toolDescription // empty" "$file" 2>/dev/null || echo ""
}

echo -e "\n${YELLOW}🧭 Checking Director Agent Configuration...${NC}"

# Extract Director system messages
MAIN_DIRECTOR_MSG=$(extract_system_message "$MAIN_WORKFLOW" "Intelligent Director Agent")
INDIVIDUAL_DIRECTOR_MSG=$(extract_system_message "$DIRECTOR_INDIVIDUAL" "Director Agent")

# Compare Director system messages
if [[ -n "$MAIN_DIRECTOR_MSG" && -n "$INDIVIDUAL_DIRECTOR_MSG" ]]; then
    if [[ "$MAIN_DIRECTOR_MSG" == "$INDIVIDUAL_DIRECTOR_MSG" ]]; then
        echo -e "${GREEN}✅ Director system messages match${NC}"
    else
        echo -e "${RED}❌ Director system messages differ${NC}"
        echo -e "${YELLOW}Main length: ${#MAIN_DIRECTOR_MSG} chars${NC}"
        echo -e "${YELLOW}Individual length: ${#INDIVIDUAL_DIRECTOR_MSG} chars${NC}"
    fi
else
    echo -e "${RED}❌ Could not extract Director system messages${NC}"
fi

echo -e "\n${YELLOW}💡 Checking Notion Agent Configuration...${NC}"

# Extract Notion system messages  
MAIN_NOTION_MSG=$(extract_system_message "$MAIN_WORKFLOW" "Notion Agent")
INDIVIDUAL_NOTION_MSG=$(extract_system_message "$NOTION_INDIVIDUAL" "Notion Agent")

# Compare Notion system messages
if [[ -n "$MAIN_NOTION_MSG" && -n "$INDIVIDUAL_NOTION_MSG" ]]; then
    if [[ "$MAIN_NOTION_MSG" == "$INDIVIDUAL_NOTION_MSG" ]]; then
        echo -e "${GREEN}✅ Notion system messages match${NC}"
    else
        echo -e "${RED}❌ Notion system messages differ${NC}"
        echo -e "${YELLOW}Main length: ${#MAIN_NOTION_MSG} chars${NC}"
        echo -e "${YELLOW}Individual length: ${#INDIVIDUAL_NOTION_MSG} chars${NC}"
    fi
else
    echo -e "${RED}❌ Could not extract Notion system messages${NC}"
fi

echo -e "\n${YELLOW}🔧 Checking MCP Tool Configurations...${NC}"

# Check Notion tool descriptions
echo -e "${BLUE}Notion Tools:${NC}"
tools=("Notion Get Ideas" "Notion Get Idea By ID" "Notion Search Ideas" "Notion Update Idea")

for tool in "${tools[@]}"; do
    main_tool_desc=$(jq -r ".nodes[] | select(.name == \"$tool\") | .parameters.toolDescription // empty" "$MAIN_WORKFLOW" 2>/dev/null)
    individual_tool_desc=$(jq -r ".nodes[] | select(.name == \"$tool\") | .parameters.toolDescription // empty" "$NOTION_INDIVIDUAL" 2>/dev/null)
    
    if [[ -n "$main_tool_desc" && -n "$individual_tool_desc" ]]; then
        if [[ "$main_tool_desc" == "$individual_tool_desc" ]]; then
            echo -e "  ${GREEN}✅ $tool descriptions match${NC}"
        else
            echo -e "  ${RED}❌ $tool descriptions differ${NC}"
        fi
    else
        echo -e "  ${YELLOW}⚠️  $tool not found in one or both files${NC}"
    fi
done

echo -e "\n${YELLOW}⚙️  Checking Model Configurations...${NC}"

# Extract model configurations
main_claude_model=$(jq -r '.nodes[] | select(.name == "Claude Notion Specialist") | .parameters.model // empty' "$MAIN_WORKFLOW" 2>/dev/null)
individual_gpt_model=$(jq -r '.nodes[] | select(.name == "GPT-4o Mini Notion Model") | .parameters.model // empty' "$NOTION_INDIVIDUAL" 2>/dev/null)

echo -e "${BLUE}Model Usage:${NC}"
echo -e "  Main Workflow: ${main_claude_model:-"Not found"} (Claude)"
echo -e "  Individual Test: ${individual_gpt_model:-"Not found"} (GPT)"
echo -e "  ${GREEN}ℹ️  Different models for cost-effective testing is expected${NC}"

echo -e "\n${YELLOW}📊 Configuration Summary${NC}"
echo -e "${BLUE}========================${NC}"

# Count issues
issues=0

if [[ "$MAIN_DIRECTOR_MSG" != "$INDIVIDUAL_DIRECTOR_MSG" ]]; then
    ((issues++))
fi

if [[ "$MAIN_NOTION_MSG" != "$INDIVIDUAL_NOTION_MSG" ]]; then
    ((issues++))
fi

if [[ $issues -eq 0 ]]; then
    echo -e "${GREEN}✅ All critical configurations are synchronized${NC}"
    echo -e "${GREEN}🎯 Ready for testing and production deployment${NC}"
else
    echo -e "${RED}❌ Found $issues configuration differences${NC}"
    echo -e "${YELLOW}🔧 Manual sync required before production deployment${NC}"
fi

echo -e "\n${BLUE}🧪 Next Steps:${NC}"
echo -e "1. ${YELLOW}Test individual agents${NC}: Import and run individual workflows"
echo -e "2. ${YELLOW}Fix any issues found${NC}: Address configuration differences"  
echo -e "3. ${YELLOW}Re-run sync check${NC}: Verify configurations match"
echo -e "4. ${YELLOW}Deploy main workflow${NC}: Upload to n8n when testing complete"

echo -e "\n${BLUE}🔗 Quick Links:${NC}"
echo -e "• Testing Guide: docs/development/AGENT_TESTING_GUIDE.md"
echo -e "• n8n Platform: http://localhost:5678"
echo -e "• MCP Health Check: http://localhost:3001/health"

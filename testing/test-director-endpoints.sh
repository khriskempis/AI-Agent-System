#!/bin/bash

# Director MCP Server Endpoint Testing Script
# Quick tests for all major endpoints without needing Postman

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
DIRECTOR_SERVER="http://localhost:3002"
NOTION_SERVER="http://localhost:3001"
N8N_SERVER="http://localhost:5678"

# Database IDs (update these with your actual IDs)
SOURCE_DB_ID="16cd7be3dbcd80e1aac9c3a95ffaa61a"
PROJECTS_DB_ID="3cd8ea052d6d4b69956e89b1184cae75"
KNOWLEDGE_DB_ID="263d7be3dbcd80c0b6e4fd309a8af453"
JOURNAL_DB_ID="a1d35f6081a044589425512cb9d136b7"

# Test results tracking
TESTS_PASSED=0
TOTAL_TESTS=0

echo -e "${BLUE}🧪 Director MCP Server Endpoint Testing${NC}"
echo "=================================================="

# Function to run a test
run_test() {
    local test_name="$1"
    local url="$2"
    local method="${3:-GET}"
    local data="$4"
    local expected_status="${5:-200}"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -e "\n${YELLOW}Test $TOTAL_TESTS: $test_name${NC}"
    echo "URL: $url"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" "$url")
    else
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" -X "$method" -H "Content-Type: application/json" -d "$data" "$url")
    fi
    
    http_code=$(echo "$response" | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
    body=$(echo "$response" | sed -e 's/HTTPSTATUS:.*//g')
    
    if [ "$http_code" -eq "$expected_status" ]; then
        echo -e "${GREEN}✅ PASSED (HTTP $http_code)${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        
        # Pretty print JSON if response looks like JSON
        if echo "$body" | jq . >/dev/null 2>&1; then
            echo "Response:"
            echo "$body" | jq '.' | head -15
            if [ $(echo "$body" | jq '.' | wc -l) -gt 15 ]; then
                echo "... (truncated, use full endpoint for complete response)"
            fi
        else
            echo "Response: $body"
        fi
    else
        echo -e "${RED}❌ FAILED (HTTP $http_code, expected $expected_status)${NC}"
        echo "Response: $body"
    fi
}

# Test 1: Health Check
run_test "Director Server Health Check" "$DIRECTOR_SERVER/health"

# Test 2: System Stats
run_test "System Statistics" "$DIRECTOR_SERVER/api/stats"

# Test 3: Agent Health Check
run_test "All Agents Health" "$DIRECTOR_SERVER/api/agents/health"

# Test 4: Get Workflow Template
template_data='{
  "workflow_type": "idea_categorization",
  "parameters": {"limit": 5},
  "cache_duration": 3600
}'
run_test "Get Workflow Template" "$DIRECTOR_SERVER/api/mcp/get-workflow-template" "POST" "$template_data"

# Test 5: Create Agent Instructions
instructions_data="{
  \"workflow_type\": \"idea_categorization\",
  \"target_agent\": \"notion\",
  \"parameters\": {
    \"source_database_id\": \"$SOURCE_DB_ID\",
    \"projects_database_id\": \"$PROJECTS_DB_ID\",
    \"knowledge_database_id\": \"$KNOWLEDGE_DB_ID\",
    \"journal_database_id\": \"$JOURNAL_DB_ID\",
    \"limit\": 1
  }
}"
run_test "Create Agent Instructions" "$DIRECTOR_SERVER/api/mcp/create-agent-instructions" "POST" "$instructions_data"

# Test 6: Get Workflow Template + Create Instructions (Unified Workflow Compatible)
# This tests the MCP tools that your n8n unified workflow would actually use
workflow_template_data="{
  \"workflow_type\": \"idea_categorization\",
  \"parameters\": {
    \"source_database_id\": \"$SOURCE_DB_ID\",
    \"limit\": 1
  }
}"
run_test "Get Workflow Template (Unified Workflow)" "$DIRECTOR_SERVER/api/mcp/get-workflow-template" "POST" "$workflow_template_data"

# Test 6b: Create Instructions from Template (What Director Agent does)
agent_instructions_data="{
  \"workflow_type\": \"idea_categorization\",
  \"target_agent\": \"notion\",
  \"parameters\": {
    \"source_database_id\": \"$SOURCE_DB_ID\",
    \"limit\": 1
  },
  \"focus_areas\": [\"categorization\", \"multi_idea_parsing\"]
}"
run_test "Create Agent Instructions (Director→Agent)" "$DIRECTOR_SERVER/api/mcp/create-agent-instructions" "POST" "$agent_instructions_data"

# Test 7: List Contexts
run_test "List Active Contexts" "$DIRECTOR_SERVER/api/context"

# Test 8: Error Handling - Invalid Template
invalid_template='{
  "workflow_type": "nonexistent_template"
}'
run_test "Error Handling - Invalid Template" "$DIRECTOR_SERVER/api/mcp/get-workflow-template" "POST" "$invalid_template" "400"

# Test 9: Clear Cache
run_test "Clear Template Cache" "$DIRECTOR_SERVER/api/admin/clear-cache" "POST" "{}"

# Additional integration tests
echo -e "\n${PURPLE}🔗 Integration Tests${NC}"
echo "=================================================="

# Test Notion MCP Server connectivity
echo -e "\n${YELLOW}Testing Notion MCP Server connectivity...${NC}"
if curl -s "$NOTION_SERVER/health" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Notion MCP Server is reachable${NC}"
else
    echo -e "${RED}❌ Notion MCP Server is not reachable${NC}"
fi

# Test n8n Server connectivity  
echo -e "\n${YELLOW}Testing n8n Server connectivity...${NC}"
if curl -s "$N8N_SERVER/healthz" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ n8n Server is reachable${NC}"
else
    echo -e "${RED}❌ n8n Server is not reachable${NC}"
fi

# Final results
echo -e "\n${BLUE}📊 Test Results Summary${NC}"
echo "=================================================="
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Total Tests: $TOTAL_TESTS"
echo -e "Success Rate: ${GREEN}$(( (TESTS_PASSED * 100) / TOTAL_TESTS ))%${NC}"

if [ $TESTS_PASSED -eq $TOTAL_TESTS ]; then
    echo -e "\n${GREEN}🎉 ALL TESTS PASSED!${NC}"
    echo -e "${GREEN}Director MCP Server is working correctly${NC}"
    echo ""
    echo -e "${BLUE}Next Steps:${NC}"
    echo "1. Import the n8n test workflow: n8n/workflows/director-mcp-test.json"
    echo "2. Import the Postman collection: testing/Director-MCP-Server-Postman-Collection.json"
    echo "3. Test with real Notion Agent integration"
    echo "4. Create additional workflow templates"
else
    echo -e "\n${YELLOW}⚠️  Some tests failed${NC}"
    echo -e "${YELLOW}Check the failed tests above for troubleshooting${NC}"
    echo ""
    echo -e "${BLUE}Troubleshooting:${NC}"
    echo "1. Ensure Director MCP Server is running: ./scripts/start-director-mcp.sh"
    echo "2. Check if all required services are running"
    echo "3. Verify template files exist in director-mcp/workflow-templates/"
    echo "4. Check network connectivity between services"
fi

echo ""

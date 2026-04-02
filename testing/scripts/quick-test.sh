#!/bin/bash

# Quick Test Script for Director MCP Server
# Tests basic functionality without requiring Postman

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
DIRECTOR_URL="http://localhost:3002"
N8N_URL="http://localhost:5678"
NOTION_URL="http://localhost:3001"

echo -e "${BLUE}🧪 Director MCP Server - Quick Test Suite${NC}"
echo "=================================================="

# Function to test endpoint
test_endpoint() {
    local name="$1"
    local url="$2"
    local method="${3:-GET}"
    local data="$4"
    
    echo -n "Testing $name... "
    
    if [ "$method" = "POST" ]; then
        if [ -n "$data" ]; then
            response=$(curl -s -w "%{http_code}" -X POST "$url" \
                -H "Content-Type: application/json" \
                -d "$data" || echo "000")
        else
            response=$(curl -s -w "%{http_code}" -X POST "$url" || echo "000")
        fi
    else
        response=$(curl -s -w "%{http_code}" "$url" || echo "000")
    fi
    
    http_code="${response: -3}"
    body="${response%???}"
    
    if [ "$http_code" -eq 200 ] || [ "$http_code" -eq 201 ]; then
        echo -e "${GREEN}✅ PASS${NC} (HTTP $http_code)"
        if [ ${#body} -lt 200 ]; then
            echo "   Response: $body"
        else
            echo "   Response length: ${#body} chars"
        fi
        return 0
    else
        echo -e "${RED}❌ FAIL${NC} (HTTP $http_code)"
        if [ ${#body} -lt 200 ]; then
            echo "   Error: $body"
        fi
        return 1
    fi
}

echo -e "\n${YELLOW}Phase 1: Health Checks${NC}"
echo "-------------------------------"

# Test Director MCP Server health
test_endpoint "Director MCP Server Health" "$DIRECTOR_URL/health"

# Test Notion MCP Server health 
test_endpoint "Notion MCP Server Health" "$NOTION_URL/health"

# Test n8n health (might not have health endpoint)
echo -n "Testing n8n availability... "
if curl -s "$N8N_URL" > /dev/null; then
    echo -e "${GREEN}✅ PASS${NC}"
else
    echo -e "${YELLOW}⚠️  n8n may not be running${NC}"
fi

echo -e "\n${YELLOW}Phase 2: Template System${NC}"
echo "-------------------------------"

# Test template loading
template_request='{
  "workflow_type": "idea_categorization",
  "parameters": {"limit": 5}
}'

test_endpoint "Get Workflow Template" "$DIRECTOR_URL/api/mcp/get-workflow-template" "POST" "$template_request"

# Test instruction creation
instruction_request='{
  "workflow_type": "idea_categorization",
  "target_agent": "notion",
  "parameters": {
    "source_database_id": "16cd7be3dbcd80e1aac9c3a95ffaa61a",
    "limit": 1
  }
}'

test_endpoint "Create Agent Instructions" "$DIRECTOR_URL/api/mcp/create-agent-instructions" "POST" "$instruction_request"

echo -e "\n${YELLOW}Phase 3: System Management${NC}"
echo "-------------------------------"

# Test system stats
test_endpoint "System Statistics" "$DIRECTOR_URL/api/stats"

# Test agent health
test_endpoint "All Agents Health" "$DIRECTOR_URL/api/agents/health"

# Test context listing
test_endpoint "List Active Contexts" "$DIRECTOR_URL/api/context"

echo -e "\n${YELLOW}Phase 4: Integration Test${NC}"
echo "-------------------------------"

# Test full workflow execution (if services are available)
workflow_request='{
  "workflow_type": "idea_categorization",
  "target_agent": "notion",
  "parameters": {
    "source_database_id": "16cd7be3dbcd80e1aac9c3a95ffaa61a",
    "limit": 1
  }
}'

echo -n "Testing Full Workflow Execution... "
response=$(curl -s -w "%{http_code}" -X POST "$DIRECTOR_URL/api/mcp/execute-workflow" \
    -H "Content-Type: application/json" \
    -d "$workflow_request" || echo "000")

http_code="${response: -3}"
body="${response%???}"

if [ "$http_code" -eq 200 ]; then
    echo -e "${GREEN}✅ PASS${NC} (HTTP $http_code)"
    echo "   Workflow executed successfully"
    
    # Try to parse and show key results
    if command -v jq > /dev/null 2>&1; then
        context_id=$(echo "$body" | jq -r '.data.context_id // "unknown"')
        workflow_complete=$(echo "$body" | jq -r '.data.workflow_complete // false')
        echo "   Context ID: $context_id"
        echo "   Workflow Complete: $workflow_complete"
    fi
else
    echo -e "${YELLOW}⚠️  PARTIAL${NC} (HTTP $http_code)"
    echo "   This test requires n8n and Notion MCP Server to be fully configured"
    if [ ${#body} -lt 300 ]; then
        echo "   Response: $body"
    fi
fi

echo -e "\n${YELLOW}Phase 5: n8n Integration Test${NC}"
echo "-------------------------------"

# Test n8n webhook (simplified)
webhook_request='{
  "agent_id": "notion",
  "task_id": "quick_test_001",
  "instruction": {
    "task_type": "test_connection",
    "objective": "Test Director to n8n communication"
  }
}'

echo -n "Testing n8n Webhook Integration... "
response=$(curl -s -w "%{http_code}" -X POST "$N8N_URL/webhook/director-test" \
    -H "Content-Type: application/json" \
    -d "$webhook_request" 2>/dev/null || echo "000")

http_code="${response: -3}"

if [ "$http_code" -eq 200 ]; then
    echo -e "${GREEN}✅ PASS${NC} (HTTP $http_code)"
    echo "   n8n webhook is responding"
elif [ "$http_code" -eq 404 ]; then
    echo -e "${YELLOW}⚠️  SETUP NEEDED${NC} (HTTP $http_code)"
    echo "   Import director-agent-test.json workflow into n8n"
elif [ "$http_code" = "000" ]; then
    echo -e "${YELLOW}⚠️  n8n NOT RUNNING${NC}"
    echo "   Start n8n on port 5678"
else
    echo -e "${YELLOW}⚠️  PARTIAL${NC} (HTTP $http_code)"
    echo "   n8n responding but workflow may need configuration"
fi

echo -e "\n${BLUE}📊 Test Summary${NC}"
echo "=================================================="

# Count successful tests (basic estimation)
if curl -s "$DIRECTOR_URL/health" > /dev/null; then
    echo -e "${GREEN}✅ Director MCP Server: OPERATIONAL${NC}"
else
    echo -e "${RED}❌ Director MCP Server: NOT RUNNING${NC}"
fi

if curl -s "$NOTION_URL/health" > /dev/null; then
    echo -e "${GREEN}✅ Notion MCP Server: OPERATIONAL${NC}"
else
    echo -e "${YELLOW}⚠️  Notion MCP Server: CHECK STATUS${NC}"
fi

if curl -s "$N8N_URL" > /dev/null; then
    echo -e "${GREEN}✅ n8n: ACCESSIBLE${NC}"
else
    echo -e "${YELLOW}⚠️  n8n: CHECK STATUS${NC}"
fi

echo ""
echo -e "${BLUE}🚀 Next Steps:${NC}"
echo "1. Import n8n/workflows/director-agent-test.json into n8n"
echo "2. Configure OpenAI API credentials in n8n"
echo "3. Update database IDs in Postman collection"
echo "4. Run full Postman test suite"
echo "5. Test end-to-end workflow execution"

echo ""
echo -e "${GREEN}Quick test completed!${NC}"
echo -e "${BLUE}For comprehensive testing, see: testing/TESTING_GUIDE.md${NC}"

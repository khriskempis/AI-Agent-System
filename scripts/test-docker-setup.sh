#!/bin/bash

# Docker Setup Test Script for Director MCP Server
# Tests that all Docker services start correctly and communicate properly

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${BLUE}🐳 Testing Docker Setup for Director MCP Server${NC}"
echo "============================================================"

# Test results tracking
TESTS_PASSED=0
TOTAL_TESTS=0

# Function to run a test
run_test() {
    local test_name="$1"
    local command="$2"
    local expected_result="$3"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -e "\n${YELLOW}Test $TOTAL_TESTS: $test_name${NC}"
    
    if eval "$command"; then
        echo -e "${GREEN}✅ PASSED${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}❌ FAILED${NC}"
        if [ ! -z "$expected_result" ]; then
            echo -e "${YELLOW}Expected: $expected_result${NC}"
        fi
    fi
}

# Test 1: Docker is running
run_test "Docker is running" "docker info >/dev/null 2>&1"

# Test 2: Docker Compose version
run_test "Docker Compose is available" "docker-compose --version >/dev/null 2>&1"

# Test 3: Build Director MCP Server
echo -e "\n${BLUE}Building Director MCP Server...${NC}"
run_test "Director MCP Server builds successfully" "docker-compose build director-mcp-server"

# Test 4: Start services
echo -e "\n${BLUE}Starting services...${NC}"
run_test "Services start without errors" "docker-compose up -d director-mcp-server notion-idea-server-http"

# Wait for services to be ready
echo -e "\n${YELLOW}⏳ Waiting for services to start (30 seconds)...${NC}"
sleep 30

# Test 5: Health checks
run_test "Notion MCP Server is healthy" "curl -f -s http://localhost:3001/health >/dev/null"
run_test "Director MCP Server is healthy" "curl -f -s http://localhost:3002/health >/dev/null"

# Test 6: Template loading
echo -e "\n${BLUE}Testing Director MCP Server functionality...${NC}"
template_test='curl -f -s -X POST http://localhost:3002/api/mcp/get-workflow-template -H "Content-Type: application/json" -d "{\"workflow_type\": \"idea_categorization\"}" | jq -e ".success == true" >/dev/null'
run_test "Template loading works" "$template_test"

# Test 7: Agent communication
echo -e "\n${BLUE}Testing inter-service communication...${NC}"
comm_test='curl -f -s http://localhost:3002/api/agents/health | jq -e ".success == true" >/dev/null'
run_test "Agent health check works" "$comm_test"

# Test 8: Container health
run_test "Director container is healthy" "docker inspect mcp-director-server --format='{{.State.Health.Status}}' | grep -q 'healthy'"
run_test "Notion container is running" "docker ps | grep -q 'mcp-notion-idea-server-http'"

# Test 9: Logs are accessible
run_test "Director logs are accessible" "docker-compose logs director-mcp-server | tail -5 >/dev/null"

# Test 10: Volumes are mounted
run_test "Template volumes are mounted" "docker exec mcp-director-server ls -la /app/director-mcp/workflow-templates/ >/dev/null"

echo -e "\n${PURPLE}📊 Docker Setup Test Results${NC}"
echo "============================================================"
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Total Tests: $TOTAL_TESTS"
echo -e "Success Rate: ${GREEN}$(( (TESTS_PASSED * 100) / TOTAL_TESTS ))%${NC}"

if [ $TESTS_PASSED -eq $TOTAL_TESTS ]; then
    echo -e "\n${GREEN}🎉 ALL DOCKER TESTS PASSED!${NC}"
    echo -e "${GREEN}Director MCP Server Docker setup is working correctly${NC}"
    echo ""
    echo -e "${BLUE}✅ What's working:${NC}"
    echo "   • Director MCP Server container builds and runs"
    echo "   • Health checks pass for all services"
    echo "   • Template loading functionality works"
    echo "   • Inter-service communication is established"
    echo "   • Volumes are properly mounted"
    echo "   • Logs are accessible for debugging"
    echo ""
    echo -e "${BLUE}🚀 Ready for:${NC}"
    echo "   • Production deployment: ./scripts/start-full-project.sh"
    echo "   • Development work: ./scripts/start-development.sh"
    echo "   • API testing: ./testing/test-director-endpoints.sh"
    echo "   • n8n workflow testing: Import director-mcp-test.json"
else
    echo -e "\n${YELLOW}⚠️  Some Docker tests failed${NC}"
    echo -e "${YELLOW}Docker setup needs attention${NC}"
    echo ""
    echo -e "${BLUE}🔍 Troubleshooting:${NC}"
    echo "   • Check Docker Desktop is running and has sufficient resources"
    echo "   • Ensure ports 3001, 3002, 5678 are not in use by other services"
    echo "   • Verify template files exist in director-mcp/workflow-templates/"
    echo "   • Check if .env file exists in notion-idea-server/ directory"
    echo "   • Try rebuilding with: docker-compose build --no-cache"
    echo ""
    echo -e "${BLUE}📋 Manual checks:${NC}"
    echo "   • docker ps  # Check running containers"
    echo "   • docker-compose logs director-mcp-server  # Check Director logs"
    echo "   • docker-compose logs notion-idea-server-http  # Check Notion logs"
    echo "   • curl http://localhost:3002/health  # Test Director health"
    echo "   • curl http://localhost:3001/health  # Test Notion health"
fi

# Clean up
echo -e "\n${BLUE}🧹 Cleaning up test containers...${NC}"
docker-compose down

echo ""

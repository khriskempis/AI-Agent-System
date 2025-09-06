#!/bin/bash

# Start Director MCP Server
# Intelligent workflow orchestration and multi-agent coordination

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DIRECTOR_DIR="$PROJECT_ROOT/director-mcp-server"

echo -e "${BLUE}🎯 Starting Director MCP Server${NC}"
echo "=================================================="

# Check if director-mcp-server directory exists
if [ ! -d "$DIRECTOR_DIR" ]; then
    echo -e "${RED}❌ Director MCP server directory not found: $DIRECTOR_DIR${NC}"
    exit 1
fi

cd "$DIRECTOR_DIR"

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ package.json not found in director-mcp-server directory${NC}"
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install
fi

# Build TypeScript if dist doesn't exist or src is newer
if [ ! -d "dist" ] || [ "src" -nt "dist" ]; then
    echo -e "${YELLOW}🔨 Building TypeScript...${NC}"
    npm run build
fi

# Create logs directory if it doesn't exist
mkdir -p logs

# Check if template directory exists
TEMPLATE_DIR="$PROJECT_ROOT/director-mcp/workflow-templates"
if [ ! -d "$TEMPLATE_DIR" ]; then
    echo -e "${RED}❌ Workflow templates directory not found: $TEMPLATE_DIR${NC}"
    echo -e "${YELLOW}Please ensure the director-mcp directory exists with workflow templates${NC}"
    exit 1
fi

# Check if template registry exists
if [ ! -f "$TEMPLATE_DIR/template-registry.json" ]; then
    echo -e "${RED}❌ Template registry not found: $TEMPLATE_DIR/template-registry.json${NC}"
    exit 1
fi

# Set environment variables
export NODE_ENV="${NODE_ENV:-development}"
export PORT="${DIRECTOR_MCP_PORT:-3002}"
export LOG_LEVEL="${LOG_LEVEL:-info}"
export CORS_ORIGIN="${CORS_ORIGIN:-*}"

echo -e "${GREEN}✅ Environment configured:${NC}"
echo "   Node Environment: $NODE_ENV"
echo "   Port: $PORT"
echo "   Log Level: $LOG_LEVEL"
echo "   Template Directory: $TEMPLATE_DIR"

# Check if port is available
if command -v lsof > /dev/null 2>&1; then
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null; then
        echo -e "${YELLOW}⚠️  Port $PORT is already in use${NC}"
        echo -e "${YELLOW}   Attempting to stop existing process...${NC}"
        
        # Kill existing process
        lsof -ti:$PORT | xargs kill -9 2>/dev/null || true
        sleep 2
        
        if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null; then
            echo -e "${RED}❌ Could not free port $PORT${NC}"
            exit 1
        fi
    fi
fi

# Function to handle cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down Director MCP Server...${NC}"
    if [ ! -z "$SERVER_PID" ]; then
        kill $SERVER_PID 2>/dev/null || true
        wait $SERVER_PID 2>/dev/null || true
    fi
    echo -e "${GREEN}✅ Director MCP Server stopped${NC}"
}

# Register cleanup function
trap cleanup EXIT INT TERM

# Start the server
echo -e "${GREEN}🚀 Starting Director MCP Server on port $PORT...${NC}"
echo ""

if [ "$1" = "--dev" ]; then
    echo -e "${BLUE}📝 Running in development mode (with auto-reload)${NC}"
    npm run dev &
else
    echo -e "${BLUE}🏭 Running in production mode${NC}"
    npm start &
fi

SERVER_PID=$!

# Wait a moment for the server to start
sleep 3

# Check if server started successfully
if kill -0 $SERVER_PID 2>/dev/null; then
    echo -e "${GREEN}✅ Director MCP Server started successfully${NC}"
    echo ""
    echo -e "${BLUE}📡 Server Information:${NC}"
    echo "   • Health Check: http://localhost:$PORT/health"
    echo "   • API Documentation: http://localhost:$PORT/api/stats"
    echo "   • Template Endpoint: http://localhost:$PORT/api/mcp/get-workflow-template"
    echo "   • Agent Health: http://localhost:$PORT/api/agents/health"
    echo ""
    echo -e "${BLUE}🔧 MCP Tools Available:${NC}"
    echo "   • getWorkflowTemplate(workflow_type)"
    echo "   • createAgentInstructions(options)"
    echo "   • executeWorkflow(parameters)"
    echo ""
    echo -e "${BLUE}🎯 Workflow Templates:${NC}"
    echo "   • idea_categorization (Multi-idea parsing and database routing)"
    echo "   • [Future templates will appear here]"
    echo ""
    
    # Test health endpoint
    echo -e "${YELLOW}🏥 Testing health endpoint...${NC}"
    if command -v curl > /dev/null 2>&1; then
        if curl -s "http://localhost:$PORT/health" > /dev/null; then
            echo -e "${GREEN}✅ Health check passed${NC}"
        else
            echo -e "${YELLOW}⚠️  Health check failed (server may still be starting)${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  curl not available, skipping health check${NC}"
    fi
    
    echo ""
    echo -e "${GREEN}🎉 Director MCP Server is ready for workflow orchestration!${NC}"
    echo -e "${BLUE}Press Ctrl+C to stop the server${NC}"
    echo ""
    
    # Wait for the server process
    wait $SERVER_PID
else
    echo -e "${RED}❌ Director MCP Server failed to start${NC}"
    echo -e "${YELLOW}Check the logs above for error details${NC}"
    exit 1
fi

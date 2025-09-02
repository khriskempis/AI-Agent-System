#!/bin/bash

# MCP Servers Hub Management Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HUB_DIR="$(dirname "$SCRIPT_DIR")"

# Function to display help
show_help() {
    echo -e "${GREEN}MCP Servers Hub Management${NC}"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  build [SERVER]     Build Docker images (all servers or specific server)"
    echo "  start [SERVER]     Start MCP servers (all or specific server)"
    echo "  stop [SERVER]      Stop MCP servers (all or specific server)"
    echo "  restart [SERVER]   Restart MCP servers (all or specific server)"
    echo "  logs [SERVER]      View logs (all or specific server)"
    echo "  status             Show status of all servers"
    echo "  dev [SERVER]       Start in development mode"
    echo "  clean              Clean up containers and images"
    echo "  list               List available MCP servers"
    echo ""
    echo "Options:"
    echo "  -f, --follow       Follow log output (for logs command)"
    echo "  -h, --help         Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 build                    # Build all servers"
    echo "  $0 build notion-idea-server # Build specific server"
    echo "  $0 start                    # Start all servers"
    echo "  $0 dev notion-idea-server   # Start server in dev mode"
    echo "  $0 logs -f                  # Follow all logs"
}

# Function to list available servers
list_servers() {
    echo -e "${GREEN}Available MCP Servers:${NC}"
    echo ""
    
    for dir in "$HUB_DIR"/*/; do
        if [ -d "$dir" ] && [ -f "$dir/package.json" ] || [ -f "$dir/Dockerfile" ]; then
            server_name=$(basename "$dir")
            if [ -f "$dir/package.json" ]; then
                description=$(grep '"description"' "$dir/package.json" | sed 's/.*"description": *"\([^"]*\)".*/\1/')
            else
                description="MCP Server"
            fi
            echo -e "  ${BLUE}$server_name${NC} - $description"
        fi
    done
    echo ""
}

# Function to build servers
build_servers() {
    local server=$1
    
    cd "$HUB_DIR"
    
    if [ -n "$server" ]; then
        echo -e "${GREEN}Building $server...${NC}"
        docker-compose build "$server"
    else
        echo -e "${GREEN}Building all MCP servers...${NC}"
        docker-compose build
    fi
}

# Function to start servers
start_servers() {
    local server=$1
    
    cd "$HUB_DIR"
    
    if [ -n "$server" ]; then
        echo -e "${GREEN}Starting $server...${NC}"
        docker-compose up -d "$server"
    else
        echo -e "${GREEN}Starting all MCP servers...${NC}"
        docker-compose up -d
    fi
}

# Function to stop servers
stop_servers() {
    local server=$1
    
    cd "$HUB_DIR"
    
    if [ -n "$server" ]; then
        echo -e "${YELLOW}Stopping $server...${NC}"
        docker-compose stop "$server"
    else
        echo -e "${YELLOW}Stopping all MCP servers...${NC}"
        docker-compose stop
    fi
}

# Function to restart servers
restart_servers() {
    local server=$1
    
    cd "$HUB_DIR"
    
    if [ -n "$server" ]; then
        echo -e "${BLUE}Restarting $server...${NC}"
        docker-compose restart "$server"
    else
        echo -e "${BLUE}Restarting all MCP servers...${NC}"
        docker-compose restart
    fi
}

# Function to view logs
view_logs() {
    local server=$1
    local follow=$2
    
    cd "$HUB_DIR"
    
    local cmd="docker-compose logs"
    
    if [ "$follow" = "true" ]; then
        cmd="$cmd -f"
    fi
    
    if [ -n "$server" ]; then
        echo -e "${PURPLE}Viewing logs for $server...${NC}"
        $cmd "$server"
    else
        echo -e "${PURPLE}Viewing logs for all servers...${NC}"
        $cmd
    fi
}

# Function to show status
show_status() {
    cd "$HUB_DIR"
    
    echo -e "${GREEN}MCP Servers Status:${NC}"
    echo ""
    docker-compose ps
}

# Function to start development mode
start_dev() {
    local server=$1
    
    cd "$HUB_DIR"
    
    if [ -n "$server" ]; then
        echo -e "${GREEN}Starting $server in development mode...${NC}"
        docker-compose --profile dev up "$server-dev"
    else
        echo -e "${GREEN}Starting all servers in development mode...${NC}"
        docker-compose --profile dev up
    fi
}

# Function to clean up
cleanup() {
    cd "$HUB_DIR"
    
    echo -e "${YELLOW}Cleaning up containers and images...${NC}"
    docker-compose down --rmi all --volumes --remove-orphans
    docker system prune -f
}

# Parse arguments
FOLLOW=false
COMMAND=""
SERVER=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--follow)
            FOLLOW=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        build|start|stop|restart|logs|status|dev|clean|list)
            COMMAND=$1
            shift
            ;;
        *)
            if [ -z "$COMMAND" ]; then
                echo -e "${RED}Unknown command: $1${NC}"
                show_help
                exit 1
            else
                SERVER=$1
                shift
            fi
            ;;
    esac
done

# Execute command
case $COMMAND in
    build)
        build_servers "$SERVER"
        ;;
    start)
        start_servers "$SERVER"
        ;;
    stop)
        stop_servers "$SERVER"
        ;;
    restart)
        restart_servers "$SERVER"
        ;;
    logs)
        view_logs "$SERVER" "$FOLLOW"
        ;;
    status)
        show_status
        ;;
    dev)
        start_dev "$SERVER"
        ;;
    clean)
        cleanup
        ;;
    list)
        list_servers
        ;;
    "")
        echo -e "${RED}No command specified${NC}"
        show_help
        exit 1
        ;;
    *)
        echo -e "${RED}Unknown command: $COMMAND${NC}"
        show_help
        exit 1
        ;;
esac 
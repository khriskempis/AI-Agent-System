#!/bin/bash

# =============================================================================
# MCP Server Quick Start - No Prompts, Just Start Everything
# =============================================================================

set -e

echo "🚀 Quick Starting MCP Server + AI Agents..."

# Stop existing and start fresh
docker-compose down --remove-orphans >/dev/null 2>&1

# Start all services
docker-compose up -d notion-idea-server notion-idea-server-http n8n

echo "⏳ Starting services..."
sleep 5

echo "✅ Project Started!"
echo ""
echo "🔗 Access URLs:"
echo "   n8n Platform: http://localhost:5678"
echo "   MCP API:      http://localhost:3001"
echo ""
echo "📦 Running containers:"
docker ps --format "table {{.Names}}\t{{.Status}}" --filter "name=mcp" --filter "name=n8n"

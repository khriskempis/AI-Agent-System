#!/bin/bash

# Test Script for Database Creation Endpoints
# Tests the core functionality before running n8n workflows

echo "🧪 Testing Database Creation Endpoints"
echo "======================================="

# Configuration - Update these with your actual database IDs
SOURCE_IDEAS_DB="16cd7be3dbcd80e1aac9c3a95ffaa61a"
PROJECTS_DB="3cd8ea052d6d4b69956e89b1184cae75"  # Replace with your projects database ID
KNOWLEDGE_DB="87654321432143214321210987654321"   # Replace with your knowledge database ID
JOURNAL_DB="11111111222222223333333344444444"     # Replace with your journal database ID

# Notion server URL (adjust if different)
NOTION_SERVER="http://localhost:3001"  # or http://host.docker.internal:3001 in Docker

echo ""
echo "📋 Configuration:"
echo "Source Ideas DB: $SOURCE_IDEAS_DB"
echo "Projects DB: $PROJECTS_DB"  
echo "Knowledge DB: $KNOWLEDGE_DB"
echo "Journal DB: $JOURNAL_DB"
echo "Server: $NOTION_SERVER"
echo ""

# Test 1: Health Check
echo "🏥 Test 1: Health Check"
echo "curl $NOTION_SERVER/api/health"
curl -s "$NOTION_SERVER/api/health" | jq '.' 2>/dev/null || echo "Server not responding or jq not installed"
echo ""

# Test 2: Get Sample Ideas (to understand source data structure)
echo "💡 Test 2: Get Sample Source Ideas"
echo "curl \"$NOTION_SERVER/api/ideas?limit=2&status=Not Started\""
curl -s "$NOTION_SERVER/api/ideas?limit=2&status=Not%20Started" | jq '.' 2>/dev/null || echo "Failed to get ideas"
echo ""

# Test 3: Get Database Schemas (Critical for understanding target structures)
echo "🗂️ Test 3: Get Target Database Schemas"

echo "Projects Database Schema:"
echo "curl $NOTION_SERVER/api/databases/$PROJECTS_DB/schema"
curl -s "$NOTION_SERVER/api/databases/$PROJECTS_DB/schema" | jq '.' 2>/dev/null || echo "Failed to get projects schema"
echo ""

echo "Knowledge Database Schema:"
echo "curl $NOTION_SERVER/api/databases/$KNOWLEDGE_DB/schema"
curl -s "$NOTION_SERVER/api/databases/$KNOWLEDGE_DB/schema" | jq '.' 2>/dev/null || echo "Failed to get knowledge schema"
echo ""

echo "Journal Database Schema:"
echo "curl $NOTION_SERVER/api/databases/$JOURNAL_DB/schema"
curl -s "$NOTION_SERVER/api/databases/$JOURNAL_DB/schema" | jq '.' 2>/dev/null || echo "Failed to get journal schema"
echo ""

# Test 4: Auto-Config Database Properties (Helpful for understanding property mappings)
echo "⚙️ Test 4: Auto-Config Database Properties"

echo "Projects Auto-Config:"
echo "curl $NOTION_SERVER/api/databases/$PROJECTS_DB/auto-config"
curl -s "$NOTION_SERVER/api/databases/$PROJECTS_DB/auto-config" | jq '.' 2>/dev/null || echo "Failed to get projects auto-config"
echo ""

echo "Knowledge Auto-Config:"
echo "curl $NOTION_SERVER/api/databases/$KNOWLEDGE_DB/auto-config"
curl -s "$NOTION_SERVER/api/databases/$KNOWLEDGE_DB/auto-config" | jq '.' 2>/dev/null || echo "Failed to get knowledge auto-config"
echo ""

# Test 5: Create Database Items (The core functionality)
echo "➕ Test 5: Create Database Items"

echo "Creating PROJECT item..."
echo "curl -X POST $NOTION_SERVER/api/databases/$PROJECTS_DB/pages \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d @project_item_example.json"

# We'll create the JSON files next
echo ""

echo "Creating KNOWLEDGE item..."
echo "curl -X POST $NOTION_SERVER/api/databases/$KNOWLEDGE_DB/pages \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d @knowledge_item_example.json"
echo ""

echo "Creating JOURNAL item..."
echo "curl -X POST $NOTION_SERVER/api/databases/$JOURNAL_DB/pages \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d @journal_item_example.json"
echo ""

echo "🔍 Next: Check the example JSON files and run actual creation tests"
echo ""

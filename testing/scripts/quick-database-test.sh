#!/bin/bash

# Quick Database Endpoint Test (integrates with existing testing infrastructure)
# Run this first to verify your setup before the full n8n workflow

source "$(dirname "$0")/quick-test.sh" 2>/dev/null || true

echo "🧪 QUICK DATABASE ENDPOINT TEST"
echo "================================"
echo "Part of MCP Server Testing Suite"
echo ""

# Configuration - UPDATE THESE WITH YOUR ACTUAL DATABASE IDs
PROJECTS_DB="3cd8ea052d6d4b69956e89b1184cae75"    # ← UPDATE THIS
KNOWLEDGE_DB="87654321432143214321210987654321"    # ← UPDATE THIS  
JOURNAL_DB="11111111222222223333333344444444"      # ← UPDATE THIS

# Try both local and Docker URLs
SERVERS=("http://localhost:3001" "http://host.docker.internal:3001")

echo "🔍 Testing Notion server accessibility..."
SERVER_URL=""
for url in "${SERVERS[@]}"; do
    if curl -s "$url/api/health" >/dev/null 2>&1; then
        echo "✅ Notion server found at: $url"
        SERVER_URL="$url"
        break
    fi
done

if [ -z "$SERVER_URL" ]; then
    echo "❌ Notion server not accessible"
    echo "   Tried: localhost:3001 and host.docker.internal:3001"
    echo "   Make sure the notion-idea-server is running"
    echo ""
    echo "💡 To start the server:"
    echo "   cd ../notion-idea-server && npm run dev"
    echo "   or docker-compose up notion-idea-server-dev"
    exit 1
fi

echo ""
echo "📋 Testing core endpoints for Phase 2 workflow..."
echo ""

# Test 1: Get Projects Database Schema (Critical for n8n workflow)
echo "1. 🗂️ Testing Projects Database Schema Access..."
echo "   curl -s $SERVER_URL/api/databases/$PROJECTS_DB/schema"
RESPONSE=$(curl -s "$SERVER_URL/api/databases/$PROJECTS_DB/schema")
if echo "$RESPONSE" | grep -q '"success":true'; then
    echo "   ✅ Projects schema retrieved successfully"
    # Extract and display property names if jq is available
    if command -v jq &> /dev/null; then
        PROPERTIES=$(echo "$RESPONSE" | jq -r '.data.properties | keys[]' 2>/dev/null | tr '\n' ' ')
        echo "   📝 Available properties: $PROPERTIES"
    fi
else
    echo "   ❌ Projects schema failed"
    echo "   🔍 Response: $RESPONSE"
    echo "   💡 Check that PROJECTS_DB ID is correct and integration has access"
fi

echo ""

# Test 2: Get Knowledge Database Schema
echo "2. 📚 Testing Knowledge Database Schema Access..."
RESPONSE=$(curl -s "$SERVER_URL/api/databases/$KNOWLEDGE_DB/schema")
if echo "$RESPONSE" | grep -q '"success":true'; then
    echo "   ✅ Knowledge schema retrieved successfully"
else
    echo "   ❌ Knowledge schema failed - verify database ID"
fi

echo ""

# Test 3: Get Journal Database Schema  
echo "3. 📔 Testing Journal Database Schema Access..."
RESPONSE=$(curl -s "$SERVER_URL/api/databases/$JOURNAL_DB/schema")
if echo "$RESPONSE" | grep -q '"success":true'; then
    echo "   ✅ Journal schema retrieved successfully"
else
    echo "   ❌ Journal schema failed - verify database ID"
fi

echo ""

# Test 4: Create a test item (The core Phase 2 functionality)
echo "4. ➕ Testing Database Item Creation (Projects DB)..."
echo "   This is the key functionality the n8n workflow will use"

# Simple test item that should work with most project database schemas
TEST_ITEM='{
  "properties": {
    "Name": {"title": [{"text": {"content": "🧪 API Endpoint Test"}}]},
    "Status": {"select": {"name": "Not Started"}},
    "Tags": {"multi_select": [{"name": "test"}, {"name": "api"}, {"name": "endpoint"}]}
  }
}'

echo "   Creating test item..."
RESPONSE=$(curl -s -X POST "$SERVER_URL/api/databases/$PROJECTS_DB/pages" \
  -H "Content-Type: application/json" \
  -d "$TEST_ITEM")

if echo "$RESPONSE" | grep -q '"success":true'; then
    echo "   ✅ Test project item created successfully!"
    if command -v jq &> /dev/null; then
        NEW_ID=$(echo "$RESPONSE" | jq -r '.data.id' 2>/dev/null)
        echo "   🆔 New item ID: $NEW_ID"
    fi
    echo "   📍 Check your Projects database in Notion to see the test item"
else
    echo "   ❌ Project creation failed"
    echo "   🔍 Response: $RESPONSE"
    echo "   💡 Common issues:"
    echo "      - Property names don't match your database schema"
    echo "      - Integration doesn't have write permission"
    echo "      - Database ID is incorrect"
fi

echo ""
echo "📊 QUICK TEST SUMMARY"
echo "====================="

# Count successes (rough check)
SUCCESS_COUNT=0
if echo "$RESPONSE" | grep -q '"success":true'; then
    ((SUCCESS_COUNT++))
fi

if [ $SUCCESS_COUNT -gt 0 ]; then
    echo "✅ Core database creation functionality is working!"
    echo ""
    echo "🎯 READY FOR N8N WORKFLOW TESTING"
    echo "1. Import director-notion-phase2-workflow.json into n8n"  
    echo "2. Update database IDs in the workflow to match your configuration"
    echo "3. Run the Phase 2 workflow to test full database creation"
    echo ""
    echo "💪 For comprehensive testing:"
    echo "   tsx test-database-endpoints.ts"
else
    echo "⚠️  Database creation issues detected"
    echo ""
    echo "🔧 TROUBLESHOOTING STEPS:"
    echo "1. Verify database IDs are correct (check Notion database URLs)"
    echo "2. Ensure Notion integration has access to all target databases"
    echo "3. Check that integration has 'Insert content' permission"
    echo "4. Run comprehensive test: tsx test-database-endpoints.ts"
    echo ""
    echo "🆘 NEED HELP?"
    echo "   Check ../testing/TESTING_GUIDE.md for detailed troubleshooting"
fi

echo ""

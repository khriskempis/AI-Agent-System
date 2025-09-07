#!/bin/bash

# Quick Database Endpoint Test
# Run this first to verify your setup before the full n8n workflow

echo "🧪 QUICK DATABASE ENDPOINT TEST"
echo "================================"

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
        echo "✅ Server found at: $url"
        SERVER_URL="$url"
        break
    fi
done

if [ -z "$SERVER_URL" ]; then
    echo "❌ Notion server not accessible at localhost:3001 or host.docker.internal:3001"
    echo "   Make sure the notion-idea-server is running"
    exit 1
fi

echo ""
echo "📋 Testing core endpoints that n8n workflow will use..."

# Test 1: Get Projects Database Schema
echo "1. Testing Projects Database Schema..."
echo "   curl $SERVER_URL/api/databases/$PROJECTS_DB/schema"
RESPONSE=$(curl -s "$SERVER_URL/api/databases/$PROJECTS_DB/schema")
if echo "$RESPONSE" | grep -q '"success":true'; then
    echo "   ✅ Projects schema retrieved successfully"
else
    echo "   ❌ Projects schema failed - check database ID"
fi

echo ""

# Test 2: Create a simple test item
echo "2. Testing Database Item Creation..."
echo "   Creating test project item..."

TEST_ITEM='{
  "properties": {
    "Name": {"title": [{"text": {"content": "API Test Project"}}]},
    "Status": {"select": {"name": "Not Started"}},
    "Tags": {"multi_select": [{"name": "test"}, {"name": "api"}]}
  }
}'

RESPONSE=$(curl -s -X POST "$SERVER_URL/api/databases/$PROJECTS_DB/pages" \
  -H "Content-Type: application/json" \
  -d "$TEST_ITEM")

if echo "$RESPONSE" | grep -q '"success":true'; then
    echo "   ✅ Test project created successfully!"
else
    echo "   ❌ Project creation failed"
fi

echo ""
echo "📊 SUMMARY: If tests pass ✅, your endpoints are ready for n8n!"

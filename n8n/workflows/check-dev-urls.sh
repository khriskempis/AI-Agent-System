#!/bin/bash

# Quick check for development URLs in main workflows

echo "🔍 Checking main workflows for development URLs..."
echo "=================================================="

for workflow in director-notion-unified-agent.json multi-agent-workflow-system.json director-notion-integration-test.json; do
    if [ -f "n8n/workflows/$workflow" ]; then
        echo "📋 $workflow:"
        
        # Count dev URLs
        DEV_COUNT=$(grep -c "mcp-.*-server.*-dev:" "n8n/workflows/$workflow" 2>/dev/null || echo "0")
        
        # Count prod URLs  
        PROD_COUNT=$(grep -c "mcp-.*-server-http:[^-]" "n8n/workflows/$workflow" 2>/dev/null || echo "0")
        
        if [ "$DEV_COUNT" -gt 0 ]; then
            echo "  ✅ $DEV_COUNT development URLs found"
        elif [ "$PROD_COUNT" -gt 0 ]; then
            echo "  ❌ $PROD_COUNT production URLs found - NEEDS UPDATE"
        else
            echo "  ⚪ No service URLs found"
        fi
    fi
done

echo
echo "💡 To apply development config: ./n8n/workflows/apply-dev-config.sh"


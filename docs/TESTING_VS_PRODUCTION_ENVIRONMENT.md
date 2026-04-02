# Testing vs Production Environment Configuration

## Overview
This document tracks the differences between our current testing setup and what will be required for production deployment.

## Current Testing Environment

### Director MCP Server
- **Current State**: Running in **pure MCP mode** (stdio) via Docker dev container
- **Missing**: HTTP wrapper endpoints (`/api/mcp/update-context`, `/api/mcp/create-agent-instructions`)
- **Workaround**: n8n workflow bypasses Director HTTP calls with local data processing

### Notion Server  
- **Current State**: ✅ Running HTTP wrapper mode on port 3001
- **Status**: Production-ready configuration

### Database Configuration
- **Current State**: Using real Notion database IDs (validated ✅)
- **Status**: Production-ready

## Required Changes for Production

### 1. Director MCP Server HTTP Mode
**Current Issue**: Director container runs `npm run dev` → `tsx src/index.ts` (pure MCP)
**Production Need**: Must run HTTP wrapper → `tsx src/http-wrapper.ts`

#### Required Changes:
```yaml
# docker-compose.yml - Director service needs:
command: ["node", "dist/http-wrapper.js"]  # Instead of npm run dev
ports:
  - "3002:3002"  # Expose HTTP port
```

#### Missing Endpoints to Implement:
- ✅ `/api/mcp/create-agent-instructions` (exists but needs template)
- ❌ `/api/mcp/update-context` (implemented but not accessible)
- ❌ Template: `database_item_creation` (needs to be created)

### 2. n8n Workflow Modifications
**Current Workarounds** (that need to be reverted for production):

#### A. Context Logging Node
```json
// TESTING: Bypassed with Set node
{
  "name": "Director: Log Phase 1 Context (Skipped)",
  "type": "n8n-nodes-base.set"
}

// PRODUCTION: Should be HTTP request
{
  "name": "Director: Log Phase 1 Context", 
  "type": "n8n-nodes-base.httpRequest",
  "url": "http://host.docker.internal:3002/api/mcp/update-context"
}
```

#### B. Phase 2 Instructions Node
```json
// TESTING: Local data preparation
{
  "name": "Prepare Phase 2 Instructions",
  "type": "n8n-nodes-base.set"
}

// PRODUCTION: Should be HTTP request to Director
{
  "name": "Director: Create Phase 2 Instructions",
  "type": "n8n-nodes-base.httpRequest", 
  "url": "http://host.docker.internal:3002/api/mcp/create-agent-instructions"
}
```

#### C. Final Context Update Node
```json
// TESTING: Simple success message
{
  "name": "Workflow Complete ✅",
  "type": "n8n-nodes-base.set"
}

// PRODUCTION: Should be HTTP request
{
  "name": "Director: Final Context Update",
  "type": "n8n-nodes-base.httpRequest",
  "url": "http://host.docker.internal:3002/api/mcp/update-context"
}
```

### 3. Director MCP Server Templates
**Missing Template**: `database_item_creation`

#### Required File:
```
director-mcp/workflow-templates/database-item-creation-v1.json
```

#### Template Registry Update:
```json
// director-mcp/workflow-templates/template-registry.json
{
  "templates": {
    "idea_categorization": "idea-categorization-v1.json",
    "database_item_creation": "database-item-creation-v1.json"  // ADD THIS
  }
}
```

### 4. Docker Configuration
**Current**: Development containers with source mounting
**Production**: Built production containers

#### Required Changes:
```yaml
# Use production services instead of dev services
services:
  director-mcp-server:      # Instead of director-mcp-server-dev
    command: ["node", "dist/http-wrapper.js"]
    ports: ["3002:3002"]
    
  notion-idea-server-http:  # Instead of notion-idea-server-http-dev  
    # Already configured correctly
```

## Testing Environment Advantages

### What Works Well in Testing:
1. **Direct database endpoint testing** ✅
2. **Rich content creation** ✅  
3. **Database schema validation** ✅
4. **n8n workflow structure** ✅
5. **Notion Agent functionality** ✅

### What's Bypassed in Testing:
1. **Director HTTP endpoints** (using local data)
2. **Context management** (skipped)
3. **Template system** (hardcoded instructions)
4. **Agent communication protocol** (simplified)

## Migration Path to Production

### Phase 1: Fix Director HTTP Mode
1. Update Docker configuration to run HTTP wrapper
2. Expose port 3002
3. Test Director endpoints directly

### Phase 2: Create Missing Template  
1. Create `database-item-creation-v1.json`
2. Update template registry
3. Test template generation

### Phase 3: Restore Full Workflow
1. Revert n8n workflow to use HTTP requests
2. Test end-to-end Director communication
3. Validate context management

### Phase 4: Production Deployment
1. Switch to production Docker services
2. Update environment variables
3. Test complete system integration

## Current Status
- ✅ **Database Creation**: Production-ready
- ✅ **Notion Integration**: Production-ready  
- ❌ **Director HTTP Mode**: Testing workaround
- ❌ **Context Management**: Testing bypass
- ❌ **Template System**: Incomplete

## Next Steps for Production Readiness
1. Fix Director MCP Server HTTP mode
2. Create database creation template
3. Test Director endpoints
4. Restore full n8n workflow
5. End-to-end production testing

---
**Note**: Current testing validates core functionality (database creation) but uses simplified Director integration. Production requires full Director MCP protocol implementation.

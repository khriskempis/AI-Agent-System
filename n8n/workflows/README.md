# n8n Workflows - Clean & Organized

## 🚨 **IMPORTANT: Workflow Modification Protocol**

**Before testing any workflow modifications, ALWAYS run:**
```bash
./n8n/workflows/apply-dev-config.sh
```

This ensures workflows use **development service URLs** (`-dev` suffixes) instead of production URLs. See [`WORKFLOW_MODIFICATION_PROTOCOL.md`](WORKFLOW_MODIFICATION_PROTOCOL.md) for details.

## 🎯 **Active Workflows (Ready to Use)**

### **🚀 `director-notion-unified-agent.json`** ✅ **RECOMMENDED - NEW!**
- **Purpose:** Single agent handles both Phase 1 (Categorization) + Phase 2 (Database Creation)
- **Status:** New simplified approach - eliminates debugging issues
- **Features:**
  - ✅ **Single Notion Agent** with ALL tools available
  - ✅ **Phase 1 & 2** handled by same agent with different instructions
  - ✅ **Simplified debugging** - only one agent to troubleshoot
  - ✅ **All tools always available** - no tool limitations per phase
  - ✅ **Based on verified agent templates** - uses working configurations

**Best for:** Production workflows, simplified debugging, reliable execution

---

### **2. `director-notion-integration-test.json`** ✅ **TESTED & WORKING**
- **Purpose:** Phase 1 only - Director MCP Server integration test
- **Status:** Production-ready, successfully tested
- **Features:**
  - ✅ Calls Director MCP Server endpoints
  - ✅ Uses `get-workflow-template` and `create-agent-instructions` endpoints
  - ✅ Proper instruction parsing for Notion Agent
  - ✅ Multi-idea categorization support
  - ✅ Comprehensive error handling

**Best for:** Testing Director integration, understanding the flow, single-agent tasks

---

### **3. `multi-agent-workflow-system.json`** 🔄 **UPDATED WITH DIRECTOR MCP**
- **Purpose:** Multi-agent orchestration with Director MCP Server integration  
- **Status:** Updated Sept 6, 2025 - Ready for advanced testing
- **Features:**
  - 🆕 **Director MCP Server Integration** - Uses working endpoints
  - 🆕 **Multi-Agent Coordination** - Routes between Notion, Planner, Validation agents
  - 🆕 **Advanced orchestration** - Complex workflow lifecycle management

**Best for:** Advanced multi-agent scenarios, complex task orchestration

---

## 🧪 **Testing Order (Recommended)**

### **Phase 1: Test Database Endpoints**
**Before running any workflows**, test the core database functionality:
```bash
cd ../testing
./quick-database-test.sh           # Quick verification
tsx test-database-endpoints.ts     # Comprehensive testing
```

### **Phase 2: Test Individual Workflows**
1. **Start simple:** `director-notion-integration-test.json` (Phase 1 only)
2. **Test unified:** `director-notion-unified-agent.json` (Recommended - Single agent, both phases)
3. **Advanced testing:** `multi-agent-workflow-system.json` (Multi-agent)

---

## 🗄 **Archived Workflows** 

*See `archive/ARCHIVE_README.md` for full details*

### **Recently Archived (Jan 8, 2025):**
- **`director-notion-complete-workflow.json`** - Superseded by unified agent
- **`director-notion-phase2-workflow.json`** - Phase 2 only, now obsolete
- **`multi-agent-workflow-system-updated.json`** - Duplicate version

### **Previously Archived (Sept 6, 2025):**
- **`simplified-intelligent-director.json`** - Duplicate of multi-agent workflow
- **`director-agent-test.json`** - Superseded by director-notion-integration-test  
- **`director-mcp-test.json`** - Superseded by director-notion-integration-test
- **`multi-agent-workflow-system-original.json`** - Pre-MCP integration version

## 📁 **Supporting Folders**

### **`individual-agents/`** ✅ **CURRENT**
- Standalone agent workflows for isolated testing
- `notion-agent.json`, `planner-agent.json`, `validation-agent.json`

### **`webhook-bridges/`** ✅ **CURRENT** 
- Health check webhooks for agent monitoring

### **`examples/`** ✅ **CURRENT**
- Reference workflows and learning materials

---

## 🔧 **Configuration Requirements**

### **Database IDs to Update:**
All Phase 2 and complete workflows need your actual database IDs:

```javascript
// Update these in the workflow JSON files:
"target_databases": {
  "projects": "YOUR_PROJECTS_DATABASE_ID",      
  "knowledge": "YOUR_KNOWLEDGE_DATABASE_ID",    
  "journal": "YOUR_JOURNAL_DATABASE_ID"         
}
```

### **Server URLs:**
- **Director MCP Server:** `http://host.docker.internal:3002`
- **Notion Server:** `http://host.docker.internal:3001`

---

## 🚀 **Quick Start Guide**

### **1. Test Database Endpoints First** (Critical!)
```bash
cd ../testing
./quick-database-test.sh
```

### **2. Import Workflows**
- Import your chosen workflow into n8n
- Update database IDs in the workflow configuration

### **3. Test Execution**
- Start with Phase 1 only (`director-notion-integration-test.json`)
- Proceed to Phase 2 testing after endpoint validation
- Run complete workflow for full automation

---

## 📊 **Success Metrics**

### **Phase 1 Success:**
✅ Ideas retrieved and categorized correctly  
✅ Director context logged properly  
✅ Proper categorization (projects/knowledge/journal routing)  

### **Phase 2 Success:**
✅ Database schemas retrieved automatically  
✅ Items created in correct target databases  
✅ Source ideas marked as "Done"  
✅ Performance metrics captured  

### **Complete Workflow Success:**
✅ End-to-end execution without errors  
✅ All ideas processed and routed correctly  
✅ Director context maintained throughout  

---

## 🔗 **Integration Points**

### **Director MCP Server Endpoints:**
- `GET /api/mcp/get-workflow-template` - Get workflow templates
- `POST /api/mcp/create-agent-instructions` - Generate agent instructions  
- `POST /api/mcp/update-context` - Update workflow context
- `GET /api/stats` - System health and statistics

### **Notion Server Endpoints:**
- `GET /api/databases/{id}/schema` - Get database structure
- `POST /api/databases/{id}/pages` - Create database items
- `GET /api/ideas` - Retrieve source ideas
- `PUT /api/ideas/{id}` - Update idea status

---

**Last Updated:** January 8, 2025  
**Organization:** Unified agent approach, obsolete workflows archived  
**Status:** Clean, organized, simplified for reliable execution  

🎯 **Ready to build robust, multi-phase workflows with proper testing!**
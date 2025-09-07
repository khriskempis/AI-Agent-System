# n8n Workflows - Clean & Organized

## 🎯 **Active Workflows (Ready to Use)**

### **1. `director-notion-integration-test.json`** ✅ **TESTED & WORKING**
- **Purpose:** Phase 1 only - Director MCP Server integration test
- **Status:** Production-ready, successfully tested
- **Features:**
  - ✅ Calls Director MCP Server at `http://host.docker.internal:3002`
  - ✅ Uses `get-workflow-template` and `create-agent-instructions` endpoints
  - ✅ Proper instruction parsing for Notion Agent
  - ✅ Multi-idea categorization support
  - ✅ Comprehensive error handling

**Best for:** Testing Director integration, understanding the flow, single-agent tasks

---

### **2. `director-notion-phase2-workflow.json`** 🆕 **PHASE 2 ONLY**
- **Purpose:** Phase 2 only - Database item creation from categorized ideas
- **Status:** Ready for testing (test database endpoints first)
- **Features:**
  - 🆕 **Mock Phase 1 data** - Uses realistic categorized ideas as input
  - 🆕 **Director context logging** - Logs Phase 1 results and creates Phase 2 instructions
  - 🆕 **Generic database creation** - Creates items in projects/knowledge/journal databases
  - 🆕 **Performance tracking** - Measures creation success rates

**Best for:** Testing database creation functionality, debugging Phase 2 issues

---

### **3. `director-notion-complete-workflow.json`** 🆕 **COMPLETE END-TO-END**  
- **Purpose:** Full workflow - Phase 1 (Categorization) + Phase 2 (Database Creation)
- **Status:** Ready for testing after Phase 2 validation
- **Features:**
  - 🆕 **Complete workflow orchestration** - Full Phase 1 → Phase 2 flow
  - 🆕 **Director context management** - Maintains context across phases
  - 🆕 **Multi-database routing** - Routes categorized ideas to appropriate databases
  - 🆕 **Comprehensive metrics** - End-to-end performance and success tracking

**Best for:** Production multi-step workflows, complete automation, daily processing

---

### **4. `multi-agent-workflow-system.json`** 🔄 **UPDATED WITH DIRECTOR MCP**
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
2. **Test creation:** `director-notion-phase2-workflow.json` (Phase 2 only)  
3. **Test complete:** `director-notion-complete-workflow.json` (End-to-end)
4. **Advanced testing:** `multi-agent-workflow-system.json` (Multi-agent)

---

## 🗄 **Archived Workflows** 

*Moved to `archive/` folder on Sept 6, 2025*

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

**Last Updated:** September 6, 2025  
**Organization:** Testing files moved to `/testing/` folder  
**Status:** Clean, organized, ready for production testing  

🎯 **Ready to build robust, multi-phase workflows with proper testing!**
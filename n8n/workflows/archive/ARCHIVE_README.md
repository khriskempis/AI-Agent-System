# Archived n8n Workflows

## 📁 Workflows Archived

### **Sept 6, 2025** - Initial cleanup

### **Jan 8, 2025** - Post-unified agent cleanup

### **Reason for Archiving:**

#### ✅ **simplified-intelligent-director.json** 
- **Status:** Duplicate of multi-agent-workflow-system.json (identical files)
- **Action:** Archived to avoid confusion
- **Replacement:** Use `multi-agent-workflow-system.json`

#### ✅ **director-agent-test.json**
- **Status:** Superseded by newer, working integration
- **Action:** Archived as outdated
- **Replacement:** Use `director-notion-integration-test.json`

#### ✅ **director-mcp-test.json**  
- **Status:** Superseded by newer, working integration
- **Action:** Archived as outdated  
- **Replacement:** Use `director-notion-integration-test.json`

---

### **Jan 8, 2025** - Post-unified agent cleanup

#### ✅ **director-notion-complete-workflow.json**
- **Status:** Superseded by unified agent approach
- **Issue:** Complex dual-agent setup with debugging issues
- **Action:** Archived in favor of simpler solution
- **Replacement:** Use `director-notion-unified-agent.json`

#### ✅ **director-notion-phase2-workflow.json**
- **Status:** Phase 2 only workflow, now obsolete
- **Issue:** Partial workflow testing no longer needed
- **Action:** Archived - unified agent handles both phases
- **Replacement:** Use `director-notion-unified-agent.json`

#### ✅ **multi-agent-workflow-system-updated.json**
- **Status:** Duplicate/old version of main workflow
- **Issue:** Confusion between multiple versions
- **Action:** Archived to maintain single source of truth
- **Replacement:** Use `multi-agent-workflow-system.json`

## 🎯 **Current Active Workflows (in parent directory):**

### **Primary Workflows:**
1. **`director-notion-unified-agent.json`** - ✅ **NEW** Single agent solution (recommended)
2. **`director-notion-integration-test.json`** - ✅ **WORKING** Director + Notion integration
3. **`multi-agent-workflow-system.json`** - ✅ **ACTIVE** Multi-agent orchestration

### **Testing & Development:**
- **`individual-agents/`** - Individual agent test workflows
- **`examples/`** - Reference examples and templates
- **`webhook-bridges/`** - Health check bridges

## 📚 **Recovery Instructions:**

If you need any of these archived workflows:
1. They're safely stored in this `archive/` folder
2. Can be moved back to parent directory anytime
3. Full git history preserved for reference

---
*These workflows were archived during the n8n cleanup on Sept 6, 2025*

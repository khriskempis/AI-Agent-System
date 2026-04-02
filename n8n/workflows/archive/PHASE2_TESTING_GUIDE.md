# Phase 2 Workflow Testing Guide

## 🎯 **What We Built**

### **Three Workflows for Testing Director + Notion Database Creation:**

1. **`director-notion-phase2-workflow.json`** - Phase 2 Only (Database Creation)
2. **`director-notion-complete-workflow.json`** - Complete Phase 1 + Phase 2 
3. **`director-notion-integration-test.json`** - Phase 1 Only (existing, working)

---

## 🧪 **Testing Scenarios**

### **Scenario 1: Test Phase 2 Only (Isolated Database Creation)**
**Use:** `director-notion-phase2-workflow.json`

**What it tests:**
- Director receives mock categorized ideas from Phase 1
- Director logs context window with Phase 1 results  
- Director creates Phase 2 instructions for database creation
- Notion Agent creates items in projects/knowledge/journal databases
- Director receives final results and updates context

**Mock data included:**
- 3 categorized ideas (1 project, 1 knowledge, 1 journal entry)
- Target database IDs for all three database types
- Realistic categorization metadata (tags, priority, etc.)

---

### **Scenario 2: Test Complete End-to-End Workflow**
**Use:** `director-notion-complete-workflow.json`

**What it tests:**
- **Phase 1**: Director → Notion Agent categorization (gets real ideas from your database)
- **Transition**: Director logs Phase 1 results, prepares Phase 2
- **Phase 2**: Director → Notion Agent database creation (creates items in target databases)
- **Completion**: Director receives final results, complete workflow tracking

**Real integration:**
- Retrieves actual ideas from your configured Notion ideas database
- Creates real database items in your projects/knowledge/journal databases
- Full context tracking and performance metrics

---

### **Scenario 3: Phase 1 Reference (Working Baseline)**
**Use:** `director-notion-integration-test.json` (existing)

**What it tests:**
- Phase 1 categorization only (your working workflow)
- Reference for comparison and troubleshooting

---

## 🔧 **Configuration Requirements**

### **Database IDs to Update:**

In both Phase 2 workflows, update these database IDs to match your actual Notion databases:

```javascript
// In the workflow JSON files, find and update:
"target_databases": {
  "projects": "YOUR_PROJECTS_DATABASE_ID",      // Replace with your projects database ID
  "knowledge": "YOUR_KNOWLEDGE_DATABASE_ID",    // Replace with your knowledge database ID  
  "journal": "YOUR_JOURNAL_DATABASE_ID"         // Replace with your journal database ID
}
```

### **Source Ideas Database:**
```javascript
"source_database_id": "16cd7be3dbcd80e1aac9c3a95ffaa61a"  // Your ideas database (already configured)
```

---

## 🚀 **Testing Workflow**

### **Step 1: Verify Prerequisites**
```bash
# Ensure Director MCP Server is running
curl http://host.docker.internal:3002/api/stats

# Ensure Notion Server is running  
curl http://host.docker.internal:3001/api/health

# Verify your ideas database has some "Not Started" ideas
curl "http://host.docker.internal:3001/api/ideas?status=Not Started&limit=3"
```

### **Step 2: Test Phase 2 Only (Recommended First)**
1. Import `director-notion-phase2-workflow.json` into n8n
2. Update database IDs in the workflow configuration
3. Execute manually
4. Verify:
   - Director logs context correctly
   - Notion Agent gets database schemas
   - Items are created in target databases
   - Source ideas are marked as "Done"

### **Step 3: Test Complete End-to-End Workflow**
1. Import `director-notion-complete-workflow.json` into n8n
2. Update database IDs in the workflow configuration  
3. Execute manually
4. Monitor both phases:
   - Phase 1: Categorization of actual ideas
   - Phase 2: Database item creation
   - Director context logging throughout

### **Step 4: Verify Results**
Check your Notion databases:
- **Projects Database**: New project items created
- **Knowledge Database**: New knowledge entries created  
- **Journal Database**: New journal entries created
- **Ideas Database**: Original ideas marked as "Done"

---

## 🔍 **Key Testing Points**

### **Director Context Logging:**
- Watch for `/api/mcp/update-context` calls in the workflow logs
- Verify context is being properly maintained across phases
- Check that Phase 1 results feed into Phase 2 instructions

### **Generic Database Endpoints:**  
- Verify Notion Agent calls `/api/databases/{id}/schema` before creation
- Check that `/api/databases/{id}/pages` POST requests succeed
- Confirm proper property mapping based on database schemas

### **Multi-Database Routing:**
- Ensure ideas categorized as "projects" create items in projects database
- Ensure ideas categorized as "knowledge" create items in knowledge database  
- Ensure ideas categorized as "journal" create items in journal database

### **Error Handling:**
- Test with invalid database IDs
- Test with missing schema properties
- Verify graceful fallback when creation fails

---

## 📊 **Success Metrics**

### **Phase 2 Success Indicators:**
✅ Database schemas retrieved successfully  
✅ Database items created with proper properties  
✅ Source ideas updated to "Done" status  
✅ Director context updated with creation results  
✅ Performance metrics captured (execution time, API calls)  

### **Complete Workflow Success:**
✅ Phase 1: Ideas categorized correctly  
✅ Transition: Context logged and passed to Phase 2  
✅ Phase 2: Database items created successfully  
✅ Director: Final context update with complete metrics  
✅ No errors in workflow execution  

---

## 🐛 **Troubleshooting**

### **Common Issues:**

**Database Creation Fails:**
- Check database IDs are correct
- Verify Notion integration has access to target databases
- Ensure database schemas are compatible

**Context Logging Issues:**
- Verify Director MCP Server `/api/mcp/update-context` endpoint works
- Check context_id consistency across workflow steps

**Schema Detection Problems:**
- Test `/api/databases/{id}/schema` endpoint manually
- Verify auto-config works: `/api/databases/{id}/auto-config`

**Property Mapping Errors:**
- Check database property names match what's being sent
- Verify required properties are included in creation requests

---

## 🔄 **Next Steps After Testing**

1. **Validate Database Structure**: Ensure created items have proper formatting
2. **Performance Optimization**: Monitor execution times and optimize if needed  
3. **Error Recovery**: Add retry logic for failed creations
4. **Scaling**: Test with larger batches of ideas (5-10 ideas)
5. **Integration**: Connect to your daily workflow automation

**Ready to test the next phase of your Director + Notion workflow!** 🚀

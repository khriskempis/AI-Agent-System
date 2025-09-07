# Database Endpoint Testing

## 🎯 **Purpose**
Test the database creation endpoints that will be used by the Notion Agent in Phase 2 of the n8n workflows. These tests verify the core functionality before running the full workflows.

---

## 📋 **Testing Files (All TypeScript for Uniformity)**

### **🚀 Quick Start**
```bash
# Quick test (recommended first)
./quick-database-test.sh

# Comprehensive TypeScript test
npm run test:database
# or directly: tsx test-database-endpoints.ts
```

### **📁 Files in `/testing/`**

#### **Primary Testing (TypeScript)**
- **`test-database-endpoints.ts`** - Comprehensive TypeScript testing suite
- **`quick-database-test.sh`** - Quick bash test for immediate verification

#### **Example Data**
- **`project_item_example.json`** - Sample project creation data
- **`knowledge_item_example.json`** - Sample knowledge entry data  
- **`journal_item_example.json`** - Sample journal entry data

#### **Legacy/Backup**
- **`test_database_creation.py`** - Python version (kept for reference)
- **`test-database-endpoints.sh`** - Full bash version (kept for reference)
- **`ENDPOINT_TESTING_GUIDE.md`** - Detailed documentation

---

## 🔧 **Configuration**

### **Update Database IDs**
Edit `test-database-endpoints.ts`:
```typescript
const CONFIG = {
  notionServer: 'http://localhost:3001', // or docker URL
  targetDatabases: {
    projects: 'YOUR_ACTUAL_PROJECTS_DATABASE_ID',
    knowledge: 'YOUR_ACTUAL_KNOWLEDGE_DATABASE_ID',  
    journal: 'YOUR_ACTUAL_JOURNAL_DATABASE_ID'
  }
};
```

### **Install Dependencies**
```bash
npm install
```

---

## 🧪 **What We're Testing**

### **Core Phase 2 Workflow:**
```
Categorized Ideas → Get Database Schemas → Create Database Items
       ↓                    ↓                      ↓
   From Phase 1        Auto-detect            POST to create
   JSON results        properties             new pages
```

### **Key Endpoints:**
1. **`GET /api/databases/{id}/schema`** - Get database structure ✅
2. **`GET /api/databases/{id}/auto-config`** - Get property suggestions ✅
3. **`POST /api/databases/{id}/pages`** - Create new database items ✅
4. **`GET /api/health`** - Verify server connectivity ✅

### **Example Data Flow:**
```typescript
// Input from Phase 1 Categorization
{
  "title": "AI Video Generator",
  "categorization": {
    "database": "projects",
    "database_id": "3cd8ea052d6d4b69956e89b1184cae75",
    "tags": ["ai", "video"]
  }
}

// Output to Notion API
{
  "properties": {
    "Name": {"title": [{"text": {"content": "AI Video Generator"}}]},
    "Tags": {"multi_select": [{"name": "ai"}, {"name": "video"}]}
  }
}
```

---

## 🎯 **Success Criteria**

### **✅ All Tests Must Pass:**
- Server connectivity (localhost or Docker)
- Database schema retrieval for all 3 target databases
- Auto-config property mapping suggestions  
- Successful item creation in projects/knowledge/journal databases
- No permission or authentication errors

### **🔍 Verification Steps:**
1. **Check Notion databases** - Test items should appear
2. **Verify property mapping** - Items should have correct properties
3. **No errors in console** - Clean test execution
4. **Performance metrics** - Reasonable response times

---

## 🚀 **Integration with N8N Workflows**

### **After Successful Testing:**
1. **Import workflows** into n8n:
   - `director-notion-phase2-workflow.json` (Phase 2 only)
   - `director-notion-complete-workflow.json` (Phase 1 + Phase 2)

2. **Update database IDs** in n8n workflows to match your testing configuration

3. **Run Phase 2 workflow** with confidence that endpoints work

---

## 🐛 **Troubleshooting**

### **Common Issues:**

#### **Schema Retrieval Fails:**
```bash
# Test manually:
curl "http://localhost:3001/api/databases/YOUR_DB_ID/schema"

# Expected response:
{"success":true,"data":{"properties":{...}}}
```

#### **Item Creation Fails:**
- **Property mismatch**: Use schema to verify correct property names
- **Permission issues**: Ensure integration has write access
- **Format errors**: Check property value formats (title vs rich_text vs select)

#### **Server Connectivity:**
```bash
# Test both URLs:
curl http://localhost:3001/api/health
curl http://host.docker.internal:3001/api/health
```

---

## 📊 **Output Interpretation**

### **TypeScript Test Output:**
```
✅ All database creation tests passed!
   Ready to test the full n8n workflow.

Database items created: 3/3
1. Check your Notion databases for the test items created
2. Verify the property mappings look correct  
3. Update database IDs in n8n workflows if needed
4. Run the Phase 2 n8n workflow with confidence!
```

### **Quick Test Output:**
```
✅ Core database creation functionality is working!

🎯 READY FOR N8N WORKFLOW TESTING
```

---

## 🔄 **Next Steps**

1. **✅ Pass all database tests** using this testing suite
2. **🔧 Configure n8n workflows** with verified database IDs
3. **🧪 Test Phase 2 workflow** in n8n with mock data
4. **🚀 Test complete workflow** with real Phase 1 → Phase 2 flow

**Your database endpoints are now thoroughly tested and ready for production n8n workflows!** 🎯

# MCP Server Testing Suite

## 🎯 **Comprehensive Testing for All Components**

This testing directory contains all testing utilities for the MCP Server project, organized by component and written in **TypeScript for uniformity**.

---

## 📁 **Testing Structure**

### **🔧 Database Endpoint Testing (Phase 2 Workflows)**
- **`test-database-endpoints.ts`** - Comprehensive TypeScript testing
- **`quick-database-test.sh`** - Quick verification bash script
- **`DATABASE_ENDPOINT_TESTING.md`** - Detailed documentation
- **Example data files:** `*_item_example.json`

### **⚙️ Director MCP Server Testing**  
- **`test-director-endpoints.sh`** - Director API endpoint testing
- **`TESTING_GUIDE.md`** - Comprehensive testing documentation
- **Postman collections:** `Director-MCP-Server-*.json`

### **🚀 Quick Testing**
- **`quick-test.sh`** - Overall system quick test
- **`quick-database-test.sh`** - Database-specific quick test

---

## 🧪 **Usage**

### **Quick Start (Recommended)**
```bash
# Install dependencies
npm install

# Quick test everything
./quick-test.sh

# Quick test database endpoints specifically  
./quick-database-test.sh

# Comprehensive database testing (TypeScript)
npm run test:database
```

### **Specific Component Testing**
```bash
# Test Director MCP Server
npm run test:director

# Test database endpoints comprehensively
npm run test:database

# Run all tests
npm run test:all
```

---

## 📋 **Testing Sequence for N8N Workflows**

### **1. Database Endpoint Testing (CRITICAL FIRST STEP)**
Before running any n8n workflows with Phase 2 (database creation):

```bash
# Quick verification
./quick-database-test.sh

# Comprehensive testing  
npm run test:database
```

**Must pass:** Server connectivity, schema access, item creation

### **2. Director Server Testing**
```bash
# Test Director MCP Server endpoints
./test-director-endpoints.sh
```

**Must pass:** Template loading, instruction creation, context management

### **3. N8N Workflow Testing**
After both endpoint tests pass:
- Import workflows from `../n8n/workflows/`
- Test individual workflows in order
- Monitor execution and debug issues

---

## ⚡ **TypeScript Integration**

### **Why TypeScript?**
- **Consistency** with entire MCP Server codebase
- **Type safety** for API responses and data structures  
- **Better IDE support** and debugging
- **Unified development experience**

### **Running TypeScript Tests**
```bash
# Direct execution
tsx test-database-endpoints.ts

# Via npm scripts  
npm run test:database

# With specific configuration
CONFIG=production tsx test-database-endpoints.ts
```

---

## 🔧 **Configuration**

### **Database Testing Configuration**
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

### **Director Testing Configuration**
Edit `test-director-endpoints.sh` for your Director server URL.

---

## 📊 **Success Criteria**

### **✅ Database Testing Success:**
- All 3 target database schemas retrieved
- Test items created successfully in all databases
- No permission or connectivity errors
- Performance metrics within acceptable ranges

### **✅ Director Testing Success:**  
- All MCP endpoints respond correctly
- Template loading and instruction creation work
- Context management functions properly
- Health checks pass

### **✅ Ready for N8N Workflows:**
- Both database and director tests pass completely
- Configuration matches n8n workflow settings
- All required databases accessible and writable

---

## 🐛 **Troubleshooting**

### **Common Database Issues:**
- **Schema retrieval fails:** Check database IDs and integration permissions
- **Item creation fails:** Verify property names match database schema
- **Connection errors:** Ensure Notion server is running

### **Common Director Issues:**
- **Template loading fails:** Check Director MCP Server is running
- **Context errors:** Verify endpoint URLs and request formats
- **Permission errors:** Check server accessibility and authentication

---

## 📚 **Documentation**

- **`DATABASE_ENDPOINT_TESTING.md`** - Database testing details
- **`TESTING_GUIDE.md`** - Complete testing guide  
- **`../n8n/workflows/README.md`** - N8N workflow documentation
- **`../n8n/workflows/PHASE2_TESTING_GUIDE.md`** - Phase 2 workflow testing

---

## 🔄 **Integration with Development Workflow**

1. **🧪 Test endpoints** using this testing suite
2. **🔧 Configure n8n workflows** with verified settings  
3. **🚀 Run workflows** with confidence
4. **📊 Monitor and debug** using test data and logs

**Your testing infrastructure is now organized, TypeScript-unified, and ready for robust development!** 🎯

# Database Creation Endpoints Testing Guide

## 🎯 **Purpose**
Test the core database creation functionality before running the full n8n workflows. This ensures the Notion Agent can successfully create items in your target databases.

---

## 📋 **What We're Testing**

### **Core Workflow Data Flow:**
```
Categorized Ideas → Get Database Schemas → Create Database Items → Verify Creation
       ↓                    ↓                      ↓                   ↓
   From Phase 1        Auto-detect            POST to create        Check success
   JSON results        properties             new pages              rates
```

### **Key Endpoints:**
1. **`GET /api/databases/{id}/schema`** - Get database structure
2. **`GET /api/databases/{id}/auto-config`** - Get property suggestions  
3. **`POST /api/databases/{id}/pages`** - Create new database items
4. **`GET /api/databases/{id}/pages`** - Verify item creation

---

## 🧪 **Testing Methods**

### **Method 1: Bash Script Testing**
```bash
# Make the script executable
chmod +x test-database-endpoints.sh

# Edit the script to add your actual database IDs
# Then run it:
./test-database-endpoints.sh
```

### **Method 2: Python Script Testing (Recommended)**
```bash
# Install requests if needed
pip install requests

# Edit the CONFIG section with your database IDs
# Then run:
python3 test_database_creation.py
```

### **Method 3: Manual curl Testing**
```bash
# Test health first
curl http://localhost:3001/api/health

# Get database schema
curl "http://localhost:3001/api/databases/YOUR_PROJECTS_DB_ID/schema"

# Create test item
curl -X POST "http://localhost:3001/api/databases/YOUR_PROJECTS_DB_ID/pages" \
  -H "Content-Type: application/json" \
  -d @project_item_example.json
```

---

## 📝 **Example Data Structures**

### **Categorized Idea Input (from Phase 1):**
```json
{
  "idea_id": "16cd7be3dbcd80e1aac9c3a95ffaa61a",
  "title": "AI Video Generator Project",
  "original_content": "Build an open source AI video generation tool...",
  "categorization": {
    "database": "projects",
    "database_id": "3cd8ea052d6d4b69956e89b1184cae75",
    "category": "AI/ML Project", 
    "priority": "High",
    "tags": ["ai", "video", "open-source"]
  }
}
```

### **Database Item Creation (to Notion):**
```json
{
  "properties": {
    "Name": {
      "title": [{"text": {"content": "AI Video Generator Project"}}]
    },
    "Description": {
      "rich_text": [{"text": {"content": "Build an open source AI video generation tool..."}}]
    },
    "Status": {"select": {"name": "Not Started"}},
    "Priority": {"select": {"name": "High"}},
    "Tags": {
      "multi_select": [
        {"name": "ai"}, {"name": "video"}, {"name": "open-source"}
      ]
    }
  }
}
```

---

## 🗄️ **Database Types & Expected Properties**

### **Projects Database:**
- **Name/Title** (title property)
- **Description/Content** (rich_text)  
- **Status** (select: Not Started, In Progress, Done)
- **Priority** (select: High, Medium, Low)
- **Category** (select: various project categories)
- **Tags** (multi_select)
- **Created Date** (date)

### **Knowledge Database:**
- **Title** (title property)
- **Content** (rich_text)
- **Type** (select: Technical Reference, Guide, Notes)
- **Category** (select: various knowledge categories)
- **Tags** (multi_select)
- **Date Added** (date)
- **Priority** (select)

### **Journal Database:**  
- **Title** (title property)
- **Entry/Content** (rich_text)
- **Date** (date)
- **Type** (select: Personal Reflection, Daily Notes, etc.)
- **Category** (select)
- **Tags** (multi_select)
- **Mood** (select)

---

## 🔧 **Configuration Steps**

### **1. Update Database IDs**
Edit the configuration in your chosen testing method:

```bash
# In test-database-endpoints.sh:
PROJECTS_DB="YOUR_ACTUAL_PROJECTS_DATABASE_ID"
KNOWLEDGE_DB="YOUR_ACTUAL_KNOWLEDGE_DATABASE_ID"  
JOURNAL_DB="YOUR_ACTUAL_JOURNAL_DATABASE_ID"
```

```python
# In test_database_creation.py:
"target_databases": {
    "projects": "YOUR_ACTUAL_PROJECTS_DATABASE_ID",
    "knowledge": "YOUR_ACTUAL_KNOWLEDGE_DATABASE_ID",
    "journal": "YOUR_ACTUAL_JOURNAL_DATABASE_ID"
}
```

### **2. Verify Server Connection**
- **Local development**: `http://localhost:3001`
- **Docker environment**: `http://host.docker.internal:3001`
- **Custom setup**: Update the server URL accordingly

### **3. Check Database Permissions**
Ensure your Notion integration has:
- ✅ Read access to all target databases
- ✅ Write access to all target databases  
- ✅ Access to create new pages

---

## 🔍 **What to Look For**

### **✅ Success Indicators:**
- Database schemas return valid property structures
- Auto-config suggests appropriate property mappings
- Database item creation returns 200/201 status codes
- New items appear in your Notion databases with correct properties
- All property types (title, rich_text, select, multi_select, date) work correctly

### **❌ Common Issues:**
- **Schema errors**: Database ID incorrect or no access
- **Property mismatches**: Property names don't match database structure
- **Type errors**: Wrong property type format (e.g., string instead of select object)
- **Permission errors**: Integration lacks write access to database

---

## 🐛 **Troubleshooting**

### **Database Schema Issues:**
```bash
# Test schema endpoint directly
curl "http://localhost:3001/api/databases/YOUR_DB_ID/schema"

# Expected response:
{
  "success": true,
  "data": {
    "properties": {
      "Name": {"type": "title"},
      "Status": {"type": "select", "options": [...]}
    }
  }
}
```

### **Item Creation Failures:**
```bash
# Check property format matches schema
# Common fixes:
# - title: [{"text": {"content": "value"}}] not "value"
# - select: {"name": "option"} not "option"  
# - multi_select: [{"name": "tag1"}, {"name": "tag2"}] not ["tag1", "tag2"]
```

### **Permission Issues:**
- Verify Notion integration is shared with all target databases
- Check integration has Insert Content permission
- Confirm database IDs are correct (visible in database URL)

---

## 🚀 **Success Criteria**

Before proceeding to n8n workflow testing, ensure:

✅ **All database schemas retrieved successfully**  
✅ **Auto-config returns sensible property mappings**  
✅ **Test items created in all 3 target databases (projects, knowledge, journal)**  
✅ **Created items have proper property formatting**  
✅ **No permission or access errors**  

---

## 🔄 **Next Steps After Successful Testing**

1. **Update n8n workflows** with confirmed database IDs
2. **Test Phase 2 only workflow** using the validated endpoints  
3. **Run complete Phase 1 + Phase 2 workflow** with confidence
4. **Monitor creation success rates** in production usage

**Ready to test your database creation endpoints!** 🎯

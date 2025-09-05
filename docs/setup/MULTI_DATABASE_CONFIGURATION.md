# Multi-Database Notion Agent Configuration

## Overview

The enhanced Notion Agent now supports working with multiple Notion databases in a Director ↔ Notion Agent workflow. This guide shows how to configure and use the multi-database functionality.

## Database Setup

### 1. Required Databases

You need to create and configure these Notion databases:

1. **Ideas Database** - Source of unprocessed ideas (existing)
2. **Projects Database** - Actionable tasks and implementations  
3. **Knowledge Archive Database** - Reference materials and resources
4. **Journal Database** - Personal thoughts and reflections

### 2. Get Database IDs

For each database, get the database ID from the URL:
```
https://notion.so/your-workspace/DATABASE_ID?v=view_id
```

Copy the DATABASE_ID portion (32 characters) for each database.

### 3. Update Notion Agent Configuration

In the n8n workflow JSON, update the `testContext.databaseIds` section:

```json
"databaseIds": {
  "ideas": "12345678-1234-1234-1234-123456789abc",
  "projects": "87654321-4321-4321-4321-210987654321", 
  "knowledge": "abcdef12-3456-7890-abcd-ef1234567890",
  "journal": "fedcba98-7654-3210-fedc-ba9876543210"
}
```

## Workflow Phases

### Phase 1: Categorization Analysis

**Director → Notion Agent**
```
"Get recent ideas and categorize them with database routing analysis"
```

**Notion Agent Actions:**
1. Retrieves ideas from ideas database using `get_ideas`
2. Analyzes each idea for multi-idea parsing
3. Determines target database for each detected idea
4. Outputs structured analysis with specific database IDs

**Example Output:**
```
IDEA 1: Build a personal productivity dashboard
TARGET_DATABASE_ID: 87654321-4321-4321-4321-210987654321
DATABASE_TYPE: Projects
TAGS: [App, Productivity, Coding]
ACTIONABLE: Yes
DATABASE_REASONING: This is an actionable implementation task requiring development work
DATA_FOR_DB: {"Name": "Build Productivity Dashboard", "Status": "Not Started", "Tags": ["App", "Productivity", "Coding"], "Priority": "High"}

IDEA 2: Check out this React tutorial video
TARGET_DATABASE_ID: abcdef12-3456-7890-abcd-ef1234567890  
DATABASE_TYPE: Knowledge Archive
TAGS: [Educational, Coding, React]
REFERENCE_VALUE: High
DATABASE_REASONING: This is reference material for future learning
DATA_FOR_DB: {"Title": "React Tutorial Video", "Category": "Educational", "Tags": ["Educational", "Coding"], "Status": "To Review"}
```

### Phase 2: Database Updates

**Director → Notion Agent**
```
"Create page in database 87654321-4321-4321-4321-210987654321 with title 'Build Productivity Dashboard' and status 'Not Started'"
```

**Notion Agent Actions:**
1. Uses `get_database_schema` to understand target database structure
2. Uses `update_database_page` to create/update entries
3. Confirms success/failure back to Director

## Tool Usage Examples

### Getting Database Schema
```javascript
// Notion Agent uses this to understand database structure
get_database_schema({
  database_id: "87654321-4321-4321-4321-210987654321"
})
```

### Creating Pages in Target Databases
```javascript
// Create project entry
update_database_page({
  database_id: "87654321-4321-4321-4321-210987654321",
  page_id: "new",
  properties: {
    "Name": "Build Productivity Dashboard",
    "Status": "Not Started", 
    "Priority": "High",
    "Tags": ["App", "Productivity", "Coding"]
  }
})

// Create knowledge entry  
update_database_page({
  database_id: "abcdef12-3456-7890-abcd-ef1234567890",
  page_id: "new",
  properties: {
    "Title": "React Tutorial Video",
    "Category": "Educational",
    "Status": "To Review",
    "Tags": ["Educational", "Coding"]
  }
})
```

## Testing the Configuration

### 1. Update Database IDs
Replace placeholder IDs in the notion-agent.json with your actual database IDs.

### 2. Test Phase 1 (Categorization)
Run the workflow and verify:
- ✅ Agent retrieves ideas from ideas database
- ✅ Agent analyzes and detects multiple ideas
- ✅ Agent outputs specific database IDs for routing
- ✅ Agent includes structured data for each target database

### 3. Test Phase 2 (Database Updates)  
Manually provide update tasks and verify:
- ✅ Agent can access target databases
- ✅ Agent creates/updates pages with correct properties
- ✅ Agent confirms success/failure status

## Database Schema Requirements

### Projects Database
Required properties:
- `Name` (Title)
- `Status` (Status: Not Started, In Progress, Done)
- `Priority` (Select: High, Medium, Low)
- `Tags` (Multi-select)

### Knowledge Archive Database  
Required properties:
- `Title` (Title)
- `Category` (Select: Educational, Reference, etc.)
- `Status` (Status: To Review, Reviewed, Archived)
- `Tags` (Multi-select)

### Journal Database
Required properties:
- `Title` (Title)
- `Date` (Date)
- `Type` (Select: Thought, Reflection, Insight)
- `Tags` (Multi-select)

## Troubleshooting

### Common Issues

1. **Database Access Errors**
   - Verify database IDs are correct (32 characters)
   - Ensure Notion integration has access to all databases
   - Check database sharing permissions

2. **Property Mapping Errors**
   - Use `auto_config_database` tool to detect properties
   - Verify property names match exactly (case-sensitive)
   - Ensure property types are compatible

3. **Workflow Phase Confusion**
   - Phase 1: Analysis and routing (no database updates)
   - Phase 2: Actual database updates based on Director tasks
   - Don't mix phases in single execution

### Testing Commands

```bash
# Test database connection
curl http://localhost:3001/api/databases/YOUR_DB_ID/test-connection

# Test schema detection
curl http://localhost:3001/api/databases/YOUR_DB_ID/auto-config

# Test page retrieval
curl http://localhost:3001/api/databases/YOUR_DB_ID/pages?limit=5
```

## Director Integration

The Director Agent should use this information to:

1. **Request Categorization**: Ask Notion Agent to analyze ideas
2. **Parse Routing Analysis**: Extract database IDs and data structures  
3. **Generate Update Tasks**: Create specific tasks for each target database
4. **Coordinate Execution**: Send targeted update commands to Notion Agent
5. **Monitor Results**: Track success/failure of database operations

This enables a fully automated idea processing pipeline that routes content to appropriate databases based on intelligent analysis.

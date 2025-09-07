# Notion Dashboard Setup Instructions

## 📋 Overview

This setup creates a comprehensive Notion-based dashboard for monitoring and managing your Director MCP Server workflows. You'll get three main databases that work together to provide full visibility into your system.

## 🏗 Step 1: Create Notion Databases

### A. Create the Databases

1. **Open Notion** and create a new page called "🤖 MCP Workflow Dashboard"

2. **Create Database #1: Workflow Executions**
   - In your dashboard page, type `/database` and create a new database
   - Name it "🤖 Workflow Executions" 
   - Copy the JSON from `workflow-management-database.json` 
   - Use Notion's import feature or manually create the properties:

   **Properties to create:**
   - `Workflow Name` (Title)
   - `Status` (Select: ⏳ Pending, 🏃 Running, ✅ Completed, ❌ Failed, ⏸️ Paused)
   - `Workflow Type` (Select: idea_categorization, content_processing, etc.)
   - `Target Agent` (Select: notion, planner, validation)
   - `Started` (Date)
   - `Completed` (Date)
   - `Duration (ms)` (Number)
   - `Ideas Processed` (Number)
   - `Operations Completed` (Number)
   - `LLM Provider` (Select: OpenAI GPT-4, Anthropic Claude, etc.)
   - `Context ID` (Text)
   - `Error Message` (Text)
   - `Priority` (Select: 🔴 High, 🟡 Medium, 🟢 Low)

3. **Create Database #2: Agent Status Monitor**
   - Create another database called "🤖 Agent Status Monitor"
   - Properties to create:
   - `Agent Name` (Title)
   - `Status` (Select: 🟢 Healthy, 🟡 Degraded, 🔴 Down, 🔄 Starting, ⏸️ Stopped)
   - `Agent Type` (Select: director, notion, planner, validation)
   - `Last Health Check` (Date)
   - `Response Time (ms)` (Number)
   - `Memory Usage (MB)` (Number)
   - `Error Rate (%)` (Number, format as percentage)
   - `Tools Available` (Multi-select)

4. **Create Database #3: Workflow Results**
   - Create another database called "📊 Workflow Results"
   - Properties to create:
   - `Result ID` (Title)
   - `Workflow Execution` (Relation to Workflow Executions database)
   - `Ideas Categorized` (Number)
   - `Projects Created` (Number)
   - `Success Rate` (Number, format as percentage)
   - `Quality Score` (Select: ⭐⭐⭐⭐⭐ Excellent, etc.)

### B. Get Database IDs

1. For each database, click the "..." menu → "Copy link"
2. Extract the database ID from the URL:
   ```
   https://www.notion.so/your-workspace/DATABASE_ID?v=...
   ```
3. Save these IDs - you'll need them for configuration

## 🔧 Step 2: Configure Integration

### A. Create Notion Integration

1. Go to [https://www.notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Click "New integration"
3. Name it "MCP Workflow Dashboard"
4. Select your workspace
5. Copy the "Internal Integration Token"

### B. Share Databases with Integration

1. For each database, click "Share" → "Invite"
2. Paste your integration name and select it
3. Give it "Full access"

### C. Environment Configuration

Add to your `.env` file:

```bash
# Notion Dashboard Configuration
NOTION_DASHBOARD_TOKEN=your_integration_token_here
NOTION_WORKFLOW_EXECUTIONS_DB=your_workflow_db_id
NOTION_AGENT_STATUS_DB=your_agent_status_db_id  
NOTION_WORKFLOW_RESULTS_DB=your_results_db_id
```

## 🚀 Step 3: Integrate with Your MCP Servers

### A. Update Director MCP Server

Add this to your `director-mcp-server/src/index.ts`:

```typescript
import { NotionDashboard } from '../notion-dashboard/dashboard-integration.js';

// Initialize dashboard
const dashboard = new NotionDashboard({
  notion_token: process.env.NOTION_DASHBOARD_TOKEN!,
  workflow_executions_db: process.env.NOTION_WORKFLOW_EXECUTIONS_DB!,
  agent_status_db: process.env.NOTION_AGENT_STATUS_DB!,
  workflow_results_db: process.env.NOTION_WORKFLOW_RESULTS_DB!
});

// In your workflow execution code:
const workflowPageId = await dashboard.logWorkflowExecution({
  workflow_name: "Process Ideas",
  workflow_type: "idea_categorization", 
  target_agent: "notion",
  status: "running",
  context_id: context.context_id,
  llm_provider: "OpenAI GPT-4",
  priority: "medium"
});

// Update status when complete:
await dashboard.updateWorkflowStatus(workflowPageId, {
  status: "completed",
  duration_ms: executionTime,
  ideas_processed: results.length,
  operations_completed: operations.length
});
```

### B. Add Health Monitoring

```typescript
// Regular agent health updates
setInterval(async () => {
  const agentHealth = await agentCommunicator.checkAllAgentsHealth();
  
  for (const [agentName, health] of Object.entries(agentHealth.data.agent_results)) {
    await dashboard.updateAgentStatus(agentName, {
      status: health.success ? 'healthy' : 'down',
      response_time_ms: health.response_time,
      // ... other metrics
    });
  }
}, 30000); // Every 30 seconds
```

## 📊 Step 4: Create Dashboard Views

### A. Create Workflow Overview Page

In your main dashboard page, create:

1. **Status Summary**
   - Embed the Workflow Executions database
   - Filter by "Status" = "Running" for active workflows
   - Group by "Workflow Type" 

2. **Recent Activity**
   - Embed Workflow Executions database
   - Sort by "Started" descending
   - Show last 10 executions

3. **Agent Health Panel** 
   - Embed Agent Status Monitor database
   - Filter by current day
   - Show all agents with status indicators

### B. Create Alert Views

1. **Failed Workflows View**
   - Filter Workflow Executions by Status = "❌ Failed"
   - Sort by most recent

2. **Unhealthy Agents View**
   - Filter Agent Status by Status ≠ "🟢 Healthy"

## 🔔 Step 5: Setup Notifications (Optional)

### A. Slack Integration

```typescript
// Add to your dashboard integration:
async function sendSlackAlert(message: string) {
  if (process.env.SLACK_WEBHOOK_URL) {
    await fetch(process.env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message })
    });
  }
}

// Use in error handling:
await dashboard.updateWorkflowStatus(pageId, {
  status: "failed", 
  error_message: error.message
});

await sendSlackAlert(`🚨 Workflow "${workflowName}" failed: ${error.message}`);
```

### B. Email Alerts via Notion

1. In Notion, create automations for your databases
2. Set triggers for "Status" changes to "Failed" or "Down"
3. Configure email notifications to your team

## 📱 Step 6: Mobile Access

Since it's Notion, you automatically get:
- ✅ Mobile app access
- ✅ Real-time sync across devices  
- ✅ Collaborative editing
- ✅ Comments and discussions
- ✅ Template system for recurring workflows

## 🎯 Benefits of This Setup

1. **Visual Workflow Management** - See all workflows at a glance
2. **Real-time Monitoring** - Agent health and performance metrics
3. **Historical Analysis** - Track patterns and improvements
4. **Team Collaboration** - Comments, assignments, discussions
5. **Mobile Access** - Monitor from anywhere
6. **Custom Views** - Filter and group data as needed
7. **No Additional Hosting** - Uses Notion's infrastructure

## 🔧 Advanced Features

### Custom Formulas

Add calculated fields to your databases:

```notion-formula
// Success Rate calculation
if(prop("Operations Completed") > 0, 
   prop("Ideas Processed") / prop("Operations Completed") * 100, 0)

// Performance Rating
if(prop("Duration (ms)") < 5000, "🟢 Fast",
   if(prop("Duration (ms)") < 15000, "🟡 Medium", "🔴 Slow"))
```

### Automation Rules

Set up Notion automations to:
- Auto-assign failed workflows to team members
- Change priority based on execution time
- Archive old workflow executions
- Send digest reports

This gives you a production-ready dashboard that's as powerful as custom tools but with zero hosting overhead! 🚀

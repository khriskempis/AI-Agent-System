# Director MCP Server

## Overview

The Director MCP Server exposes workflow tools over the **MCP stdio protocol** — it has no HTTP server or port. It is used by Claude Desktop (or any MCP client) to load workflow templates and manage workflow context.

It is **not** involved in the orchestrator's daily pipeline execution. The orchestrator (TypeScript scheduler) runs pipelines directly. The Director MCP Server is used when a human or Claude client needs to author, inspect, or coordinate workflows interactively.

## Components

### TemplateManager (`src/templates/template-manager.ts`)

Reads JSON workflow templates from `director-mcp/workflow-templates/` and the registry at `director-mcp/workflow-templates/template-registry.json`.

**Key methods:**

```typescript
// Load a complete workflow template by type name
async getWorkflowTemplate(workflowType: string): Promise<MCPToolResult>

// Extract focused instructions for a specific agent from a template
async createAgentInstructions(options: TemplateProcessingOptions): Promise<DirectorToAgentInstruction>

// Clear cached templates (forces re-read from disk)
clearCache(): void

// Cache stats — hit rate, cached template count
getCacheStats(): CacheStats
```

Templates are cached in-memory after first load. `clearCache()` forces a reload — useful during template development.

### ContextManager (`src/context/context-manager.ts`)

Maintains shared workflow state across multi-phase interactions. Contexts have a **24-hour TTL** and are cleaned up automatically.

**Key methods:**

```typescript
// Create a new workflow context for a run
createWorkflowContext(workflowId: string, parameters?: Record<string, unknown>): SharedWorkflowContext

// Record an agent's response into the context
updateContextWithAgentResponse(contextId: string, response: AgentToDirectorResponse): MCPToolResult

// Get context filtered for a specific agent's view
getContextForAgent(contextId: string, agentId: string): any

// List all active (non-expired) contexts
listActiveContexts(): SharedWorkflowContext[]

// Stats — active context count, average age
getStats(): ContextStats

// Shutdown — stops the TTL cleanup interval
shutdown(): void
```

## MCP Tools

The server exposes these tools over stdio. Connect with:

```bash
npx @modelcontextprotocol/inspector stdio "node director-mcp-server/dist/index.js"
```

### Workflow Template Tools

| Tool | Description |
|---|---|
| `get_workflow_template` | Load a complete workflow template by type (e.g. `idea-categorization-v1`) |
| `create_agent_instructions` | Extract focused instructions from a template for a specific agent |

### Context Management Tools

| Tool | Description |
|---|---|
| `create_workflow_context` | Create a new workflow context |
| `get_workflow_context` | Retrieve context by ID |
| `update_context_with_agent_response` | Record an agent response into context |
| `get_context_for_agent` | Get the context slice relevant to a specific agent |
| `list_active_contexts` | List all active (non-expired) contexts |

### System Tools

| Tool | Description |
|---|---|
| `get_system_stats` | Server uptime, memory, template cache stats, context manager stats |
| `clear_template_cache` | Force TemplateManager to re-read templates from disk |

## Template Format

Templates live in `director-mcp/workflow-templates/` and are registered in `template-registry.json`:

```json
{
  "templates": {
    "idea-categorization-v1": "idea-categorization-v1.json",
    "database-item-creation-v1": "database-item-creation-v1.json"
  }
}
```

Each template JSON describes the workflow phases, methodology, categorization rules, and execution requirements. `TemplateManager.createAgentInstructions()` extracts only the relevant phase's logic (reducing a 15KB template to ~2.5KB focused instructions).

See [Workflow Templates](./WORKFLOW_TEMPLATES.md) for how to add or modify templates.

## Docker Setup

The director MCP server runs as a stdio container — no port exposure needed.

```yaml
# docker-compose.yml
director-mcp-server:
  volumes:
    - ./director-mcp:/app/director-mcp:ro  # templates + registry
    - ./docs:/app/docs:ro
  # No ports — communicates via stdio
```

Logs go to the `director_logs` Docker volume.

## Environment Variables

```bash
NODE_ENV=production     # or development
LOG_LEVEL=info          # debug | info | warn | error
```

No API keys or service URLs required — the director MCP server only reads local template files and manages in-memory context state.

# Skill: MCP Server Patterns

## Transport

The Director MCP Server uses **stdio transport only**. No HTTP server, no ports.

```typescript
// director-mcp-server/src/index.ts
const transport = new StdioServerTransport();
await server.connect(transport);
```

Never add an HTTP wrapper. If external access is needed, use MCP clients that support stdio.

## Registering a New MCP Tool

### 1. Add to ListTools handler

```typescript
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // ... existing tools ...
      {
        name: 'my_new_tool',
        description: 'What this tool does in one sentence',
        inputSchema: {
          type: 'object',
          properties: {
            required_param: {
              type: 'string',
              description: 'Description of this parameter',
            },
            optional_param: {
              type: 'number',
              description: 'Optional parameter',
            },
          },
          required: ['required_param'],
        },
      },
    ],
  };
});
```

### 2. Add to CallTool switch

```typescript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    switch (name) {
      // ... existing cases ...

      case 'my_new_tool': {
        const required_param = args?.required_param as string;
        if (!required_param) {
          throw new McpError(ErrorCode.InvalidParams, 'required_param is required');
        }

        const result = services.templateManager.doSomething(required_param);

        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, data: result }, null, 2) }],
        };
      }
    }
  } catch (error) {
    if (error instanceof McpError) throw error;
    throw new McpError(ErrorCode.InternalError, `Error: ${error instanceof Error ? error.message : String(error)}`);
  }
});
```

## Shared Services Pattern

Services are initialized once and shared across all tool handlers:

```typescript
// shared-services.ts
export function initializeSharedServices(): { templateManager: TemplateManager; contextManager: ContextManager } {
  templateManager = new TemplateManager();
  contextManager = new ContextManager();
  return { templateManager, contextManager };
}
```

In `index.ts`, destructure once at startup — do not re-initialize per tool call.

## Template JSON Format

Templates live in `director-mcp/workflow-templates/`. Registered in `template-registry.json`:

```json
{
  "templates": {
    "my-workflow-v1": "my-workflow-v1.json"
  }
}
```

Template structure:
```json
{
  "workflow_type": "my-workflow-v1",
  "version": "1.0",
  "description": "What this workflow does",
  "phases": {
    "notion": {
      "task_type": "my_task",
      "methodology": { },
      "execution_requirements": { "required_tools": [] }
    }
  },
  "parameters": {
    "source_database_id": "{{workflow.context.database_ids.ideas}}"
  }
}
```

Use `{{variable.path}}` for runtime parameter substitution.

## ContextManager Usage

```typescript
// Create a context for a multi-phase interactive session
const ctx = contextManager.createWorkflowContext(workflowId, parameters);
// ctx.context_id is the key for subsequent calls

// Update with an agent response
contextManager.updateContextWithAgentResponse(ctx.context_id, agentResponse);

// Get context for a specific agent's view
contextManager.getContextForAgent(ctx.context_id, "notion");

// List all non-expired contexts
contextManager.listActiveContexts();
```

Contexts expire after **24 hours** and are cleaned up automatically. `contextManager.shutdown()` stops the cleanup interval on process exit.

## Testing MCP Tools

```bash
# Interactive MCP inspector
npx @modelcontextprotocol/inspector stdio "node director-mcp-server/dist/index.js"

# After adding a template, reload without restart
# Call: clear_template_cache tool in the inspector
```

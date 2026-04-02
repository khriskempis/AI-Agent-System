# Director MCP Server Setup

The Director MCP Server communicates over **stdio** — it has no HTTP port and is not involved in the orchestrator's daily pipeline execution. It is used by Claude Desktop (or any MCP-compatible client) for interactive workflow authoring and context management.

## Running with the MCP Inspector

```bash
# Build first
cd director-mcp-server && npm run build

# Inspect available tools
npx @modelcontextprotocol/inspector stdio "node director-mcp-server/dist/index.js"
```

## Connecting from Claude Desktop

Add to your Claude Desktop MCP settings:

```json
{
  "mcpServers": {
    "director": {
      "command": "node",
      "args": ["/path/to/MCP Server/director-mcp-server/dist/index.js"],
      "env": {
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

## Running in Docker

```bash
docker-compose up -d director-mcp-server
```

The container runs in the background. Since it uses stdio transport, there is no HTTP health check — verify it started with:

```bash
docker-compose logs director-mcp-server
# Should show: "Director MCP Server running on stdio"
```

## Volume Mounts

The director MCP server needs two read-only volume mounts:

```yaml
volumes:
  - ./director-mcp:/app/director-mcp:ro   # workflow templates + registry
  - ./docs:/app/docs:ro                   # optional reference docs
```

The templates at `director-mcp/workflow-templates/` are read at runtime by TemplateManager. If you add or edit a template while the server is running, call `clear_template_cache` via the MCP inspector to reload without restarting.

## Environment Variables

```bash
NODE_ENV=production     # or development
LOG_LEVEL=info          # debug | info | warn | error
```

No API keys or service URLs required.

## Available MCP Tools

| Tool | Purpose |
|---|---|
| `get_workflow_template` | Load a workflow template by type name |
| `create_agent_instructions` | Extract agent-focused instructions from a template |
| `create_workflow_context` | Start tracking a new workflow run |
| `get_workflow_context` | Retrieve current state of a workflow context |
| `update_context_with_agent_response` | Record an agent's result into a context |
| `get_context_for_agent` | Get context slice relevant to a specific agent |
| `list_active_contexts` | List all non-expired active contexts |
| `get_system_stats` | Server uptime, memory, cache + context stats |
| `clear_template_cache` | Force TemplateManager to re-read templates from disk |

## Adding Workflow Templates

1. Add your JSON file to `director-mcp/workflow-templates/`
2. Register it in `director-mcp/workflow-templates/template-registry.json`
3. Call `clear_template_cache` (or restart the server)

See [Workflow Templates](../development/WORKFLOW_TEMPLATES.md) for the template format.

## Logs

When running in Docker, logs go to the `director_logs` volume and also appear in:

```bash
docker-compose logs -f director-mcp-server
```

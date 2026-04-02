# Workflow Templates

Templates live in `director-mcp/workflow-templates/` and are loaded by the **Director MCP Server's TemplateManager**. They describe the methodology, phases, and execution requirements for a workflow type.

## Registry

`director-mcp/workflow-templates/template-registry.json` maps workflow type names to filenames:

```json
{
  "templates": {
    "idea-categorization-v1": "idea-categorization-v1.json",
    "database-item-creation-v1": "database-item-creation-v1.json"
  }
}
```

## How TemplateManager Uses Templates

1. A Claude client (or orchestrator) calls the `get_workflow_template` MCP tool with a `workflow_type`.
2. TemplateManager looks up the filename in the registry and loads the JSON.
3. Templates are cached in-memory after first load. Call `clear_template_cache` to force a reload.
4. `create_agent_instructions` extracts only the relevant phase's logic — reducing a ~15KB template to ~2.5KB focused instructions targeted at a specific agent.

## Template Structure

Each template JSON contains at minimum:

```json
{
  "workflow_type": "idea-categorization-v1",
  "version": "1.0",
  "description": "...",
  "phases": {
    "notion": {
      "task_type": "multi_idea_categorization",
      "methodology": { ... },
      "execution_requirements": { ... }
    },
    "planner": { ... },
    "validation": { ... }
  },
  "parameters": {
    "source_database_id": "{{workflow.context.database_ids.ideas}}",
    "target_databases": { ... }
  }
}
```

Parameters use `{{variable.path}}` syntax. TemplateManager substitutes runtime values when `create_agent_instructions` is called with a `parameters` object.

## Adding a New Template

1. Create the JSON file in `director-mcp/workflow-templates/`:
   ```
   director-mcp/workflow-templates/my-new-workflow-v1.json
   ```

2. Register it in `template-registry.json`:
   ```json
   {
     "templates": {
       "idea-categorization-v1": "idea-categorization-v1.json",
       "my-new-workflow-v1": "my-new-workflow-v1.json"
     }
   }
   ```

3. Test it via the MCP inspector:
   ```bash
   npx @modelcontextprotocol/inspector stdio "node director-mcp-server/dist/index.js"
   # Call get_workflow_template with workflow_type = "my-new-workflow-v1"
   ```

4. If the director MCP server is running in Docker, either restart it or call `clear_template_cache` — the volume mount at `./director-mcp:/app/director-mcp:ro` means the file is already visible inside the container.

## Relationship to TypeScript Pipelines

Templates are used when a Claude client (Layer 3 Director) needs to read methodology or generate instructions on the fly. The TypeScript pipelines in `orchestrator/src/pipelines/` implement the actual execution logic in code — they don't read templates at runtime.

Think of templates as the **specification** that documents what a pipeline does; the pipeline code is the **implementation**.

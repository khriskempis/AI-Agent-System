# MCP Server Documentation

Welcome to the MCP Server project — an intelligent idea processing system built with TypeScript pipelines, Claude agents, and Notion as the data layer.

## System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  orchestrator  (TypeScript — runs as a Docker container)     │
│                                                              │
│  node-cron (09:00 ET daily)                                  │
│      → runDailyProcessing pipeline                           │
│          → NotionAgent  (Layer 1: Notion HTTP facade)        │
│          → categorizeIdea  (Layer 2: Claude pipeline)        │
│      → PlannerAgent   (Layer 2: planning stub)               │
│      → ValidationAgent (Layer 2: QA assessment)             │
│  WorkflowContext tracks per-run phase results                │
├──────────────────────────────────────────────────────────────┤
│  notion-idea-server-http  (port 3001)                        │
│  REST API over Notion — NotionAgent calls this               │
├──────────────────────────────────────────────────────────────┤
│  director-mcp-server  (stdio MCP — no HTTP port)             │
│  TemplateManager + ContextManager exposed as MCP tools       │
│  Used by Claude Desktop / MCP clients for workflow authoring │
├──────────────────────────────────────────────────────────────┤
│  MySQL  (port 3306)                                          │
│  workflow_runs + workflow_events — durable audit log         │
└──────────────────────────────────────────────────────────────┘
```

## 3-Layer Agent Architecture

| Layer | What it is | Examples |
|---|---|---|
| Layer 3 — Director | Decides what pipelines to run, composes them dynamically | `scheduler.ts`, future director agent |
| Layer 2 — Pipelines | Specific use cases — ordered sequences of tool calls | `categorize-idea.ts`, `daily-processing.ts` |
| Layer 1 — Capability | Facade over external APIs — read/write/search methods only | `NotionAgent` |

**Rule: pipelines use agents, agents don't run pipelines.**

## [ARCHITECTURE.md](./ARCHITECTURE.md)

The single authoritative reference for the full system. Read this first. Covers the 3-layer agent architecture, all component boundaries, pipeline stages, agent interfaces, WorkflowContext, withRetry, MySQL schema, Director MCP Server internals, and design decisions.

---

## Documentation Structure

### Setup
- **[Orchestrator Setup](./setup/ORCHESTRATOR_SETUP.md)** — env vars, CLI commands, Docker, MySQL inspection
- **[Director MCP Server Setup](./setup/DIRECTOR_MCP_SERVER_SETUP.md)** — stdio MCP usage, volume mounts for templates
- **[API Endpoints](./setup/API_ENDPOINTS.md)** — notion-idea-server HTTP API reference
- **[Multi-Database Configuration](./setup/MULTI_DATABASE_CONFIGURATION.md)** — Notion database ID configuration

### Development
- **[TypeScript Pipeline Architecture](./development/TYPESCRIPT_PIPELINE_ARCHITECTURE.md)** — canonical reference: pipeline stages, agent interfaces, withRetry, MySQL schema
- **[Director MCP Server Implementation](./development/DIRECTOR_MCP_SERVER_IMPLEMENTATION.md)** — TemplateManager, ContextManager, surviving MCP tools
- **[Multi-Agent Pipeline](./development/MULTI_AGENT_PIPELINE.md)** — the NotionAgent → PlannerAgent → ValidationAgent chain
- **[Daily Processing](./development/DAILY_PROCESSING_MODES.md)** — how the scheduler and daily pipeline work
- **[Workflow Templates](./development/WORKFLOW_TEMPLATES.md)** — JSON templates in `director-mcp/workflow-templates/`
- **[Adding New Agents](./development/ADDING_NEW_AGENTS.md)** — step-by-step guide for extending the system

### Troubleshooting
- **[Notion Property Fix](./troubleshooting/NOTION_PROPERTY_FIX.md)** — Notion property validation errors
- **[Notion Content Enhancement](./troubleshooting/NOTION_CONTENT_ENHANCEMENT.md)** — content formatting issues

### Archived
- **[Multi-Agent Workflow Plan](./archived/MULTI_AGENT_WORKFLOW_PLAN.md)** — original architecture planning
- **[Multi-Agent Pipeline Design](./archived/MULTI_AGENT_PIPELINE_DESIGN.md)** — historical n8n workflow design (superseded by TypeScript pipelines)
- **[Monitoring Dashboard Design](./archived/MONITORING_DASHBOARD_DESIGN.md)** — future monitoring concepts

## Quick Start

```bash
# Start all production services
./scripts/start-full-project.sh

# Development mode (hot reload)
./scripts/start-development.sh

# Check orchestrator is ready to run
./scripts/sync-agent-configs.sh
```

## Running the Orchestrator

```bash
cd orchestrator

# Process a single idea (test without writing)
npx tsx src/index.ts categorize-idea --id <notion-page-id> --dry-run

# Process all unprocessed ideas once
npx tsx src/index.ts categorize-idea --all

# Start the daily scheduler (fires at 09:00 ET)
npm start
```

## Inspecting Workflow History

```bash
docker exec -it orchestrator-mysql mysql -u orchestrator -porchestrator orchestrator

-- Recent runs
SELECT notion_page_name, status, current_stage, started_at
FROM workflow_runs ORDER BY started_at DESC LIMIT 10;

-- Events for a specific run
SELECT stage, status, duration_ms FROM workflow_events
WHERE run_id = '<run-id>' ORDER BY id;
```

---

**Last Updated**: April 2026
**Architecture**: TypeScript pipelines + Claude agents + MySQL audit log

# MCP Server — Claude Code Setup

## Slash Commands

| Command | Purpose |
|---|---|
| `/mcp-server verify` | Run environment check — service reachability, env vars, MySQL |
| `/mcp-server add-pipeline` | Guided walkthrough for adding a new pipeline or agent phase |
| `/review code-review` | Review changed files against 3-layer architecture rules |

## Agents

Seven specialist agents in `.claude/agents/`. See `CLAUDE.md` for the full agent table.

| Agent | Best for |
|---|---|
| `pipeline-architect` | Planning multi-step features; mapping which components are involved |
| `typescript-pipeline-engineer` | Pipelines, agent classes, withRetry, MySQL audit tracking |
| `notion-api-engineer` | notion-idea-server endpoints, NotionAgent facade methods |
| `director-mcp-engineer` | MCP tools, workflow templates, TemplateManager/ContextManager |
| `code-reviewer` | Architecture compliance and type safety review (opus, read-only) |
| `qa-tester` | Endpoint testing, dry-run pipelines, MySQL log inspection |
| `devops-engineer` | Docker, docker-compose, env config, startup scripts |

## Skills

Reusable knowledge patterns in `.claude/skills/`:

| Skill | Covers |
|---|---|
| `patterns-typescript-pipeline` | 3-layer rule, withRetry, AgentInput/AgentOutput, WorkflowContext, MySQL hooks |
| `patterns-mcp-server` | MCP tool registration, StdioServerTransport, template JSON format |
| `patterns-notion-api` | Express route patterns, NotionAgent facade rules, UpdateIdeaPayload |

## Quick Start

```bash
# 1. Start all services
./scripts/start-full-project.sh

# 2. Verify environment
./scripts/sync-agent-configs.sh

# 3. Run a single pipeline manually
cd orchestrator
npx tsx src/index.ts categorize-idea --id <notion-page-id> --dry-run

# 4. Inspect audit log
docker exec -it orchestrator-mysql mysql -u orchestrator -porchestrator orchestrator \
  -e "SELECT notion_page_name, status, current_stage FROM workflow_runs ORDER BY started_at DESC LIMIT 10;"
```

## Read First

`docs/ARCHITECTURE.md` — the single authoritative reference for the full system design.

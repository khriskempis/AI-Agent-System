# n8n Workflows — Archived

The n8n integration has been removed. All orchestration is now handled by the TypeScript orchestrator in `orchestrator/`.

Historical workflow JSON files are preserved in `archive/` for reference.

## What Replaced n8n

| Was | Now |
|---|---|
| n8n CRON trigger (port 5678) | `node-cron` scheduler in `orchestrator/src/scheduler.ts` |
| n8n Notion Agent webhook | `NotionAgent` class + `categorize-idea` pipeline |
| n8n Planner Agent webhook | `PlannerAgent` class in `orchestrator/src/agents/` |
| n8n Validation Agent webhook | `ValidationAgent` class in `orchestrator/src/agents/` |
| n8n workflow context | `WorkflowContext` per-run object |
| n8n execution history | MySQL `workflow_runs` + `workflow_events` |

## Documentation

- [TypeScript Pipeline Architecture](../../docs/development/TYPESCRIPT_PIPELINE_ARCHITECTURE.md)
- [Multi-Agent Pipeline](../../docs/development/MULTI_AGENT_PIPELINE.md)
- [Orchestrator Setup](../../docs/setup/ORCHESTRATOR_SETUP.md)

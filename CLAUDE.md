# MCP Server — Claude Code Guide

## Project Overview

A TypeScript multi-agent pipeline system that processes ideas stored in Notion. A daily scheduler fetches unprocessed ideas, runs each through a Claude-powered categorization pipeline, and records the full audit trail in MySQL. A separate Director MCP Server exposes workflow templates and context management as MCP tools for interactive use by Claude Desktop.

## Architecture in One Diagram

```
orchestrator (scheduler + pipelines + agent classes)
  node-cron (09:00 ET) → runDailyProcessing → categorizeIdea per idea
  → PlannerAgent → ValidationAgent
  WorkflowContext tracks per-run phase results
  MySQL records every run and stage (workflow_runs + workflow_events)

notion-idea-server-http (port 3001)
  REST API over Notion — the only component that talks to Notion directly

director-mcp-server (stdio, no HTTP port)
  TemplateManager + ContextManager as MCP tools
  Used by Claude Desktop, not by the daily pipeline

MySQL (port 3306)
  workflow_runs + workflow_events — durable audit log
```

## The Three-Layer Rule

```
Layer 3 — Director/Scheduler   decides what to run, composes pipelines
Layer 2 — Pipelines/Agents     specific use cases (categorize-idea, daily-processing)
Layer 1 — Capability Layer     NotionAgent: getIdea, searchIdeas, updateIdea
```

**Pipelines use agents. Agents don't run pipelines.**

NotionAgent never calls `categorizeIdea()`. The scheduler never calls NotionAgent directly.

## Agent Table

| Agent | Role | Mode |
|---|---|---|
| `pipeline-architect` | Plans multi-step work, decomposes features, dispatches to specialists | READ-ONLY |
| `typescript-pipeline-engineer` | Builds orchestrator pipelines, agent classes, withRetry, MySQL tracking | READ-WRITE |
| `notion-api-engineer` | Implements/modifies notion-idea-server endpoints and NotionAgent | READ-WRITE |
| `director-mcp-engineer` | MCP tools, TemplateManager, ContextManager, workflow templates | READ-WRITE |
| `code-reviewer` | Architecture compliance, type safety, error handling review | READ-ONLY |
| `qa-tester` | Tests pipelines, endpoints, MySQL audit log, dry-runs | READ-WRITE |
| `devops-engineer` | Docker, docker-compose, env config, startup scripts | READ-WRITE |

## Key Files

```
orchestrator/src/
  scheduler.ts              # Layer 3: node-cron + runDailyWorkflow
  workflow.ts               # withRetry utility
  agents/types.ts           # AgentInput, AgentOutput, AgentContext
  agents/notion-agent.ts    # Layer 1: Notion HTTP facade
  agents/planner-agent.ts   # Layer 2: planning stub
  agents/validation-agent.ts# Layer 2: QA assessment
  context/workflow-context.ts # Per-run state object (not a singleton)
  db/workflow-store.ts      # createRun, logEvent, completeRun
  pipelines/categorize-idea.ts  # FETCH→PARSE→CLASSIFY→VALIDATE→EVALUATE→WRITE
  pipelines/daily-processing.ts # Loops categorizeIdea over all unprocessed ideas

director-mcp-server/src/
  index.ts                  # MCP tool handlers
  templates/template-manager.ts
  context/context-manager.ts

notion-idea-server/src/
  http-wrapper.ts           # Express HTTP server on port 3001

docs/ARCHITECTURE.md        # Full canonical reference — read this first
```

## Quality Gates

Before marking any work complete:
- TypeScript compiles: `cd orchestrator && npm run build`
- Layer rule respected: NotionAgent has no pipeline calls; pipelines don't skip agents
- Every Claude call wrapped with `withRetry()`
- Every new pipeline phase returns `AgentOutput` and is registered in `scheduler.ts`
- Docker builds without error if docker-compose services are modified

## Commands

| Command | Purpose |
|---|---|
| `/mcp-server verify` | Check all services are reachable, run environment check |
| `/mcp-server add-pipeline` | Guided walkthrough for adding a new pipeline or agent |
| `/review code-review` | Review changed files against architecture rules |

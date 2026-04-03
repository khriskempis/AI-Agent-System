# MCP Server — Claude Code Guide

## Project Overview

A TypeScript multi-agent pipeline system that processes ideas stored in Notion. A daily scheduler fetches unprocessed ideas, runs each through a Claude-powered categorization pipeline, and records the full audit trail in MySQL. A separate `plan-idea` pipeline generates agent-executable implementation plans for projects the user has approved for planning.

## Architecture in One Diagram

```
orchestrator (scheduler + pipelines + agent classes)
  node-cron (09:00 ET) → runDailyProcessing → categorizeIdea per idea
  → ValidationAgent
  WorkflowContext tracks per-run phase results
  MySQL records every run and stage (workflow_runs + workflow_events)

  plan-idea (user-triggered)
  npx tsx src/index.ts plan-idea --all
    → getReadyForPlanningProjects → planIdea per project
    → writes plan to Notion, sets status "Pending Review"

notion-idea-server-http (port 3001)
  REST API over Notion — the only component that talks to Notion directly

MySQL (port 3306)
  workflow_runs + workflow_events — durable audit log
```

## The Three-Layer Rule

```
Layer 3 — Scheduler/index.ts   decides what to run, composes pipelines
Layer 2 — Pipelines/Agents     specific use cases (categorize-idea, plan-idea, daily-processing)
Layer 1 — Capability Layer     NotionAgent: getIdea, searchIdeas, updateIdea, getProjectPage, etc.
```

**Pipelines use agents. Agents don't run pipelines.**

NotionAgent never calls `categorizeIdea()` or `planIdea()`. The scheduler never calls NotionAgent directly.

## Pipelines

| Pipeline | Trigger | What it does |
|---|---|---|
| `categorize-idea` | Daily scheduler (09:00 ET) or manual `--id` | Fetches "Not Started" ideas, classifies via Claude, routes to projects/journal/knowledge DB |
| `plan-idea` | Manual: `npx tsx src/index.ts plan-idea --all` | Fetches "Ready for Planning" projects, generates agent-executable plan via Claude Sonnet, writes to Notion, sets status "Pending Review" |
| `scheduler` | `npx tsx src/index.ts scheduler` | Starts node-cron for daily categorization |

## Agent Table

| Agent | Role | Mode |
|---|---|---|
| `pipeline-architect` | Plans multi-step work, decomposes features, dispatches to specialists | READ-ONLY |
| `typescript-pipeline-engineer` | Builds orchestrator pipelines, agent classes, withRetry, MySQL tracking | READ-WRITE |
| `notion-api-engineer` | Implements/modifies notion-idea-server endpoints and NotionAgent | READ-WRITE |
| `code-reviewer` | Architecture compliance, type safety, error handling review | READ-ONLY |
| `qa-tester` | Tests pipelines, endpoints, MySQL audit log, dry-runs | READ-WRITE |
| `devops-engineer` | Docker, docker-compose, env config, startup scripts | READ-WRITE |

## Key Files

```
orchestrator/src/
  index.ts                      # CLI entry: categorize-idea, plan-idea, scheduler
  scheduler.ts                  # Layer 3: node-cron + runDailyWorkflow (categorization only)
  workflow.ts                   # withRetry utility
  notion-client.ts              # ProjectPage, NotionIdea, UpdateIdeaPayload types
  agents/types.ts               # AgentInput, AgentOutput, AgentContext
  agents/notion-agent.ts        # Layer 1: Notion HTTP facade (ideas + projects)
  agents/planner-agent.ts       # Layer 2: delegates to runPlanningProcessing()
  agents/validation-agent.ts    # Layer 2: QA assessment of categorization run
  context/workflow-context.ts   # Per-run state object (not a singleton)
  db/workflow-store.ts          # createRun, logEvent, completeRun
  pipelines/categorize-idea.ts  # FETCH→PARSE→CLASSIFY→VALIDATE→EVALUATE→WRITE
  pipelines/daily-processing.ts # Loops categorizeIdea over all unprocessed ideas
  pipelines/plan-idea.ts        # FETCH→PLAN→WRITE for a single project page
  pipelines/run-planning.ts     # Loops planIdea over all "Ready for Planning" projects

notion-idea-server/src/
  http-wrapper.ts               # Express HTTP server on port 3001
  generic-notion-service.ts     # Generic DB CRUD; handles property updates + block content

docs/ARCHITECTURE.md            # Full canonical reference — read this first
```

## Plan-Idea Pipeline Details

- **Trigger**: User sets project status to "Ready for Planning" in Notion, then runs `plan-idea --all`
- **Re-run detection**: If page content starts with `# Plan` (case-insensitive), it's a revision run
- **First run**: Generates a full agent-executable plan (Objective, Tech Stack, Phases, Human Checkpoints, Open Questions)
- **Revision run**: Incorporates feedback the user added below the existing plan
- **Model**: `claude-sonnet-4-6`
- **After write**: Status set to `"Pending Review"`

## Quality Gates

Before marking any work complete:
- TypeScript compiles: `cd orchestrator && npm run build`
- Layer rule respected: NotionAgent has no pipeline calls; pipelines don't skip agents
- Every Claude call wrapped with `withRetry()`
- Every new pipeline phase returns `AgentOutput` and is registered in `scheduler.ts` (if daily) or `index.ts` (if manual)
- Docker builds without error if docker-compose services are modified

## Commands

| Command | Purpose |
|---|---|
| `npx tsx src/index.ts categorize-idea --id <id>` | Categorize a single idea |
| `npx tsx src/index.ts categorize-idea --all` | Categorize all "Not Started" ideas |
| `npx tsx src/index.ts plan-idea --id <id>` | Plan a single project |
| `npx tsx src/index.ts plan-idea --all` | Plan all "Ready for Planning" projects |
| `npx tsx src/index.ts plan-idea --id <id> --dry-run` | Dry run (no Notion writes) |
| `npx tsx src/index.ts scheduler` | Start daily cron scheduler |
| `./scripts/start.sh` | Start all Docker services |
| `./scripts/stop.sh` | Stop all Docker services |
| `docker-compose logs -f` | Follow live logs |

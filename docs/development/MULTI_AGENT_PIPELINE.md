# Multi-Agent Pipeline

The orchestrator chains three agents in sequence on each daily run. Each agent receives the results of the previous phase via `WorkflowContext`.

## Pipeline Overview

```
runDailyWorkflow()
  │
  ├─ Phase 1: runDailyProcessing()
  │    Purpose: Fetch all unprocessed ideas and run each through categorization
  │    Layer: Pipeline (Layer 2) — uses NotionAgent as a tool
  │
  ├─ Phase 2: PlannerAgent.execute()
  │    Purpose: Inspect what was processed; plan any follow-up actions
  │    Layer: Agent (Layer 2) — currently a stub
  │
  └─ Phase 3: ValidationAgent.execute()
       Purpose: Assess overall run quality; produce a pass/fail + feedback
       Layer: Agent (Layer 2) — inspects all prior phase results
```

Each phase is wrapped in `withRetry()` (2 attempts, 2s backoff).

If Phase 1 fails, the run aborts — Phases 2 and 3 require valid Notion results to be meaningful.

## Agent Interfaces

All agents share the same input/output contract:

```typescript
interface AgentInput {
  workflowId: string;               // e.g. "daily-2026-04-01-a1b2c3d4"
  contextId: string;                // WorkflowContext.contextId
  parameters: Record<string, unknown>;
}

interface AgentOutput {
  agentId: string;                  // e.g. "planner", "validation"
  phase: string;                    // phase name recorded in WorkflowContext
  success: boolean;
  durationMs: number;
  results: Record<string, unknown>; // phase-specific output data
  errors: string[];
}
```

## WorkflowContext

`WorkflowContext` is a lightweight per-run object (not a singleton). It holds a `Map<phase, AgentOutput>` for one scheduler execution.

```typescript
const context = new WorkflowContext(workflowId);

// Record each phase result
context.recordPhaseResult("notion", notionResult);
context.recordPhaseResult("planner", plannerResult);
context.recordPhaseResult("validation", validationResult);

// Downstream agents can read prior results
const notionData = context.getPhaseResult("notion");

// Summarize the run
const summary = context.toSummary();
```

## Phase 1 — Daily Processing (`daily-processing.ts`)

Uses `NotionAgent.getAllUnprocessed()` to fetch all ideas with status `"Not Started"`, then calls `categorizeIdea(id)` for each. Returns a summary with `total`, `processed`, `failed`, and the IDs.

The `categorizeIdea` pipeline runs: FETCH → PARSE → CLASSIFY → VALIDATE → EVALUATE → WRITE. Each stage is tracked in MySQL. Ideas that fail the QA loop get status `"Needs Review"` in Notion rather than crashing the run.

## Phase 2 — Planner Agent (`planner-agent.ts`)

Currently a **stub** — returns a pass-through `AgentOutput` with a note that full planning logic is pending.

When implemented, the planner will inspect the categorization results from Phase 1 and produce a plan (e.g. project breakdown, task list) for ideas routed to Projects.

## Phase 3 — Validation Agent (`validation-agent.ts`)

Inspects all prior phase results from `WorkflowContext` and produces a quality assessment:

- Counts processed vs failed ideas from the Notion phase
- Computes a pass/fail score
- Produces a `feedback` string summarizing the run

Returns `success: true` if the failure rate is below threshold, `false` otherwise.

## Extending the Pipeline

To add a new phase, see [Adding New Agents](./ADDING_NEW_AGENTS.md).

# Skill: TypeScript Pipeline Patterns

## The Three-Layer Rule

```
Layer 3 — Scheduler/Director   decides what to run
Layer 2 — Pipelines/Agents     specific use cases
Layer 1 — NotionAgent          capability facade, no pipeline logic
```

**Pipelines call agents. Agents never call pipelines.**

Violation example (WRONG):
```typescript
// ❌ Layer 1 calling a Layer 2 pipeline
class NotionAgent {
  async execute() {
    await categorizeIdea(id); // WRONG — inverted layers
  }
}
```

Correct pattern:
```typescript
// ✅ Layer 2 pipeline using Layer 1 agent as a tool
export async function runDailyProcessing(): Promise<AgentOutput> {
  const notion = new NotionAgent();
  const ideas = await notion.getAllUnprocessed(); // Layer 1 call
  for (const idea of ideas) {
    await categorizeIdea(idea.id); // Layer 2 call (peer, not called from within agent)
  }
}
```

## withRetry Pattern

Every Claude API call and every agent phase must be wrapped with `withRetry`:

```typescript
import { withRetry } from "../workflow.js";

// Per Claude call inside a pipeline
const result = await withRetry(
  () => askJSON<ClassifyResult>(prompt),
  { label: "CLASSIFY", maxAttempts: 3, backoffMs: 1000 }
);

// Per agent phase in scheduler
const output = await withRetry(
  () => new MyAgent().execute({ workflowId, contextId, parameters }),
  { label: "MY_AGENT", maxAttempts: 2, backoffMs: 2000 }
);
```

Backoff is exponential: `backoffMs × attempt` (1s, 2s, 3s with backoffMs=1000).

## AgentInput / AgentOutput

Layer 2 agent classes (not NotionAgent) always implement this contract:

```typescript
// Input — provided by the scheduler
interface AgentInput {
  workflowId: string;    // "daily-2026-04-01-a1b2c3d4"
  contextId: string;     // WorkflowContext.contextId
  parameters: Record<string, unknown>;
}

// Output — always returned, never thrown
interface AgentOutput {
  agentId: string;       // matches the agent's identity
  phase: string;         // recorded in WorkflowContext
  success: boolean;
  durationMs: number;
  results: Record<string, unknown>;
  errors: string[];
}
```

Agents must catch errors internally and return `success: false` with the error in `errors[]`. Never let an agent `throw` — the scheduler's `withRetry` handles retries; unhandled throws break the chain.

## WorkflowContext Usage

```typescript
const context = new WorkflowContext(workflowId);
// Not a singleton — create fresh each run

context.recordPhaseResult("notion", notionOutput);
context.recordPhaseResult("planner", plannerOutput);

// Downstream agents can read prior results
const notionData = context.getPhaseResult("notion");
const summary = context.toSummary();
```

## Pipeline Function Pattern

Pipelines are functions, not classes. They return `AgentOutput`:

```typescript
export async function runMyPipeline(): Promise<AgentOutput> {
  const start = Date.now();
  const errors: string[] = [];

  try {
    // ... pipeline logic using Layer 1 agents
    return {
      agentId: "my-pipeline",
      phase: "my-phase",
      success: true,
      durationMs: Date.now() - start,
      results: { /* payload */ },
      errors: [],
    };
  } catch (err) {
    return {
      agentId: "my-pipeline",
      phase: "my-phase",
      success: false,
      durationMs: Date.now() - start,
      results: {},
      errors: [String(err)],
    };
  }
}
```

## MySQL Audit Hooks

Use `workflow-store.ts` to track pipeline execution:

```typescript
import { isRunning, createRun, updateRunStage, logEvent, completeRun } from "../db/workflow-store.js";

// Idempotency guard
if (await isRunning(notionPageId)) return; // skip duplicate run

const runId = await createRun({ pipeline: "categorize-idea", notionPageId, name });

await logEvent({ runId, stage: "FETCH", status: "started" });
// ... do work ...
await logEvent({ runId, stage: "FETCH", status: "completed", durationMs, result });

await updateRunStage(runId, "CLASSIFY");
await completeRun(runId, "completed"); // or "failed" or "needs_review"
```

All functions silently no-op if MySQL is unavailable (`MYSQL_HOST` not set).

## Registering a New Phase in the Scheduler

```typescript
// orchestrator/src/scheduler.ts — inside runDailyWorkflow()
const myResult = await withRetry(
  () => runMyPipeline(),
  { label: "MY_PIPELINE", maxAttempts: 2, backoffMs: 2000 }
);
context.recordPhaseResult("my-phase", myResult);

// Abort if this phase is required by later phases
if (!myResult.success) {
  logger.error("[scheduler] My pipeline failed — aborting");
  return;
}
```

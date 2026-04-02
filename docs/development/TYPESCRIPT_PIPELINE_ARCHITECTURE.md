# TypeScript Pipeline Architecture

This document is the canonical reference for how the orchestrator is structured. Read this before adding new pipelines or agents.

## The Three Layers

```
┌─────────────────────────────────────────────────────┐
│  Layer 3: Director / Orchestrator                   │
│  Decides WHAT to run based on incoming requirements │
│  Composes pipelines dynamically (agentic planning)  │
├─────────────────────────────────────────────────────┤
│  Layer 2: Pipelines (Use Cases)                     │
│  categorize-idea, daily-processing, future pipes    │
│  Each is a specific, ordered sequence of tool calls │
├─────────────────────────────────────────────────────┤
│  Layer 1: Agents as Capability / Tool Layer         │
│  NotionAgent — getIdea, searchIdeas, updateIdea     │
│  (general purpose, zero pipeline logic)             │
└─────────────────────────────────────────────────────┘
```

**Rule: pipelines use agents, agents don't run pipelines.**

If `NotionAgent` called `categorizeIdea()` internally, the layers would be inverted — a service adapter would be triggering a use case. The correct direction is always downward: orchestrator → pipeline → capability layer.

### Layer 1 — Facade / Service Adapter

`NotionAgent` is a Facade over the notion-idea-server HTTP API. All Notion interactions flow through it regardless of which pipeline is running. No pipeline logic lives here — only clean capability methods:

```typescript
class NotionAgent {
  getIdea(id: string): Promise<NotionIdea>
  getAllUnprocessed(): Promise<NotionIdea[]>
  getIdeas(filter?: { status?: string }): Promise<NotionIdea[]>
  searchIdeas(query: string): Promise<NotionIdea[]>
  getIdeaContent(id: string): Promise<string>
  updateIdea(id: string, patch: UpdateIdeaPayload): Promise<void>
}
```

### Layer 2 — Use Case / Composition

Each pipeline is a specific use case that composes Layer 1 tool calls into a defined sequence. `categorize-idea` doesn't know how Notion works — it calls `NotionAgent.getIdea()`, passes results to Claude, calls `NotionAgent.updateIdea()`. The pipeline is just a recipe of which tools to call in what order.

### Layer 3 — Dynamic Orchestration / Agentic Planning

When the scheduler looks at incoming requirements and decides which pipelines to invoke — or chains them together — that is **agentic planning** (the ReAct pattern: Reason + Act). The director reasons about what sequence of actions satisfies the requirement, then executes them. It is not just selecting a pre-built pipeline — it can construct a pipeline from smaller pieces at runtime.

## Agent Interfaces

All agent classes implement:

```typescript
interface AgentInput {
  workflowId: string;
  contextId: string;
  parameters: Record<string, unknown>;
}

interface AgentOutput {
  agentId: string;
  phase: string;
  success: boolean;
  durationMs: number;
  results: Record<string, unknown>;
  errors: string[];
}
```

`NotionAgent` is an exception — it is a Layer 1 capability layer and does **not** implement `AgentInput/AgentOutput`. It exposes individual methods, not a unified `execute()` entry point.

## WorkflowContext

`WorkflowContext` is a lightweight per-run object. Created fresh at the start of each scheduler execution:

```typescript
const context = new WorkflowContext(workflowId);
// workflowId format: "daily-2026-04-01-a1b2c3d4"

context.recordPhaseResult("notion", notionOutput);
context.getPhaseResult("notion");     // → AgentOutput | undefined
context.getAll();                     // → Map<string, AgentOutput>
context.toSummary();                  // → { workflowId, phases, results }
```

**Not a singleton.** Each `runDailyWorkflow()` call gets its own context.

## Pipeline Stages — categorize-idea

```
FETCH → PARSE → CLASSIFY → VALIDATE → EVALUATE → WRITE
```

| Stage | Description |
|---|---|
| FETCH | `NotionAgent.getIdea(id)` — load the full Notion page |
| PARSE | Extract title, description, tags from Notion properties |
| CLASSIFY | `askJSON()` — ask Claude to assign a category |
| VALIDATE | `askJSON()` — ask Claude to verify the classification |
| EVALUATE | Check if classification passes quality bar; if not, loop |
| WRITE | `NotionAgent.updateIdea()` — write tags, category, status |

The CLASSIFY → VALIDATE → EVALUATE loop retries up to `MAX_RETRIES = 2` before setting the idea's status to `"Needs Review"` in Notion and continuing to the next idea.

## withRetry

```typescript
withRetry<T>(
  fn: () => Promise<T>,
  options: { label: string; maxAttempts: number; backoffMs: number }
): Promise<T>
```

Retries are **per-activity**. Exponential backoff: `backoffMs * attempt` (1×, 2×, 3×, ...).

Used at two levels:
- Per Claude call inside `categorize-idea` (each stage independently)
- Per agent phase in the scheduler (wraps the full phase)

These two retry loops are independent. A failed VALIDATE retries at the stage level before the scheduler's outer retry kicks in.

## MySQL Audit Log

Two tables — see `orchestrator/src/db/schema.sql` for the full DDL.

**`workflow_runs`** — one row per pipeline execution, tracks current state:
- `id` (UUID) — correlates with `workflow_events`
- `status` ENUM: `running | completed | failed | needs_review`
- `current_stage` — last stage reached (useful for diagnosing crashes)
- `stage_results` JSON — output snapshots per stage
- `attempts` — total retry count across all stages

**`workflow_events`** — immutable append-only audit log:
- One row per stage execution (`started` + `completed`/`failed`)
- `duration_ms` — per-stage timing
- `attempt` — which retry attempt this event belongs to

### Idempotency Guard

Before starting, `categorizeIdea` calls `isRunning(notionPageId)` — if a run is already in progress for that page, the new invocation skips. This prevents duplicate processing if the scheduler fires twice (e.g. on restart).

## Scheduler

`orchestrator/src/scheduler.ts` — entry point for the daily workflow.

```typescript
cron.schedule("0 9 * * *", () => runDailyWorkflow(), {
  timezone: "America/New_York"
});
```

`runDailyWorkflow()` creates a fresh `WorkflowContext`, runs the three phases in sequence, and logs a summary. The cron timer keeps the event loop alive — no explicit keep-alive needed.

## Naming Reference

| Context | Term |
|---|---|
| Software architecture | Layered architecture / Clean architecture |
| AI agent systems | Tool-augmented agents (agents have a toolkit, director composes) |
| Director composing dynamically | Agentic planning / dynamic workflow composition |
| NotionAgent's role | Facade / Service Adapter over an external API |
| Pipeline's role | Use case / Composition of tool calls |
| ReAct pattern | Reason + Act — director reasons about what pipeline to build, then executes |

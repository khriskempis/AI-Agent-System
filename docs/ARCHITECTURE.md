# System Architecture

This document is the single authoritative reference for how the MCP Server system is designed. Read this first before making changes to any component.

---

## System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│  orchestrator  (TypeScript process — runs in Docker)                 │
│                                                                      │
│  node-cron fires at 09:00 America/New_York                          │
│    └─ runDailyWorkflow()                                             │
│         ├─ Phase 1: runDailyProcessing()    ← Layer 2 pipeline      │
│         │    ├─ NotionAgent.getAllUnprocessed()  ← Layer 1           │
│         │    └─ categorizeIdea(id) per idea     ← Layer 2 pipeline  │
│         ├─ Phase 2: PlannerAgent.execute()  ← Layer 2 agent         │
│         └─ Phase 3: ValidationAgent.execute() ← Layer 2 agent       │
│                                                                      │
│  WorkflowContext — lightweight per-run state object                  │
│  withRetry — exponential backoff per activity                        │
│  MySQL — durable audit log (workflow_runs + workflow_events)         │
├──────────────────────────────────────────────────────────────────────┤
│  notion-idea-server-http  (port 3001)                                │
│  REST API facade over Notion — read, write, search ideas             │
│  NotionAgent calls this; no other component calls Notion directly    │
├──────────────────────────────────────────────────────────────────────┤
│  director-mcp-server  (stdio — no HTTP port)                         │
│  TemplateManager + ContextManager exposed as MCP tools               │
│  Used by Claude Desktop / MCP clients for interactive authoring      │
│  Not involved in the daily automated pipeline                        │
├──────────────────────────────────────────────────────────────────────┤
│  MySQL  (port 3306, container: orchestrator-mysql)                   │
│  workflow_runs  — current state + checkpoint per pipeline run        │
│  workflow_events — immutable, append-only activity log               │
└──────────────────────────────────────────────────────────────────────┘
```

---

## The Three-Layer Agent Architecture

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

### The Core Rule

**Pipelines use agents. Agents don't run pipelines.**

If `NotionAgent` called `categorizeIdea()` internally, a service adapter would be triggering a use case — the layers are inverted. The correct direction is always downward: orchestrator → pipeline → capability layer.

### Layer 1 — Facade / Service Adapter

`NotionAgent` is a facade over the notion-idea-server HTTP API. All Notion interactions flow through it regardless of which pipeline is running. No pipeline logic lives here — only clean capability methods:

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

No `execute()`. No `AgentInput/AgentOutput`. Just methods.

### Layer 2 — Use Case / Composition

Each pipeline is a specific use case that composes Layer 1 tool calls into a defined sequence. `categorize-idea` doesn't know how Notion works — it calls `NotionAgent.getIdea()`, passes results to Claude, calls `NotionAgent.updateIdea()`. The pipeline is just a recipe of which tools to call in what order.

Agent classes at Layer 2 (`PlannerAgent`, `ValidationAgent`) implement `execute(AgentInput): Promise<AgentOutput>` and may call Layer 1 agents and/or Claude internally.

### Layer 3 — Dynamic Orchestration / Agentic Planning

The scheduler (`scheduler.ts`) is the current Layer 3 implementation. It looks at the system state (which ideas are unprocessed) and decides which pipelines to invoke and in what order.

When a director reasons about what sequence of actions satisfies a requirement and constructs a pipeline from smaller pieces at runtime, that pattern is called **agentic planning** or **dynamic workflow composition** (the ReAct pattern: Reason + Act). This is what Layer 3 does — not just select a pre-built pipeline but compose one on the fly.

### Naming Reference

| Context | Term |
|---|---|
| Software architecture | Layered architecture / Clean architecture |
| AI agent systems | Tool-augmented agents (agents have a toolkit, director composes) |
| Director composing dynamically | Agentic planning / dynamic workflow composition |
| `NotionAgent`'s role | Facade / Service Adapter over an external API |
| Pipeline's role | Use case / Composition of tool calls |
| Layer 3 pattern | ReAct (Reason + Act) |

---

## Agent Interfaces

All Layer 2 agent classes share the same typed contract:

```typescript
// orchestrator/src/agents/types.ts

interface AgentInput {
  workflowId: string;               // "daily-2026-04-01-a1b2c3d4"
  contextId: string;                // WorkflowContext.contextId
  parameters: Record<string, unknown>;
}

interface AgentOutput {
  agentId: string;                  // "planner", "validation"
  phase: string;                    // recorded in WorkflowContext
  success: boolean;
  durationMs: number;
  results: Record<string, unknown>; // phase-specific payload
  errors: string[];
}

interface AgentContext {
  contextId: string;
  workflowId: string;
  phases: string[];
  getPhaseResult(phase: string): AgentOutput | undefined;
}
```

`NotionAgent` (Layer 1) does **not** implement these interfaces — it exposes individual methods, not a unified `execute()` entry point.

---

## WorkflowContext

A lightweight, per-run object. **Not a singleton.** Created fresh at the start of each `runDailyWorkflow()` call.

```typescript
// orchestrator/src/context/workflow-context.ts

class WorkflowContext {
  readonly workflowId: string;   // "daily-2026-04-01-a1b2c3d4"
  readonly contextId: string;    // UUID generated at construction

  recordPhaseResult(phase: string, result: AgentOutput): void
  getPhaseResult(phase: string): AgentOutput | undefined
  getAll(): Map<string, AgentOutput>
  toSummary(): { workflowId, contextId, phases, results, overallSuccess }
}
```

Each phase records its `AgentOutput` into the context so downstream agents can read what prior phases produced. The context lives only for the duration of one scheduler run.

This is intentionally simpler than the Director MCP Server's `ContextManager` (no TTL, no persistence, not shared across processes).

---

## The categorize-idea Pipeline

`orchestrator/src/pipelines/categorize-idea.ts`

### Stage Sequence

```
FETCH → PARSE → CLASSIFY → VALIDATE → EVALUATE → WRITE
                    ↑______________|
                    QA loop (max 2 retries)
```

| Stage | Description |
|---|---|
| FETCH | `NotionAgent.getIdea(id)` — load the full Notion page |
| PARSE | Extract title, description, existing tags from Notion properties |
| CLASSIFY | `askJSON()` — ask Claude to assign a category and tags |
| VALIDATE | `askJSON()` — ask Claude to verify the classification is well-reasoned |
| EVALUATE | Check if classification meets quality bar; if not, loop back to CLASSIFY |
| WRITE | `NotionAgent.updateIdea()` — write tags + status back to Notion |

### QA Loop vs withRetry

These are two independent retry mechanisms:

| Mechanism | What it retries | Limit | Purpose |
|---|---|---|---|
| CLASSIFY → VALIDATE → EVALUATE loop | The whole classify+validate sequence when quality is too low | `MAX_RETRIES = 2` | Improve classification quality |
| `withRetry()` per stage | Individual stage failures (API errors, Claude errors) | `maxAttempts: 3, backoffMs: 1000` | Handle transient infrastructure failures |

If the QA loop exhausts its retries, the idea's status is set to `"Needs Review"` in Notion and processing continues to the next idea. This is not a failure of the run — it's an expected outcome for ambiguous ideas.

### Idempotency

Before starting, `categorizeIdea` calls `isRunning(notionPageId)` against MySQL. If a run for that page is already in progress, the new call skips. Prevents duplicate processing if the scheduler fires twice.

---

## withRetry

`orchestrator/src/workflow.ts`

```typescript
withRetry<T>(
  fn: () => Promise<T>,
  options: { label: string; maxAttempts: number; backoffMs: number }
): Promise<T>
```

Retries with exponential backoff: `backoffMs × attempt` (1×, 2×, 3×, ...).

Applied at two levels:
- **Per Claude call** inside `categorize-idea` — wraps each individual stage
- **Per agent phase** in the scheduler — wraps the full phase call

These levels are independent. A stage retry does not reset the scheduler-level retry counter.

---

## Scheduler

`orchestrator/src/scheduler.ts`

```typescript
cron.schedule("0 9 * * *", () => runDailyWorkflow(), {
  timezone: "America/New_York"
});
```

The cron timer keeps the event loop alive — no explicit keep-alive needed.

### runDailyWorkflow sequence

```typescript
const workflowId = `daily-${date}-${uuid}`;
const context = new WorkflowContext(workflowId);

// Phase 1
const notionResult = await withRetry(
  () => runDailyProcessing(),
  { label: "DAILY_PROCESSING", maxAttempts: 2, backoffMs: 2000 }
);
context.recordPhaseResult("notion", notionResult);
if (!notionResult.success) return; // abort — later phases need Notion data

// Phase 2
const plannerResult = await withRetry(
  () => new PlannerAgent().execute({ workflowId, contextId, parameters }),
  { label: "PLANNER_AGENT", maxAttempts: 2, backoffMs: 2000 }
);
context.recordPhaseResult("planner", plannerResult);

// Phase 3
const validationResult = await withRetry(
  () => new ValidationAgent().execute({ workflowId, contextId, parameters }),
  { label: "VALIDATION_AGENT", maxAttempts: 2, backoffMs: 2000 }
);
context.recordPhaseResult("validation", validationResult);

logger.json("[scheduler] Summary", context.toSummary());
```

---

## MySQL Audit Log

`orchestrator/src/db/schema.sql`

The MySQL audit log mimics Temporal.io's durable execution model: every run has a persistent record, every activity has an event, and the system can reconstruct the full history of any workflow execution.

### workflow_runs

One row per pipeline execution. Tracks current state and checkpoint.

| Column | Type | Description |
|---|---|---|
| `id` | UUID PK | Run identifier — used to correlate events |
| `pipeline` | varchar | Pipeline name (e.g. `categorize-idea`) |
| `notion_page_id` | varchar | Notion page being processed |
| `notion_page_name` | varchar | Human-readable title |
| `status` | ENUM | `running` → `completed` / `failed` / `needs_review` |
| `current_stage` | varchar | Last stage reached (for crash diagnosis) |
| `attempts` | int | Total retry count |
| `stage_results` | JSON | Output snapshot per stage |
| `started_at` | datetime | Run start time |
| `updated_at` | datetime | Last status change |
| `completed_at` | datetime | Completion time (null if in progress) |

### workflow_events

Immutable, append-only audit log. One row per stage execution.

| Column | Type | Description |
|---|---|---|
| `id` | auto-increment | Ordering key |
| `run_id` | UUID FK | References `workflow_runs.id` |
| `stage` | varchar | Stage name (FETCH, CLASSIFY, etc.) |
| `status` | ENUM | `started` / `completed` / `failed` |
| `attempt` | int | Which retry attempt |
| `result` | JSON | Stage output payload |
| `error_message` | text | Error string if failed |
| `duration_ms` | int | Elapsed time for this stage |
| `created_at` | datetime | Event timestamp |

### Connection Behavior

`orchestrator/src/db/connection.ts` creates a MySQL2 connection pool. If `MYSQL_HOST` is not set, the pool is null and all `workflow-store` functions silently no-op. The orchestrator runs without MySQL — you just lose the audit log.

---

## notion-idea-server

`notion-idea-server/src/` — Express HTTP server on port 3001.

A REST API facade over the Notion API. Generic, database-agnostic endpoints — no pipeline logic. Any component that needs to read or write Notion goes through this service.

**Key endpoints:**

```
GET  /api/ideas                        # List ideas, filterable by status
GET  /api/ideas/:id                    # Get a single idea
GET  /api/ideas/:id/content            # Get raw content blocks
POST /api/ideas/search                 # Full-text search
PUT  /api/ideas/:id                    # Update properties (tags, status, etc.)
GET  /api/ideas/summary                # Counts grouped by status
GET  /api/databases/:id/schema         # Get Notion database schema
GET  /api/databases/:id/auto-config    # Auto-detect database properties
GET  /health                           # Health check
```

See [API Endpoints](./setup/API_ENDPOINTS.md) for the full reference.

**Runs as two services in Docker:**
- `notion-idea-server` — stdio MCP mode (for direct MCP clients)
- `notion-idea-server-http` — HTTP mode on port 3001 (for the orchestrator)

---

## Director MCP Server

`director-mcp-server/src/` — MCP stdio server. No HTTP port.

Used by Claude Desktop or any MCP client for **interactive workflow authoring**. Not involved in the daily automated pipeline.

### TemplateManager

Reads JSON workflow templates from `director-mcp/workflow-templates/` using the registry at `template-registry.json`. Templates are cached in-memory after first load.

`createAgentInstructions()` extracts only the relevant phase's methodology from a full template (~15KB → ~2.5KB), populated with runtime parameters.

### ContextManager

Manages shared workflow state for multi-phase interactive sessions. Contexts have a **24-hour TTL** and are cleaned up automatically by a background interval.

Intentionally more capable than `WorkflowContext` (the orchestrator's per-run object): supports multiple concurrent contexts, TTL expiration, and phase coordination across separate MCP tool calls.

### MCP Tools Exposed

| Category | Tools |
|---|---|
| Templates | `get_workflow_template`, `create_agent_instructions` |
| Context | `create_workflow_context`, `get_workflow_context`, `update_context_with_agent_response`, `get_context_for_agent`, `list_active_contexts` |
| System | `get_system_stats`, `clear_template_cache` |

Previously exposed tools removed in Phase 2 cleanup: `execute_workflow`, `send_agent_instructions`, `check_agent_health`, `check_all_agents_health`, `get_agent_capabilities` — all depended on `AgentCommunicator` which called n8n webhooks.

---

## Docker Compose Services

```
mcp-notion-idea-server         stdio MCP server
mcp-notion-idea-server-http    HTTP API on port 3001 (used by orchestrator)
mcp-director-server            stdio MCP server (no port)
orchestrator                   daily scheduler + pipelines
orchestrator-mysql             MySQL on port 3306
```

Development-only services (profile: dev):
- `mcp-notion-idea-server-dev` — hot reload stdio
- `mcp-notion-idea-server-http-dev` — hot reload HTTP
- `mcp-director-server-dev` — hot reload stdio

All services connect via the `mcp-servers-network` external Docker network.

---

## Key Design Decisions

**Why MySQL instead of MongoDB?**
The data is highly structured and predictable (fixed pipeline stages, known status transitions). MySQL's schema enforcement and ACID transactions match the Temporal.io-inspired checkpoint model better than a document store. The orchestrator also exports MySQL-native query patterns for run inspection.

**Why `withRetry()` at two levels?**
Stage-level retries handle transient infrastructure failures (Claude rate limits, Notion API timeouts) without restarting the whole pipeline. Scheduler-level retries handle the case where an agent phase crashes completely (process error, unexpected exception). These two loops are intentionally independent so a stage retry doesn't burn the outer retry budget.

**Why is WorkflowContext not a singleton?**
Each daily run is fully independent. A singleton would require explicit cleanup between runs and could leak state from one run into the next. Per-run construction ensures complete isolation with zero cleanup overhead.

**Why does the Director MCP Server have no HTTP port?**
The HTTP wrapper (`http-wrapper.ts`) existed solely for n8n integration — n8n called the director over HTTP to get workflow templates. With n8n removed, the director only needs to serve MCP clients (Claude Desktop, MCP inspector), which communicate over stdio.

---

## How to Extend the System

- **Add a new Notion capability** → new method on `NotionAgent` (Layer 1)
- **Add a new pipeline** → new function in `orchestrator/src/pipelines/` (Layer 2)
- **Add a new agent phase** → new class in `orchestrator/src/agents/`, register in `scheduler.ts`
- **Add a workflow template** → new JSON in `director-mcp/workflow-templates/`, register in `template-registry.json`

See [Adding New Agents](./development/ADDING_NEW_AGENTS.md) for the full step-by-step guide.

---

## File Map

```
orchestrator/
├── src/
│   ├── index.ts                    # CLI entry: "categorize-idea" | "scheduler"
│   ├── scheduler.ts                # Layer 3: node-cron + runDailyWorkflow
│   ├── workflow.ts                 # withRetry utility
│   ├── logger.ts                   # Structured logger
│   ├── notion-client.ts            # NotionIdea + UpdateIdeaPayload types
│   ├── agents/
│   │   ├── types.ts                # AgentInput, AgentOutput, AgentContext
│   │   ├── notion-agent.ts         # Layer 1: Notion HTTP facade
│   │   ├── planner-agent.ts        # Layer 2: planning stub
│   │   └── validation-agent.ts     # Layer 2: QA assessment
│   ├── context/
│   │   └── workflow-context.ts     # Per-run state object
│   ├── db/
│   │   ├── schema.sql              # workflow_runs + workflow_events DDL
│   │   ├── connection.ts           # MySQL2 pool (no-ops if MYSQL_HOST unset)
│   │   └── workflow-store.ts       # createRun, logEvent, completeRun
│   ├── models/
│   │   └── claude.ts               # askJSON — Claude API wrapper
│   └── pipelines/
│       ├── categorize-idea.ts      # Layer 2: FETCH→PARSE→CLASSIFY→VALIDATE→EVALUATE→WRITE
│       └── daily-processing.ts     # Layer 2: fetch all unprocessed + loop categorizeIdea

director-mcp-server/
├── src/
│   ├── index.ts                    # MCP server + tool handlers
│   ├── shared-services.ts          # TemplateManager + ContextManager init
│   ├── templates/
│   │   └── template-manager.ts     # Load + cache JSON templates
│   ├── context/
│   │   └── context-manager.ts      # Multi-context store with 24hr TTL
│   └── types/
│       └── workflow.ts             # Shared type definitions

director-mcp/
└── workflow-templates/
    ├── template-registry.json      # type → filename mapping
    ├── idea-categorization-v1.json # Categorization methodology template
    └── database-item-creation-v1.json

notion-idea-server/
└── src/
    ├── index.ts                    # MCP stdio server
    └── http-wrapper.ts             # Express HTTP server (port 3001)
```

---

*Last updated: April 2026 — reflects removal of n8n and full TypeScript pipeline architecture*

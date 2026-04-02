# Command: /mcp-server add-pipeline

Guided walkthrough for adding a new pipeline or agent phase to the orchestrator.

## Step 1 — Determine the Layer

Answer these questions:
- Does the new work need a **new external service** (new API, new data source)? → Layer 1 agent
- Does the new work need a **new ordered sequence of steps** for a specific goal? → Layer 2 pipeline
- Does the new work change **which pipelines run and in what order**? → Layer 3 scheduler

If you're adding a new pipeline phase, you need both Layer 2 (the pipeline function or agent class) and a Layer 3 change (register it in scheduler.ts).

## Step 2 — Check for Existing Capabilities

Before building new Layer 1 methods, check if `NotionAgent` already has what you need:
```bash
grep -n "async " orchestrator/src/agents/notion-agent.ts
```

Check if the notion-idea-server already has the endpoint:
```bash
grep -n "app\." notion-idea-server/src/http-wrapper.ts
```

## Step 3 — Build Layer 1 (if needed)

If a new Notion endpoint is needed:
→ Dispatch to `notion-api-engineer` to add the endpoint and NotionAgent method.

## Step 4 — Build Layer 2

**For a pipeline function:**
- Create `orchestrator/src/pipelines/my-pipeline.ts`
- Import `NotionAgent` and call its methods
- Wrap Claude calls with `withRetry()`
- Return `AgentOutput`
- Add MySQL audit hooks: `createRun`, `logEvent`, `completeRun`

**For an agent class:**
- Create `orchestrator/src/agents/my-agent.ts`
- Implement `execute(input: AgentInput): Promise<AgentOutput>`
- Catch all errors — never throw to caller

→ Dispatch to `typescript-pipeline-engineer`.

## Step 5 — Register in Scheduler (Layer 3)

In `orchestrator/src/scheduler.ts`, inside `runDailyWorkflow()`:

```typescript
const myResult = await withRetry(
  () => runMyPipeline(),   // or: new MyAgent().execute({...})
  { label: "MY_PHASE", maxAttempts: 2, backoffMs: 2000 }
);
context.recordPhaseResult("my-phase", myResult);

if (!myResult.success) {
  logger.error("[scheduler] My phase failed — aborting");
  return;
}
```

## Step 6 — Add Workflow Template (optional)

If the Director MCP Server should be able to generate instructions for the new pipeline:
→ Dispatch to `director-mcp-engineer` to author the template JSON and register it.

## Step 7 — Review and Test

1. `code-reviewer` — verify layer rule, withRetry, AgentOutput format
2. `qa-tester` — dry-run, MySQL audit log validation
3. `typescript-pipeline-engineer` — `npm run build` passes

## Checklist

- [ ] Layer determined (1/2/3)
- [ ] Layer 1 methods in place (or confirmed existing)
- [ ] Layer 2 pipeline/agent implemented, returns `AgentOutput`
- [ ] Registered in `scheduler.ts` with `withRetry` + `context.recordPhaseResult`
- [ ] MySQL audit tracking wired in
- [ ] `npm run build` passes
- [ ] Dry-run tested via `qa-tester`
- [ ] `docs/development/ADDING_NEW_AGENTS.md` updated if new pattern introduced

# Adding New Agents

This guide walks through adding a new agent class to the orchestrator pipeline.

## Decide Which Layer

Before writing code, decide what layer your addition belongs to:

| If you're adding... | It's a... | Location |
|---|---|---|
| A new way to read/write an external service | **Layer 1 capability** | `orchestrator/src/agents/` |
| A new ordered sequence of steps for a specific goal | **Layer 2 pipeline** | `orchestrator/src/pipelines/` |
| Logic that decides which pipelines to run | **Layer 3 orchestration** | `orchestrator/src/scheduler.ts` |

**Rule: pipelines call agents, agents don't call pipelines.**

## Adding a Layer 1 Capability

If you're adding a new external service (e.g. a GitHub API, a Slack client), create a new agent class in `orchestrator/src/agents/`:

```typescript
// orchestrator/src/agents/github-agent.ts
import "dotenv/config";

const BASE_URL = () => process.env.GITHUB_API_URL ?? "https://api.github.com";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL()}${path}`, {
    headers: {
      "Authorization": `Bearer ${process.env.GITHUB_TOKEN}`,
      "Content-Type": "application/json",
    },
    ...options,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export class GitHubAgent {
  async getIssues(repo: string): Promise<GitHubIssue[]> {
    return request<GitHubIssue[]>(`/repos/${repo}/issues`);
  }

  async createIssue(repo: string, payload: CreateIssuePayload): Promise<GitHubIssue> {
    return request<GitHubIssue>(`/repos/${repo}/issues`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }
}
```

No `AgentInput`/`AgentOutput` here — just clean methods.

## Adding a Layer 2 Agent (Pipeline Phase)

A pipeline-phase agent takes `AgentInput`, does work (possibly calling Layer 1 agents or Claude), and returns `AgentOutput`.

```typescript
// orchestrator/src/agents/my-agent.ts
import { logger } from "../logger.js";
import { withRetry } from "../workflow.js";
import { askJSON } from "../models/claude.js";
import type { AgentInput, AgentOutput } from "./types.js";

export class MyAgent {
  async execute(input: AgentInput): Promise<AgentOutput> {
    const start = Date.now();

    logger.info(`[my-agent] Starting for workflow ${input.workflowId}`);

    try {
      const result = await withRetry(
        () => askJSON(buildPrompt(input.parameters)),
        { label: "MY_AGENT_CLAUDE_CALL", maxAttempts: 3, backoffMs: 1000 }
      );

      return {
        agentId: "my-agent",
        phase: "my-phase",
        success: true,
        durationMs: Date.now() - start,
        results: { output: result },
        errors: [],
      };
    } catch (err) {
      return {
        agentId: "my-agent",
        phase: "my-phase",
        success: false,
        durationMs: Date.now() - start,
        results: {},
        errors: [String(err)],
      };
    }
  }
}

function buildPrompt(parameters: Record<string, unknown>): string {
  return `...`;
}
```

## Adding a Layer 2 Pipeline

A pipeline is a function (not a class) that implements a specific use case by composing Layer 1 agents:

```typescript
// orchestrator/src/pipelines/my-pipeline.ts
import { NotionAgent } from "../agents/notion-agent.js";
import { GitHubAgent } from "../agents/github-agent.js";
import { logger } from "../logger.js";
import type { AgentOutput } from "../agents/types.js";

export async function runMyPipeline(): Promise<AgentOutput> {
  const start = Date.now();
  const notion = new NotionAgent();
  const github = new GitHubAgent();

  // 1. Fetch from Notion
  const ideas = await notion.getAllUnprocessed();

  // 2. Do something with each idea
  for (const idea of ideas) {
    const issue = await github.createIssue("my-org/my-repo", {
      title: idea.name,
      body: idea.description,
    });
    await notion.updateIdea(idea.id, { status: "In Progress" });
  }

  return {
    agentId: "my-pipeline",
    phase: "my-phase",
    success: true,
    durationMs: Date.now() - start,
    results: { processed: ideas.length },
    errors: [],
  };
}
```

## Registering in the Scheduler

Add your new phase to `orchestrator/src/scheduler.ts`:

```typescript
import { runMyPipeline } from "./pipelines/my-pipeline.js";
import { MyAgent } from "./agents/my-agent.js";

// Inside runDailyWorkflow():

// Phase 4: My new phase
const myResult = await withRetry(
  () => runMyPipeline(),                       // or: new MyAgent().execute({...})
  { label: "MY_PHASE", maxAttempts: 2, backoffMs: 2000 }
);
context.recordPhaseResult("my-phase", myResult);
```

## Adding a Workflow Template (Optional)

If you want the Director MCP Server to be able to generate instructions for your new pipeline, add a template:

1. Create `director-mcp/workflow-templates/my-workflow-v1.json`
2. Register it in `director-mcp/workflow-templates/template-registry.json`

See [Workflow Templates](./WORKFLOW_TEMPLATES.md) for the template format.

## Checklist

- [ ] Layer 1: capability methods only, no `AgentInput`/`AgentOutput`
- [ ] Layer 2: takes `AgentInput`, returns `AgentOutput`
- [ ] Layer 2 pipeline: function, not a class; uses Layer 1 agents as tools
- [ ] Wrap Claude calls with `withRetry()`
- [ ] Register phase in `scheduler.ts` with `withRetry()` + `context.recordPhaseResult()`
- [ ] Add env vars to `orchestrator/.env` if new external service
- [ ] Add workflow template if Director MCP integration needed

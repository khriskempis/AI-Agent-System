# Command: /review code-review

Review all changed files against the 3-layer architecture rules and TypeScript quality standards.

## Steps

1. Identify changed files:
```bash
git diff --name-only HEAD
git diff --name-only --cached
```

2. For each changed file, determine which layer it belongs to:
   - `orchestrator/src/agents/notion-agent.ts` → Layer 1 (capability)
   - `orchestrator/src/agents/*-agent.ts` (not notion) → Layer 2 (agent class)
   - `orchestrator/src/pipelines/*.ts` → Layer 2 (pipeline)
   - `orchestrator/src/scheduler.ts` → Layer 3 (orchestration)
   - `director-mcp-server/src/**` → MCP server
   - `notion-idea-server/src/**` → Notion HTTP API

3. Run the `code-reviewer` agent against each file with the appropriate checklist sections from `.claude/agents/code-reviewer.md`.

4. Check the 3-layer rule automatically:
```bash
# NotionAgent must not import from pipelines
grep -n "import.*pipeline\|categorizeIdea\|runDaily" orchestrator/src/agents/notion-agent.ts

# Scheduler must not call NotionAgent directly
grep -n "NotionAgent" orchestrator/src/scheduler.ts

# All agent execute() methods must catch errors
grep -n "throw" orchestrator/src/agents/*.ts
```

5. Check withRetry coverage:
```bash
# Find all askJSON calls
grep -n "askJSON" orchestrator/src/pipelines/*.ts orchestrator/src/agents/*.ts

# Find all withRetry calls
grep -n "withRetry" orchestrator/src/pipelines/*.ts orchestrator/src/agents/*.ts
```

6. Produce a review report using the format in `.claude/agents/code-reviewer.md`.

## Escalation

After the report:
- Critical issues → block merge, assign to responsible agent
- Warnings → file as follow-up, don't block
- Suggestions → document, leave to author's discretion

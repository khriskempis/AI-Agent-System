# Skill: Notion API Patterns

## Architecture Boundary

`notion-idea-server-http` is the **only** component that calls the Notion API. Everything else goes through `NotionAgent`.

```
orchestrator → NotionAgent → notion-idea-server-http → Notion API
director-mcp-server → (no direct Notion access)
```

Never import or call the Notion API SDK directly from the orchestrator or director-mcp-server.

## Adding a New Endpoint to notion-idea-server

Endpoints live in `notion-idea-server/src/http-wrapper.ts`:

```typescript
// GET endpoint example
app.get('/api/ideas/:id/tags', async (req, res) => {
  try {
    const { id } = req.params;
    const tags = await getIdeaTags(id);  // calls Notion API internally
    res.json({ success: true, data: tags });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

// POST endpoint example
app.post('/api/ideas/:id/tags', async (req, res) => {
  try {
    const { id } = req.params;
    const { tags } = req.body as { tags: string[] };
    await updateIdeaTags(id, tags);
    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});
```

Always return `{ success: true, data: ... }` on success and `{ success: false, error: "..." }` on failure.

## Adding a Method to NotionAgent

`orchestrator/src/agents/notion-agent.ts` is a **pure capability layer** — no pipeline logic, no `AgentInput`/`AgentOutput`:

```typescript
export class NotionAgent {
  // Add new method — just an HTTP call, no business logic
  async getIdeaTags(id: string): Promise<string[]> {
    const data = await request<{ data: string[] }>(`/api/ideas/${id}/tags`);
    return data.data ?? [];
  }

  async updateIdeaTags(id: string, tags: string[]): Promise<void> {
    await request(`/api/ideas/${id}/tags`, {
      method: "POST",
      body: JSON.stringify({ tags }),
    });
  }
}
```

**Never add:**
- Calls to `categorizeIdea()` or any pipeline function
- `execute(AgentInput)` methods
- Business logic or conditional routing

## UpdateIdeaPayload

The shape of what `NotionAgent.updateIdea()` accepts:

```typescript
interface UpdateIdeaPayload {
  status?: "Not Started" | "In Progress" | "Done" | "Needs Review";
  tags?: string[];
  howManyIdeas?: number;
  // extend here when notion-idea-server supports new writable properties
}
```

## Response Format Convention

All notion-idea-server endpoints return consistent JSON:

```typescript
// Success
{ "success": true, "data": <payload> }
{ "success": true }  // for void operations

// Error
{ "success": false, "error": "Human-readable error message" }
```

HTTP status codes: `200` for success, `404` for not found, `500` for server errors.

## Testing Endpoints

```bash
# List unprocessed ideas
curl "http://localhost:3001/api/ideas?status=Not%20Started"

# Get a specific idea
curl http://localhost:3001/api/ideas/<notion-page-id>

# Get page content blocks
curl http://localhost:3001/api/ideas/<notion-page-id>/content

# Update an idea
curl -X PUT http://localhost:3001/api/ideas/<id> \
  -H "Content-Type: application/json" \
  -d '{"status": "Done", "tags": ["Coding", "App"]}'

# Health check
curl http://localhost:3001/health
```

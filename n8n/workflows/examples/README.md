# n8n AI Agent Workflow Examples and Best Practices

This folder contains working examples of n8n workflows that demonstrate best practices for building AI-powered automation workflows. These examples serve as reference implementations for creating reliable, scalable AI agent workflows.

## 📁 Files in This Directory

- `ai-agent-with-tools-example.json` - Working example of an AI Agent with HTTP Request Tools for Notion API integration
- More examples to be added...

## 🎯 Key Patterns and Best Practices

### 1. HTTP Request Tool Configuration

**✅ Correct Pattern:**
```json
{
  "type": "@n8n/n8n-nodes-langchain.toolHttpRequest",
  "parameters": {
    "url": "https://api.example.com/endpoint/{placeholder}",
    "method": "GET",
    "toolDescription": "Clear description of what this tool does",
    "placeholderDefinitions": {
      "values": [
        {
          "name": "placeholder",
          "description": "Clear description of this parameter"
        }
      ]
    }
  }
}
```

**❌ Common Mistakes:**
- Adding `"type"` field to placeholder definitions (causes "misconfigured placeholder" errors)
- Using separate `queryParameters` configuration instead of embedding in URL
- Complex nested parameter structures

### 2. Query Parameter Handling

**For GET Requests with Query Parameters:**
```json
{
  "url": "http://host.docker.internal:3001/api/ideas?limit={limit}&status={status}&daysBack={daysBack}",
  "method": "GET",
  "placeholderDefinitions": {
    "values": [
      {
        "name": "limit",
        "description": "Number of ideas to retrieve (default: 50, max: 100)"
      },
      {
        "name": "status", 
        "description": "Status filter: 'Not Started', 'In Progress', 'Done'"
      },
      {
        "name": "daysBack",
        "description": "Filter ideas modified in last N days (7 for this week)"
      }
    ]
  }
}
```

**For POST Requests with JSON Body:**
```json
{
  "url": "https://api.example.com/search",
  "method": "POST",
  "sendBody": true,
  "specifyBody": "json",
  "jsonBody": "{\n  \"query\": \"{searchQuery}\",\n  \"limit\": {maxResults}\n}",
  "placeholderDefinitions": {
    "values": [
      {
        "name": "searchQuery",
        "description": "Text to search for"
      },
      {
        "name": "maxResults",
        "description": "Maximum number of results to return"
      }
    ]
  }
}
```

### 3. AI Agent Node Connections

**Connection Types:**
- **Tools**: `"ai_tool"` - Connect HTTP Request Tools to AI Agent
- **Language Model**: `"ai_languageModel"` - Connect Claude, OpenAI, etc.
- **Memory**: `"ai_memory"` - Connect memory components (Buffer, Vector, etc.)

**Example Connection Structure:**
```json
"connections": {
  "Claude Model": {
    "ai_languageModel": [
      [
        {
          "node": "AI Agent",
          "type": "ai_languageModel",
          "index": 0
        }
      ]
    ]
  },
  "Get Ideas Tool": {
    "ai_tool": [
      [
        {
          "node": "AI Agent", 
          "type": "ai_tool",
          "index": 0
        }
      ]
    ]
  }
}
```

### 4. Tool Descriptions

**Effective Tool Descriptions Should:**
- Clearly explain what the tool does
- Specify input parameters and their formats
- Include examples when helpful
- Mention any constraints or limitations

**Example:**
```
"toolDescription": "Get ideas from Notion database - returns all ideas with status, content, tags. Use status='Not Started' to find unprocessed ideas. Use daysBack=7 to get ideas from this week only."
```

### 5. Placeholder Definitions

**Simple and Clear:**
```json
"placeholderDefinitions": {
  "values": [
    {
      "name": "limit",
      "description": "Number of ideas to retrieve (default: 50, max: 100)"
    }
  ]
}
```

**❌ Avoid:**
- Adding `"type"` fields
- Complex nested structures
- Unclear or generic descriptions

## 🔧 Troubleshooting Common Issues

### "Misconfigured placeholder" Error
- **Cause**: Usually caused by adding `"type"` field to placeholder definitions
- **Solution**: Remove `"type"` field, keep only `"name"` and `"description"`

### "404 Not Found" Errors
- **Cause**: Incorrect API endpoint URLs
- **Solution**: Verify endpoints match your MCP server's actual routes

### Tools Not Being Called
- **Cause**: Poor tool descriptions or unclear parameter definitions
- **Solution**: Improve tool descriptions with clear, specific language

### Connection Errors
- **Cause**: Wrong connection types between nodes
- **Solution**: Use correct connection types (`ai_tool`, `ai_languageModel`, `ai_memory`)

## 🚀 MCP Server Integration

When integrating with MCP servers (like our notion-idea-server):

1. **Use correct endpoint URLs**: `http://host.docker.internal:3001/api/ideas`
2. **Follow API patterns**: Match the server's actual endpoint structure
3. **Sync changes**: Keep n8n workflow tools synchronized with server API changes
4. **Test endpoints**: Verify endpoints work independently before adding to workflow

## 📚 Additional Resources

- [n8n AI Agent Documentation](https://docs.n8n.io/)
- [n8n Community Forum](https://community.n8n.io/)
- [LangChain Tool Integration Guide](https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.toolhttprequest/)

## 🔄 Workflow Development Process

1. **Start with working examples** from this folder
2. **Modify incrementally** - change one thing at a time
3. **Test frequently** - verify each tool works independently
4. **Use clear naming** - make node purposes obvious
5. **Document changes** - keep track of what works

---

**Remember**: Always reference these examples when creating new AI agent workflows. They represent tested, working patterns that avoid common pitfalls and configuration errors. 
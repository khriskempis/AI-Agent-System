# MCP Server HTTP API Reference

## Base URL
```
http://localhost:3001
```

## Authentication
No authentication required (running locally)

---

## Endpoints

### 🏥 Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "service": "notion-idea-server-http", 
  "timestamp": "2025-07-28T06:00:00.000Z"
}
```

---

### 💡 Get All Ideas
```http
GET /api/ideas?limit=50&filter=productivity
```

**Query Parameters:**
- `limit` (optional): Maximum number of ideas (default: 50)
- `filter` (optional): Search term to filter ideas

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "23ed7be3-dbcd-8082-bd54-cedcc7f9846b",
      "title": "AI Productivity Tool Idea",
      "content": "Build an AI assistant that...",
      "status": "In Progress",
      "tags": ["ai", "productivity"],
      "createdAt": "2025-07-28T04:42:00.000Z",
      "lastEditedAt": "2025-07-28T04:43:00.000Z",
      "url": "https://www.notion.so/..."
    }
  ],
  "count": 1,
  "timestamp": "2025-07-28T06:00:00.000Z"
}
```

---

### 🔍 Get Specific Idea
```http
GET /api/ideas/{id}
```

**Parameters:**
- `id`: Notion page ID

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "23ed7be3-dbcd-8082-bd54-cedcc7f9846b",
    "title": "AI Productivity Tool Idea",
    "content": "Build an AI assistant that...",
    "status": "In Progress",
    "tags": ["ai", "productivity"],
    "createdAt": "2025-07-28T04:42:00.000Z",
    "lastEditedAt": "2025-07-28T04:43:00.000Z",
    "url": "https://www.notion.so/..."
  },
  "timestamp": "2025-07-28T06:00:00.000Z"
}
```

---

### 🔎 Search Ideas
```http
POST /api/ideas/search
```

**Body:**
```json
{
  "query": "productivity AI",
  "limit": 20
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "23ed7be3-dbcd-8082-bd54-cedcc7f9846b",
      "title": "AI Productivity Tool Idea",
      "content": "Build an AI assistant that...",
      "status": "In Progress",
      "tags": ["ai", "productivity"],
      "createdAt": "2025-07-28T04:42:00.000Z",
      "lastEditedAt": "2025-07-28T04:43:00.000Z",
      "url": "https://www.notion.so/..."
    }
  ],
  "count": 1,
  "query": "productivity AI",
  "timestamp": "2025-07-28T06:00:00.000Z"
}
```

---

### ✏️ Update Idea
```http
PUT /api/ideas/{id}
```

**Body (all fields optional):**
```json
{
  "title": "Updated Idea Title",
  "content": "Updated content...",
  "status": "Completed",
  "tags": ["updated", "completed"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "23ed7be3-dbcd-8082-bd54-cedcc7f9846b",
    "title": "Updated Idea Title",
    "content": "Updated content...",
    "status": "Completed",
    "tags": ["updated", "completed"],
    "createdAt": "2025-07-28T04:42:00.000Z",
    "lastEditedAt": "2025-07-28T06:00:00.000Z",
    "url": "https://www.notion.so/..."
  },
  "timestamp": "2025-07-28T06:00:00.000Z"
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": "Error message describing what went wrong",
  "timestamp": "2025-07-28T06:00:00.000Z"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `400` - Bad Request (missing required parameters)
- `500` - Internal Server Error (Notion API issues, etc.)

---

## Example Usage

### cURL Examples
```bash
# Health check
curl http://localhost:3001/health

# Get all ideas
curl "http://localhost:3001/api/ideas?limit=10"

# Search ideas
curl -X POST http://localhost:3001/api/ideas/search \
  -H "Content-Type: application/json" \
  -d '{"query": "ai productivity", "limit": 5}'

# Update an idea
curl -X PUT http://localhost:3001/api/ideas/NOTION_PAGE_ID \
  -H "Content-Type: application/json" \
  -d '{"status": "In Progress", "tags": ["priority", "ai"]}'
```

### JavaScript Examples
```javascript
// Get all ideas
const response = await fetch('http://localhost:3001/api/ideas?limit=20');
const data = await response.json();
console.log(data.data); // Array of ideas

// Search ideas
const searchResponse = await fetch('http://localhost:3001/api/ideas/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: 'productivity', limit: 10 })
});
const searchData = await searchResponse.json();

// Update idea
const updateResponse = await fetch(`http://localhost:3001/api/ideas/${ideaId}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    status: 'Completed',
    tags: ['done', 'implemented'] 
  })
});
```

---

## Notion Property Mapping

The API automatically detects these common Notion property names:

### Title Properties:
- `Name`, `Title`, `name`, `title`

### Content Properties:
- `Content`, `Description`, `content`, `description`

### Status Properties:
- `Status`, `status`

### Tag Properties:
- `Tags`, `Categories`, `tags`, `categories`

If your Notion database uses different property names, the API will try to map them automatically. Check the server logs if properties aren't being detected correctly. 
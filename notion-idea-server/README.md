# Notion Multi-Database Server

**TypeScript MCP Server for Notion Database Management**

## Purpose
This MCP server provides tools for managing and interacting with **any** Notion database, not just ideas. It offers read and update capabilities (no deletions) for AI assistants to access your Notion databases with automatic property detection and flexible schema handling.

## Status
✅ **Ready for Configuration** - TypeScript implementation complete

## Features
- **Multi-Database Support**: Work with any Notion database, not just ideas
- **Auto-Detection**: Automatically detects database schema and property mappings
- **Legacy Compatibility**: Existing idea-specific endpoints continue to work
- **Generic Operations**: Read, search, and update any database with flexible property handling
- **Safe Design**: Read and update only - no deletion capabilities
- **Type Safety**: Full TypeScript implementation with proper type definitions

## API Endpoints

### Generic Database Endpoints (New)

#### `GET /api/databases/:databaseId/pages`
Get all pages from any Notion database
- **Parameters**: 
  - `limit` (optional): Max number of pages (default: 50)
  - `filter` (optional): Search term to filter pages
  - `status` (optional): Filter by status value
  - `daysBack` (optional): Filter by last edited date

#### `GET /api/databases/:databaseId/pages/:pageId`
Get a specific page by ID from any database
- **Parameters**: 
  - `databaseId` (required): Notion database ID
  - `pageId` (required): Notion page ID

#### `POST /api/databases/:databaseId/search`
Search pages in any database
- **Body**: 
  - `query` (required): Search term
  - `limit` (optional): Max results (default: 20)

#### `PUT /api/databases/:databaseId/pages/:pageId`
Update a page in any database with flexible property updates
- **Body**: Any valid Notion properties (auto-detected based on database schema)

#### `GET /api/databases/:databaseId/schema`
Get database schema and property information
- Returns: Database structure, property types, and available fields

#### `GET /api/databases/:databaseId/auto-config`
Auto-detect optimal property mappings for a database
- Returns: Suggested configuration for title, content, status, and tags properties

#### `GET /api/databases/:databaseId/test-connection`
Test connection to a specific database
- Returns: Connection status and accessibility information

### Legacy Idea Endpoints (Backward Compatible)

#### `GET /api/ideas`
Retrieve all ideas from your configured ideas database
- **Parameters**: 
  - `limit` (optional): Max number of ideas (default: 50)
  - `filter` (optional): Search term to filter ideas

#### `GET /api/ideas/:id`
Get a specific idea by its Notion page ID

#### `POST /api/ideas/search`
Search ideas by title or content

#### `PUT /api/ideas/:id`
Update an existing idea
- **Body**: 
  - `title` (optional): New title
  - `content` (optional): New content/description
  - `status` (optional): New status
  - `tags` (optional): Array of tags

## Usage Examples

### Working with Ideas Database (Legacy)
```bash
# Get all ideas (uses configured NOTION_DATABASE_ID)
curl http://localhost:3001/api/ideas

# Get specific idea
curl http://localhost:3001/api/ideas/12345678-1234-1234-1234-123456789abc

# Update idea status
curl -X PUT http://localhost:3001/api/ideas/12345678-1234-1234-1234-123456789abc \
  -H "Content-Type: application/json" \
  -d '{"status": "In Progress", "tags": ["urgent", "development"]}'
```

### Working with Any Database (New Generic API)
```bash
# Auto-detect database structure
curl http://localhost:3001/api/databases/87654321-4321-4321-4321-210987654321/auto-config

# Get all pages from projects database
curl http://localhost:3001/api/databases/87654321-4321-4321-4321-210987654321/pages

# Get specific page
curl http://localhost:3001/api/databases/87654321-4321-4321-4321-210987654321/pages/12345678-1234-1234-1234-123456789abc

# Update any property (auto-detected)
curl -X PUT http://localhost:3001/api/databases/87654321-4321-4321-4321-210987654321/pages/12345678-1234-1234-1234-123456789abc \
  -H "Content-Type: application/json" \
  -d '{"Name": "Updated Project Title", "Status": "Complete", "Priority": "High"}'

# Search in projects database
curl -X POST http://localhost:3001/api/databases/87654321-4321-4321-4321-210987654321/search \
  -H "Content-Type: application/json" \
  -d '{"query": "machine learning", "limit": 10}'
```

### Multi-Agent Integration
The generic endpoints are designed to work seamlessly with your multi-agent workflow:
```javascript
// Agent can work with any database dynamically
const projectsDbId = "87654321-4321-4321-4321-210987654321";
const ideasDbId = process.env.NOTION_DATABASE_ID;

// Get ideas for processing
const ideas = await fetch(`/api/databases/${ideasDbId}/pages?status=Not Started`);

// Route processed ideas to projects database
const projects = await fetch(`/api/databases/${projectsDbId}/pages`, {
  method: 'POST',
  body: JSON.stringify(processedIdea)
});
```

## Setup Instructions

### Quick Start with Docker (Recommended)

#### 1. Notion Setup
1. Create a Notion integration at https://www.notion.so/my-integrations
2. Copy the "Internal Integration Token"
3. Share your ideas database with the integration
4. Copy the database ID from the database URL

#### 2. Configure Environment
```bash
# Copy the environment template
cp env.template .env

# Edit .env with your Notion credentials
```

Edit `.env` file:
```env
NOTION_API_TOKEN=secret_your_integration_token
NOTION_DATABASE_ID=your_database_id_here
```

#### 3. Build and Run with Docker
```bash
# Build the Docker image
./scripts/docker-build.sh

# Run in production mode
./scripts/docker-run.sh

# Or run in development mode (with hot reload)
./scripts/docker-run.sh --dev
```

#### 4. Alternative Docker Commands
```bash
# Using docker-compose directly
docker-compose up                              # Production
docker-compose --profile dev up notion-idea-server-dev  # Development

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### Manual Setup (Without Docker)

#### 1. Install Dependencies
```bash
cd notion-idea-server
npm install
```

#### 2. Configure Environment
```bash
# Copy the environment template
cp env.template .env

# Edit .env with your Notion credentials
```

#### 3. Build and Run
```bash
# Build TypeScript
npm run build

# Run the server
npm start

# Or run in development mode with auto-rebuild
npm run dev
```

## Database Structure Requirements

Your Notion database should have properties with these names (case-insensitive):
- **Title/Name**: Main idea title
- **Content/Description**: Detailed description
- **Status**: Idea status (select property)
- **Tags/Categories**: Tags for categorization (multi-select)

The server is flexible and will try common property name variations.

## Usage with MCP Clients

Once running, the server communicates via stdio and can be integrated with MCP-compatible AI clients like Claude Desktop or other MCP-enabled applications.

Example MCP client configuration:
```json
{
  "mcpServers": {
    "notion-ideas": {
      "command": "node",
      "args": ["/path/to/notion-idea-server/dist/index.js"],
      "env": {
        "NOTION_API_TOKEN": "your_token",
        "NOTION_DATABASE_ID": "your_database_id"
      }
    }
  }
}
```

## Security & Permissions

- **Read-Only Database Access**: Only queries and updates, no deletions
- **Environment Variables**: Secure token storage
- **Error Handling**: Comprehensive error messages without exposing sensitive data

## Development

### Project Structure
```
src/
├── index.ts           # Main MCP server entry point
├── notion-service.ts  # Notion API interaction service
└── types.ts          # TypeScript type definitions
```

### Scripts
- `npm run build`: Compile TypeScript to JavaScript
- `npm run dev`: Watch mode for development
- `npm start`: Run the compiled server
- `npm run clean`: Remove build artifacts 
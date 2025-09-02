# Notion Idea Server

**TypeScript MCP Server for Notion Idea Management**

## Purpose
This MCP server provides tools for managing and interacting with ideas stored in Notion databases. It offers read and update capabilities (no deletions) for AI assistants to access your idea collection.

## Status
✅ **Ready for Configuration** - TypeScript implementation complete

## Features
- **Read Operations**: Retrieve all ideas, get specific ideas by ID, search ideas
- **Update Operations**: Update idea title, content, status, and tags
- **Safe Design**: Read and update only - no deletion capabilities
- **Flexible Property Mapping**: Automatically detects common Notion property names
- **Type Safety**: Full TypeScript implementation with proper type definitions

## Available Tools

### `get_ideas`
Retrieve all ideas from your Notion database
- **Parameters**: 
  - `limit` (optional): Max number of ideas (default: 50)
  - `filter` (optional): Search term to filter ideas

### `get_idea_by_id`
Get a specific idea by its Notion page ID
- **Parameters**: 
  - `id` (required): Notion page ID

### `search_ideas`
Search ideas by title or content
- **Parameters**: 
  - `query` (required): Search term
  - `limit` (optional): Max results (default: 20)

### `update_idea`
Update an existing idea
- **Parameters**: 
  - `id` (required): Notion page ID
  - `title` (optional): New title
  - `content` (optional): New content/description
  - `status` (optional): New status
  - `tags` (optional): Array of tags

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
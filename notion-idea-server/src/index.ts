#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import { NotionService } from './notion-service.js';
import { z } from 'zod';

// Load environment variables
dotenv.config();

// Validate required environment variables
const envSchema = z.object({
  NOTION_API_TOKEN: z.string().min(1, 'NOTION_API_TOKEN is required'),
  NOTION_DATABASE_ID: z.string().min(1, 'NOTION_DATABASE_ID is required'),
});

console.error('Starting environment validation...');
try {
  const env = envSchema.parse(process.env);
  console.error('✅ Environment validation passed');
} catch (error) {
  console.error('❌ Environment validation failed:', error);
  process.exit(1);
}

const env = envSchema.parse(process.env);

// Initialize Notion service
console.error('Initializing Notion service...');
try {
  const notionService = new NotionService(env.NOTION_API_TOKEN, env.NOTION_DATABASE_ID);
  console.error('✅ Notion service initialized');
} catch (error) {
  console.error('❌ Notion service initialization failed:', error);
  process.exit(1);
}

const notionService = new NotionService(env.NOTION_API_TOKEN, env.NOTION_DATABASE_ID);

// Create MCP server
const server = new Server(
  {
    name: 'notion-idea-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_ideas',
        description: 'Retrieve all ideas from the Notion database',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of ideas to retrieve (default: 10)',
              default: 10,
            },
            filter: {
              type: 'string',
              description: 'Optional search term to filter ideas',
            },
          },
        },
      },
      {
        name: 'get_idea_by_id',
        description: 'Retrieve a specific idea by its Notion page ID',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'The Notion page ID of the idea',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'search_ideas',
        description: 'Search ideas by title or content',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query to find ideas',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results (default: 20)',
              default: 20,
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'update_idea',
        description: 'Update an existing idea (title, content, status, etc.)',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'The Notion page ID of the idea to update',
            },
            title: {
              type: 'string',
              description: 'New title for the idea',
            },
            content: {
              type: 'string',
              description: 'New content/description for the idea',
            },
            status: {
              type: 'string',
              description: 'New status for the idea (e.g., "Not Started", "In Progress", "Completed")',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Tags/categories for the idea',
            },
          },
          required: ['id'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'get_ideas': {
        const limit = args?.limit as number || 10;
        const filter = args?.filter as string;
        const ideas = await notionService.getIdeas(limit, filter);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(ideas, null, 2),
            },
          ],
        };
      }

      case 'get_idea_by_id': {
        const id = args?.id as string;
        if (!id) {
          throw new McpError(ErrorCode.InvalidParams, 'ID parameter is required');
        }
        const idea = await notionService.getIdeaById(id);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(idea, null, 2),
            },
          ],
        };
      }

      case 'search_ideas': {
        const query = args?.query as string;
        const limit = args?.limit as number || 20;
        if (!query) {
          throw new McpError(ErrorCode.InvalidParams, 'Query parameter is required');
        }
        const ideas = await notionService.searchIdeas(query, limit);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(ideas, null, 2),
            },
          ],
        };
      }

      case 'update_idea': {
        const id = args?.id as string;
        if (!id) {
          throw new McpError(ErrorCode.InvalidParams, 'ID parameter is required');
        }
        
        const updates = {
          title: args?.title as string,
          content: args?.content as string,
          status: args?.status as string,
          tags: args?.tags as string[],
        };
        
        const updatedIdea = await notionService.updateIdea(id, updates);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(updatedIdea, null, 2),
            },
          ],
        };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Error executing tool ${name}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Notion Idea MCP server running on stdio');
  
  // Keep the process alive for Docker daemon mode
  // MCP servers normally exit when stdin closes, but we want to keep it running
  const keepAlive = setInterval(() => {
    // Do nothing, just keep the process alive
  }, 30000); // Check every 30 seconds
  
  // Handle stdin close (normal for daemon mode)
  process.stdin.on('close', () => {
    console.error('stdin closed, but keeping process alive for Docker...');
  });
  
  process.stdin.on('error', (err) => {
    console.error('stdin error (expected in Docker):', err.message);
  });
  
  // Handle process termination gracefully
  process.on('SIGINT', () => {
    console.error('Received SIGINT, shutting down...');
    clearInterval(keepAlive);
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.error('Received SIGTERM, shutting down...');
    clearInterval(keepAlive);
    process.exit(0);
  });
  
  // Resume stdin to handle input if available
  process.stdin.resume();
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
}); 
#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { z } from 'zod';
import { NotionService } from './notion-service.js';
import { GenericNotionService } from './generic-notion-service.js';
import { DatabaseConfig } from './types.js';
import { ComprehensiveHealthCheck } from './health-checks/comprehensive-health.js';

// Load environment variables
dotenv.config();

// Validate required environment variables
const envSchema = z.object({
  NOTION_API_TOKEN: z.string().min(1, 'NOTION_API_TOKEN is required'),
  NOTION_DATABASE_ID: z.string().min(1, 'NOTION_DATABASE_ID is required'),
  HTTP_PORT: z.string().default('3001'),
});

const env = envSchema.parse(process.env);

// Initialize Notion services
const notionService = new NotionService(env.NOTION_API_TOKEN, env.NOTION_DATABASE_ID);
const genericNotionService = new GenericNotionService(env.NOTION_API_TOKEN);

// Initialize health checker
const healthChecker = new ComprehensiveHealthCheck(notionService);

// Default ideas database configuration (for backward compatibility)
const ideasDatabaseConfig: DatabaseConfig = {
  id: env.NOTION_DATABASE_ID,
  type: 'ideas',
  propertyMappings: {
    title: 'Name',
    content: 'Direct LLM',
    status: 'Status',
    tags: 'Tags'
  }
};

// Create Express app
const app = express();
const PORT = parseInt(env.HTTP_PORT);

// Middleware
app.use(cors());
app.use(express.json());

// Add request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Add request metrics tracking for health monitoring
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const responseTime = Date.now() - start;
    const isError = res.statusCode >= 400;
    healthChecker.recordRequest(responseTime, isError);
  });
  
  next();
});

// Comprehensive health check endpoint
app.get('/health', async (req, res) => {
  try {
    const health = await healthChecker.checkHealth();
    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      service: 'notion-idea-server-http',
      timestamp: new Date().toISOString(),
      error: 'Health check system failed',
      checks: {},
      metrics: {
        total_requests: 0,
        error_rate: 0,
        avg_response_time: 0
      }
    });
  }
});

// Get all ideas
app.get('/api/ideas', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const filter = req.query.filter as string;
    const status = req.query.status as string;
    const daysBack = parseInt(req.query.daysBack as string) || 0;
    
    // Debug logging to see what parameters are received
    console.log('Query parameters test received:', {
      limit,
      filter: filter ? `"${filter}"` : 'undefined (no filter param)',
      status: status ? `"${status}"` : 'undefined (no status param)',
      daysBack,
      rawQuery: req.query
    });
    
    const ideas = await notionService.getIdeas(limit, filter, status, daysBack);
    
    res.json({
      success: true,
      data: ideas,
      count: ideas.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting ideas:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Get ideas summary (useful for agents) - MUST be before /:id route
app.get('/api/ideas/summary', async (req, res) => {
  try {
    const ideas = await notionService.getIdeas(100); // Get up to 100 ideas
    
    const summary = {
      totalIdeas: ideas.length,
      statuses: ideas.reduce((acc, idea) => {
        acc[idea.status] = (acc[idea.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      recentIdeas: ideas
        .sort((a, b) => new Date(b.lastEditedAt).getTime() - new Date(a.lastEditedAt).getTime())
        .slice(0, 5)
        .map(idea => ({
          id: idea.id,
          title: idea.title,
          status: idea.status,
          lastEdited: idea.lastEditedAt
        })),
      allTags: [...new Set(ideas.flatMap(idea => idea.tags))],
    };
    
    res.json({
      success: true,
      data: summary,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting ideas summary:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Get database schema for debugging
app.get('/api/debug/schema', async (req, res) => {
  try {
    const schema = await notionService.getDatabaseSchema();
    
    res.json({
      success: true,
      data: schema,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting database schema:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Get page content blocks (like the example workflow)
app.get('/api/ideas/:id/content', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get the idea with full content
    const idea = await notionService.getIdeaById(id);
    
    res.json({
      success: true,
      data: {
        id: idea.id,
        title: idea.title,
        content: idea.content,
        contentType: 'blocks',
        url: idea.url
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting page content:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Get idea by ID
app.get('/api/ideas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const idea = await notionService.getIdeaById(id);
    
    res.json({
      success: true,
      data: idea,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting idea by ID:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Search ideas
app.post('/api/ideas/search', async (req, res) => {
  try {
    const { query, limit = 20 } = req.body;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter is required',
        timestamp: new Date().toISOString()
      });
    }
    
    const ideas = await notionService.searchIdeas(query, limit);
    
    res.json({
      success: true,
      data: ideas,
      count: ideas.length,
      query,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error searching ideas:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Update idea
app.put('/api/ideas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Debug logging to see what's in the request body
    console.log('PUT /api/ideas/:id received:', {
      id: id.substring(0, 8) + '...',
      bodyKeys: Object.keys(updates || {}),
      body: updates,
      contentType: req.get('Content-Type'),
      bodyLength: JSON.stringify(updates || {}).length
    });
    
    const updatedIdea = await notionService.updateIdea(id, updates);
    
    res.json({
      success: true,
      data: updatedIdea,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating idea:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// =============================================================================
// GENERIC DATABASE ENDPOINTS
// =============================================================================

// Get database schema
app.get('/api/databases/:databaseId/schema', async (req, res) => {
  try {
    const { databaseId } = req.params;
    const schema = await genericNotionService.getDatabaseSchema(databaseId);
    
    res.json({
      success: true,
      data: schema,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting database schema:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Auto-detect database property mappings
app.get('/api/databases/:databaseId/auto-config', async (req, res) => {
  try {
    const { databaseId } = req.params;
    const mappings = await genericNotionService.detectPropertyMappings(databaseId);
    
    const suggestedConfig: DatabaseConfig = {
      id: databaseId,
      type: 'generic',
      propertyMappings: mappings
    };
    
    res.json({
      success: true,
      data: {
        databaseId,
        suggestedConfig,
        propertyMappings: mappings
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error auto-detecting database config:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Get all pages from any database
app.get('/api/databases/:databaseId/pages', async (req, res) => {
  try {
    const { databaseId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const filter = req.query.filter as string;
    const status = req.query.status as string;
    const daysBack = parseInt(req.query.daysBack as string) || 0;
    
    // Auto-detect property mappings for this database
    const mappings = await genericNotionService.detectPropertyMappings(databaseId);
    const config: DatabaseConfig = {
      id: databaseId,
      type: 'generic',
      propertyMappings: mappings
    };
    
    console.log('Generic database query parameters:', {
      databaseId,
      limit,
      filter: filter ? `"${filter}"` : 'undefined',
      status: status ? `"${status}"` : 'undefined',
      daysBack,
      detectedMappings: mappings
    });
    
    const pages = await genericNotionService.getPages(config, { limit, filter, status, daysBack });
    
    res.json({
      success: true,
      data: pages,
      count: pages.length,
      config: config,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting database pages:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Get page by ID from any database
app.get('/api/databases/:databaseId/pages/:pageId', async (req, res) => {
  try {
    const { databaseId, pageId } = req.params;
    
    // Auto-detect property mappings for this database
    const mappings = await genericNotionService.detectPropertyMappings(databaseId);
    const config: DatabaseConfig = {
      id: databaseId,
      type: 'generic',
      propertyMappings: mappings
    };
    
    const page = await genericNotionService.getPageById(pageId, config);
    
    res.json({
      success: true,
      data: page,
      config: config,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting page by ID:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Search pages in any database
app.post('/api/databases/:databaseId/search', async (req, res) => {
  try {
    const { databaseId } = req.params;
    const { query, limit = 20 } = req.body;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter is required',
        timestamp: new Date().toISOString()
      });
    }
    
    // Auto-detect property mappings for this database
    const mappings = await genericNotionService.detectPropertyMappings(databaseId);
    const config: DatabaseConfig = {
      id: databaseId,
      type: 'generic',
      propertyMappings: mappings
    };
    
    const pages = await genericNotionService.searchPages(config, query, limit);
    
    res.json({
      success: true,
      data: pages,
      count: pages.length,
      query,
      config: config,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error searching database pages:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Update page in any database
app.put('/api/databases/:databaseId/pages/:pageId', async (req, res) => {
  try {
    const { databaseId, pageId } = req.params;
    const updates = req.body;
    
    console.log('PUT /api/databases/:databaseId/pages/:pageId received:', {
      databaseId: databaseId.substring(0, 8) + '...',
      pageId: pageId.substring(0, 8) + '...',
      bodyKeys: Object.keys(updates || {}),
      body: updates,
      contentType: req.get('Content-Type'),
      bodyLength: JSON.stringify(updates || {}).length
    });
    
    // Auto-detect property mappings for this database
    const mappings = await genericNotionService.detectPropertyMappings(databaseId);
    const config: DatabaseConfig = {
      id: databaseId,
      type: 'generic',
      propertyMappings: mappings
    };
    
    const updatedPage = await genericNotionService.updatePage(pageId, config, updates);
    
    res.json({
      success: true,
      data: updatedPage,
      config: config,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating database page:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Test connection to any database
app.get('/api/databases/:databaseId/test-connection', async (req, res) => {
  try {
    const { databaseId } = req.params;
    const connectionResult = await genericNotionService.testConnection(databaseId);
    
    res.json({
      success: true,
      data: {
        databaseId,
        connected: connectionResult.connected,
        databaseName: connectionResult.databaseName,
        message: connectionResult.connected 
          ? `Database connection successful: ${connectionResult.databaseName}` 
          : `Database connection failed: ${connectionResult.error}`,
        error: connectionResult.error
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error testing database connection:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Notion Multi-Database HTTP API running on port ${PORT} [DEVELOPMENT MODE]`);
  console.log(`📖 Health check: http://localhost:${PORT}/health`);
  console.log(`💡 Ideas API (legacy): http://localhost:${PORT}/api/ideas`);
  console.log(`🗄️  Generic Database API: http://localhost:${PORT}/api/databases/:databaseId/pages`);
  
  // Test Notion connection on startup
  notionService.testConnection()
    .then(connected => {
      if (connected) {
        console.log('✅ Notion API connection verified');
      } else {
        console.log('❌ Notion API connection failed');
      }
    })
    .catch(error => {
      console.error('❌ Notion API connection error:', error);
    });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down HTTP server...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down HTTP server...');
  process.exit(0);
}); 
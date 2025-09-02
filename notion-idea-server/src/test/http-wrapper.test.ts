/**
 * Unit Tests for HTTP Wrapper
 * Tests API endpoints and HTTP functionality
 * Designed for multi-MCP server architecture scalability
 */

import request from 'supertest';
import express from 'express';
import { NotionService } from '../notion-service';
import { TestUtils, TestConstants } from './setup';

// Mock the NotionService
jest.mock('../notion-service');

describe('HTTP Wrapper API', () => {
  let app: express.Application;
  let mockNotionService: jest.Mocked<NotionService>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock NotionService
    mockNotionService = {
      getIdeas: jest.fn(),
      getIdeaById: jest.fn(),
      searchIdeas: jest.fn(),
      updateIdea: jest.fn()
    } as any;

    // Mock the NotionService constructor
    (NotionService as jest.MockedClass<typeof NotionService>).mockImplementation(
      () => mockNotionService
    );

    // Create a test Express app that mirrors the actual HTTP wrapper
    app = express();
    app.use(express.json());

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'notion-idea-server'
      });
    });

    // Get all ideas endpoint
    app.get('/api/ideas', async (req, res) => {
      try {
        const limit = parseInt(req.query.limit as string) || 50;
        const filter = req.query.filter as string;
        const status = req.query.status as string;
        const daysBack = parseInt(req.query.daysBack as string) || 0;
        
        const ideas = await mockNotionService.getIdeas(limit, filter, status, daysBack);
        
        res.json({
          success: true,
          data: ideas,
          count: ideas.length,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        });
      }
    });

    // Get idea by ID endpoint
    app.get('/api/ideas/:id', async (req, res) => {
      try {
        const idea = await mockNotionService.getIdeaById(req.params.id);
        res.json({
          success: true,
          data: idea,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(404).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        });
      }
    });

    // Search ideas endpoint
    app.post('/api/ideas/search', async (req, res) => {
      try {
        const { query, limit = 20 } = req.body;
        const ideas = await mockNotionService.searchIdeas(query, limit);
        res.json({
          success: true,
          data: ideas,
          count: ideas.length,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        });
      }
    });

    // Update idea endpoint
    app.put('/api/ideas/:id', async (req, res) => {
      try {
        const updatedIdea = await mockNotionService.updateIdea(req.params.id, req.body);
        res.json({
          success: true,
          data: updatedIdea,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        });
      }
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        service: 'notion-idea-server'
      });
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('GET /api/ideas', () => {
    it('should return all ideas with default parameters', async () => {
      // Arrange
      const mockIdeas = [
        TestUtils.createMockIdea(),
        TestUtils.createMockIdea({ id: 'idea-2', title: 'Second Idea' })
      ];
      mockNotionService.getIdeas.mockResolvedValue(mockIdeas);

      // Act
      const response = await request(app)
        .get('/api/ideas')
        .expect(200);

      // Assert
      expect(response.body).toMatchObject({
        success: true,
        count: 2
      });
      expect(response.body.data).toHaveLength(2);
      expect(mockNotionService.getIdeas).toHaveBeenCalledWith(50, undefined, undefined, 0);
    });

    it('should accept query parameters for filtering', async () => {
      // Arrange
      mockNotionService.getIdeas.mockResolvedValue([]);

      // Act
      await request(app)
        .get('/api/ideas?limit=10&filter=test&status=Not Started&daysBack=7')
        .expect(200);

      // Assert
      expect(mockNotionService.getIdeas).toHaveBeenCalledWith(10, 'test', 'Not Started', 7);
    });

    it('should handle service errors gracefully', async () => {
      // Arrange
      mockNotionService.getIdeas.mockRejectedValue(new Error('Service error'));

      // Act
      const response = await request(app)
        .get('/api/ideas')
        .expect(500);

      // Assert
      expect(response.body).toMatchObject({
        success: false,
        error: 'Service error'
      });
    });

    it('should handle invalid limit parameter', async () => {
      // Arrange
      mockNotionService.getIdeas.mockResolvedValue([]);

      // Act
      await request(app)
        .get('/api/ideas?limit=invalid')
        .expect(200);

      // Assert
      expect(mockNotionService.getIdeas).toHaveBeenCalledWith(50, undefined, undefined, 0);
    });
  });

  describe('GET /api/ideas/:id', () => {
    it('should return specific idea by ID', async () => {
      // Arrange
      const mockIdea = TestUtils.createMockIdea();
      mockNotionService.getIdeaById.mockResolvedValue(mockIdea);

      // Act
      const response = await request(app)
        .get(`/api/ideas/${TestConstants.MOCK_PAGE_ID}`)
        .expect(200);

      // Assert
      expect(response.body).toMatchObject({
        success: true,
        data: mockIdea
      });
      expect(mockNotionService.getIdeaById).toHaveBeenCalledWith(TestConstants.MOCK_PAGE_ID);
    });

    it('should return 404 for non-existent idea', async () => {
      // Arrange
      mockNotionService.getIdeaById.mockRejectedValue(new Error('Not found'));

      // Act
      const response = await request(app)
        .get('/api/ideas/non-existent-id')
        .expect(404);

      // Assert
      expect(response.body).toMatchObject({
        success: false,
        error: 'Not found'
      });
    });
  });

  describe('POST /api/ideas/search', () => {
    it('should search ideas with query', async () => {
      // Arrange
      const mockIdeas = [TestUtils.createMockIdea()];
      mockNotionService.searchIdeas.mockResolvedValue(mockIdeas);

      // Act
      const response = await request(app)
        .post('/api/ideas/search')
        .send({ query: 'test query', limit: 10 })
        .expect(200);

      // Assert
      expect(response.body).toMatchObject({
        success: true,
        count: 1
      });
      expect(mockNotionService.searchIdeas).toHaveBeenCalledWith('test query', 10);
    });

    it('should use default limit when not provided', async () => {
      // Arrange
      mockNotionService.searchIdeas.mockResolvedValue([]);

      // Act
      await request(app)
        .post('/api/ideas/search')
        .send({ query: 'test' })
        .expect(200);

      // Assert
      expect(mockNotionService.searchIdeas).toHaveBeenCalledWith('test', 20);
    });

    it('should handle search errors', async () => {
      // Arrange
      mockNotionService.searchIdeas.mockRejectedValue(new Error('Search failed'));

      // Act
      const response = await request(app)
        .post('/api/ideas/search')
        .send({ query: 'test' })
        .expect(500);

      // Assert
      expect(response.body).toMatchObject({
        success: false,
        error: 'Search failed'
      });
    });
  });

  describe('PUT /api/ideas/:id', () => {
    it('should update idea successfully', async () => {
      // Arrange
      const updateData = { status: 'In Progress', content: 'Updated content' };
      const updatedIdea = TestUtils.createMockIdea(updateData);
      mockNotionService.updateIdea.mockResolvedValue(updatedIdea);

      // Act
      const response = await request(app)
        .put(`/api/ideas/${TestConstants.MOCK_PAGE_ID}`)
        .send(updateData)
        .expect(200);

      // Assert
      expect(response.body).toMatchObject({
        success: true,
        data: updatedIdea
      });
      expect(mockNotionService.updateIdea).toHaveBeenCalledWith(
        TestConstants.MOCK_PAGE_ID,
        updateData
      );
    });

    it('should handle update errors', async () => {
      // Arrange
      mockNotionService.updateIdea.mockRejectedValue(new Error('Update failed'));

      // Act
      const response = await request(app)
        .put('/api/ideas/some-id')
        .send({ status: 'Done' })
        .expect(500);

      // Assert
      expect(response.body).toMatchObject({
        success: false,
        error: 'Update failed'
      });
    });

    it('should accept partial updates', async () => {
      // Arrange
      const partialUpdate = { status: 'Done' };
      const updatedIdea = TestUtils.createMockIdea(partialUpdate);
      mockNotionService.updateIdea.mockResolvedValue(updatedIdea);

      // Act
      await request(app)
        .put('/api/ideas/test-id')
        .send(partialUpdate)
        .expect(200);

      // Assert
      expect(mockNotionService.updateIdea).toHaveBeenCalledWith('test-id', partialUpdate);
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle empty request body for search', async () => {
      // Arrange
      mockNotionService.searchIdeas.mockResolvedValue([]);

      // Act
      await request(app)
        .post('/api/ideas/search')
        .send({})
        .expect(200);

      // Assert
      expect(mockNotionService.searchIdeas).toHaveBeenCalledWith(undefined, 20);
    });

    it('should include timestamp in all responses', async () => {
      // Arrange
      mockNotionService.getIdeas.mockResolvedValue([]);

      // Act
      const response = await request(app)
        .get('/api/ideas')
        .expect(200);

      // Assert
      expect(response.body.timestamp).toBeDefined();
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    });

    it('should return JSON content type', async () => {
      // Act
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Assert
      expect(response.headers['content-type']).toMatch(/json/);
    });

    it('should handle special characters in query parameters', async () => {
      // Arrange
      mockNotionService.getIdeas.mockResolvedValue([]);

      // Act
      await request(app)
        .get('/api/ideas?filter=test%20query%20with%20spaces')
        .expect(200);

      // Assert
      expect(mockNotionService.getIdeas).toHaveBeenCalledWith(50, 'test query with spaces', undefined, 0);
    });
  });
}); 
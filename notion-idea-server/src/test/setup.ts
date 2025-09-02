/**
 * Jest Test Setup
 * Shared configuration and utilities for all tests
 * This setup supports the multi-MCP server architecture by providing
 * reusable testing patterns and utilities
 */

import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Global test utilities
export const TestUtils = {
  /**
   * Create a mock Notion page response
   */
  createMockNotionPage: (overrides: any = {}) => ({
    id: 'test-page-id',
    created_time: '2024-01-01T00:00:00.000Z',
    last_edited_time: '2024-01-01T00:00:00.000Z',
    url: 'https://notion.so/test-page',
    properties: {
      Name: {
        title: [{ plain_text: 'Test Idea' }]
      },
      Status: {
        select: { name: 'Not Started' }
      },
      Content: {
        rich_text: [{ plain_text: 'Test content' }]
      },
      Tags: {
        multi_select: [{ name: 'test' }]
      },
      ...overrides.properties
    },
    ...overrides
  }),

  /**
   * Create a mock idea object
   */
  createMockIdea: (overrides: any = {}) => ({
    id: 'test-idea-id',
    title: 'Test Idea',
    content: 'Test content',
    status: 'Not Started',
    tags: ['test'],
    createdAt: '2024-01-01T00:00:00.000Z',
    lastEditedAt: '2024-01-01T00:00:00.000Z',
    url: 'https://notion.so/test-idea',
    ...overrides
  }),

  /**
   * Wait for async operations (useful for testing async methods)
   */
  wait: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * Generate test database responses
   */
  createMockDatabaseQuery: (pages: any[] = []) => ({
    results: pages,
    next_cursor: null,
    has_more: false
  })
};

// Error patterns for testing
export const TestErrors = {
  NOTION_API_ERROR: {
    code: 'unauthorized',
    message: 'API token is invalid'
  },
  NOTION_NOT_FOUND: {
    code: 'object_not_found',
    message: 'Could not find page'
  },
  NOTION_RATE_LIMIT: {
    code: 'rate_limited',
    message: 'Rate limit exceeded'
  }
};

// Test constants that can be reused across MCP servers
export const TestConstants = {
  MOCK_DATABASE_ID: 'test-database-id',
  MOCK_PAGE_ID: 'test-page-id',
  MOCK_API_TOKEN: 'test-token',
  TEST_PORT: 3002,
  DEFAULT_TIMEOUT: 5000
}; 
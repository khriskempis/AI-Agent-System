import { z } from 'zod';

// Notion API response types
export interface NotionPage {
  id: string;
  created_time: string;
  last_edited_time: string;
  properties: Record<string, any>;
  url: string;
}

// Simplified idea structure for AI consumption
export interface Idea {
  id: string;
  title: string;
  content: string;
  status: string;
  tags: string[];
  createdAt: string;
  lastEditedAt: string;
  url: string;
}

// Update parameters
export interface IdeaUpdate {
  title?: string;
  content?: string;
  status?: string;
  tags?: string[];
}

// Search and filter options
export interface SearchOptions {
  query: string;
  limit?: number;
}

export interface GetIdeasOptions {
  limit?: number;
  filter?: string;
}

// Validation schemas
export const IdeaUpdateSchema = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  status: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const SearchOptionsSchema = z.object({
  query: z.string().min(1),
  limit: z.number().min(1).max(100).optional(),
});

export const GetIdeasOptionsSchema = z.object({
  limit: z.number().min(1).max(100).optional(),
  filter: z.string().optional(),
}); 
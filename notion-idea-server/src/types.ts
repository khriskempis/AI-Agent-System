import { z } from 'zod';

// Notion API response types
export interface NotionPage {
  id: string;
  created_time: string;
  last_edited_time: string;
  properties: Record<string, any>;
  url: string;
}

// Generic database page structure
export interface DatabasePage {
  id: string;
  title: string;
  content: string;
  properties: Record<string, any>;
  createdAt: string;
  lastEditedAt: string;
  url: string;
}

// Simplified idea structure for AI consumption (maintains backward compatibility)
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

// Generic update parameters
export interface PageUpdate {
  [propertyName: string]: any;
}

// Update parameters (maintains backward compatibility)
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

export interface GetPagesOptions {
  limit?: number;
  filter?: string;
  status?: string;
  daysBack?: number;
}

// Database configuration for different database types
export interface DatabaseConfig {
  id: string;
  type: 'ideas' | 'projects' | 'generic';
  propertyMappings: {
    title: string;
    content?: string;
    status?: string;
    tags?: string;
    [key: string]: string | undefined;
  };
}

// Validation schemas
export const PageUpdateSchema = z.record(z.any());

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

export const GetPagesOptionsSchema = z.object({
  limit: z.number().min(1).max(100).optional(),
  filter: z.string().optional(),
  status: z.string().optional(),
  daysBack: z.number().min(0).optional(),
}); 
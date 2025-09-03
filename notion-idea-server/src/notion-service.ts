import { Client } from '@notionhq/client';
import { Idea, IdeaUpdate, NotionPage } from './types.js';

export class NotionService {
  private notion: Client;
  private databaseId: string;

  constructor(token: string, databaseId: string) {
    this.notion = new Client({ auth: token });
    this.databaseId = databaseId;
  }

  /**
   * Extract text content from Notion blocks
   */
  private extractBlockText(blocks: any[]): string {
    const textParts: string[] = [];
    
    for (const block of blocks) {
      let blockText = '';
      
      switch (block.type) {
        case 'paragraph':
          // FIX: Access plain_text correctly from rich_text array
          blockText = block.paragraph?.rich_text?.map((rt: any) => rt.plain_text || rt.text?.content || '').join('') || '';
          break;
        case 'heading_1':
          blockText = '# ' + (block.heading_1?.rich_text?.map((rt: any) => rt.plain_text || rt.text?.content || '').join('') || '');
          break;
        case 'heading_2':
          blockText = '## ' + (block.heading_2?.rich_text?.map((rt: any) => rt.plain_text || rt.text?.content || '').join('') || '');
          break;
        case 'heading_3':
          blockText = '### ' + (block.heading_3?.rich_text?.map((rt: any) => rt.plain_text || rt.text?.content || '').join('') || '');
          break;
        case 'bulleted_list_item':
          blockText = '• ' + (block.bulleted_list_item?.rich_text?.map((rt: any) => rt.plain_text || rt.text?.content || '').join('') || '');
          break;
        case 'numbered_list_item':
          blockText = '1. ' + (block.numbered_list_item?.rich_text?.map((rt: any) => rt.plain_text || rt.text?.content || '').join('') || '');
          break;
        case 'to_do':
          const checked = block.to_do?.checked ? '[x]' : '[ ]';
          blockText = checked + ' ' + (block.to_do?.rich_text?.map((rt: any) => rt.plain_text || rt.text?.content || '').join('') || '');
          break;
        case 'code':
          blockText = '```\n' + (block.code?.rich_text?.map((rt: any) => rt.plain_text || rt.text?.content || '').join('') || '') + '\n```';
          break;
        case 'quote':
          blockText = '> ' + (block.quote?.rich_text?.map((rt: any) => rt.plain_text || rt.text?.content || '').join('') || '');
          break;
      }
      
      if (blockText.trim()) {
        textParts.push(blockText);
      }
    }
    
    return textParts.join('\n\n');
  }

  /**
   * Get page content blocks
   */
  private async getPageContent(pageId: string): Promise<string> {
    try {
      const response = await this.notion.blocks.children.list({
        block_id: pageId,
        page_size: 100,
      });
      
      return this.extractBlockText(response.results);
    } catch (error) {
      console.warn(`Could not fetch page content for ${pageId}:`, error);
      return '';
    }
  }

  /**
   * Convert Notion page to simplified Idea format
   * Now includes both database properties AND page content blocks
   * FIXED: Updated to match actual database schema and content extraction
   */
  private async pageToIdea(page: any, includeContent: boolean = true): Promise<Idea> {
    const properties = page.properties;
    
    // Extract title from actual "Name" property (confirmed from schema)
    const titleProperty = properties.Name;
    const title = titleProperty?.title?.[0]?.plain_text || 'Untitled';
    
    // Extract content from "Direct LLM" property (actual field name from schema)
    const contentProperty = properties['Direct LLM'];
    let content = contentProperty?.rich_text?.[0]?.plain_text || '';
    
    // Extract status from "Status" property (type: status, not select!)
    const statusProperty = properties.Status;
    const status = statusProperty?.status?.name || 'No Status';
    
    // Extract tags from "Tags" property (confirmed multi_select)
    const tagsProperty = properties.Tags;
    const tags = tagsProperty?.multi_select?.map((tag: any) => tag.name) || [];

    // Get rich page content from blocks (primary content source)
    if (includeContent) {
      const pageContent = await this.getPageContent(page.id);
      if (pageContent.trim()) {
        // Use page content as primary, fall back to property content
        content = pageContent;
      }
    }

    return {
      id: page.id,
      title,
      content,
      status,
      tags,
      createdAt: page.created_time,
      lastEditedAt: page.last_edited_time,
      url: page.url,
    };
  }

  /**
   * Get all ideas from the database
   */
  async getIdeas(limit: number = 50, filter?: string, status?: string, daysBack?: number): Promise<Idea[]> {
    try {
      const query: any = {
        database_id: this.databaseId,
        page_size: Math.min(limit, 100),
      };

      // Build filters array
      const filters: any[] = [];

      // Add text search filter if provided (FIXED: using actual property names)
      console.log('filter', filter);
      if (filter) {
        filters.push({
          or: [
            {
              property: 'Name',
              title: {
                contains: filter,
              },
            },
            {
              property: 'Direct LLM',
              rich_text: {
                contains: filter,
              },
            },
          ],
        });
      }

      // Add status filter if provided (FIXED: Status is 'status' type, not 'select')
      if (status) {
        filters.push({
          property: 'Status',
          status: {
            equals: status,
          },
        });
      }

      // Add date filter if daysBack is provided
      // NOTE: Temporarily disabled due to missing "Last edited time" property in database
      // TODO: Add "Last edited time" property to Notion database or use alternative filtering
      if (daysBack && daysBack > 0) {
        console.warn(`Date filtering (daysBack=${daysBack}) requested but "Last edited time" property not available in database. Skipping date filter.`);
        // Skip date filtering to avoid errors - will return all results matching other filters
      }

      // Apply filters if any exist
      if (filters.length > 0) {
        if (filters.length === 1) {
          query.filter = filters[0];
        } else {
          query.filter = {
            and: filters,
          };
        }
      }

      // Debug logging for database query
      console.log('Notion database query:', {
        database_id: this.databaseId,
        page_size: query.page_size,
        filter: query.filter ? JSON.stringify(query.filter, null, 2) : 'No filter',
        totalFilters: filters.length
      });

      const response = await this.notion.databases.query(query);
      
      // Debug logging for database response
      console.log('Notion database response:', {
        totalResults: response.results.length,
        hasMore: response.has_more,
        nextCursor: response.next_cursor || 'none'
      });
      
      // Log first few results' status values to see what we got
      if (response.results.length > 0) {
        console.log('Sample results status values:', response.results.slice(0, 3).map((page: any) => ({
          id: page.id.substring(0, 8) + '...',
          status: page.properties?.Status?.status?.name || 'No status',
          title: page.properties?.Name?.title?.[0]?.plain_text || 'No title'
        })));
      }
      
      const ideas = await Promise.all(response.results.map(page => this.pageToIdea(page)));
      return ideas;
    } catch (error) {
      throw new Error(`Failed to get ideas: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get a specific idea by ID
   */
  async getIdeaById(id: string): Promise<Idea> {
    try {
      const page = await this.notion.pages.retrieve({ page_id: id });
      return await this.pageToIdea(page);
    } catch (error) {
      throw new Error(`Failed to get idea ${id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Search ideas by query
   */
  async searchIdeas(query: string, limit: number = 20): Promise<Idea[]> {
    try {
      const searchQuery = {
        query,
        filter: {
          value: 'page' as const,
          property: 'object' as const,
        },
        page_size: Math.min(limit, 100),
      };

      const response = await this.notion.search(searchQuery);
      
      // Filter results to only include pages from our database
      const filteredResults = response.results.filter(
        (result: any) => result.parent?.database_id === this.databaseId
      );

      const ideas = await Promise.all(filteredResults.map(page => this.pageToIdea(page)));
      return ideas;
    } catch (error) {
      throw new Error(`Failed to search ideas: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Update an existing idea
   */
  async updateIdea(id: string, updates: IdeaUpdate): Promise<Idea> {
    try {
      // Debug logging to see what updates are being requested
      console.log('updateIdea called with:', {
        id: id.substring(0, 8) + '...',
        updates: updates,
        updateKeys: Object.keys(updates || {}),
        hasTitle: !!updates.title,
        hasContent: !!updates.content,
        hasStatus: !!updates.status,
        hasTags: !!updates.tags
      });
      
      // First, get the current page to understand its property structure
      const currentPage = await this.notion.pages.retrieve({ page_id: id });
      const existingProperties = (currentPage as any).properties;
      
      const properties: any = {};

      // Update title (FIXED: only "Name" property exists)
      if (updates.title) {
        properties.Name = {
          title: [{ text: { content: updates.title } }],
        };
      }

      // Update content (FIXED: actual property name is "Direct LLM")
      if (updates.content) {
        properties['Direct LLM'] = {
          rich_text: [{ text: { content: updates.content } }],
        };
      }

      // Update status (FIXED: Status is 'status' type, not 'select')
      if (updates.status) {
        properties.Status = {
          status: { name: updates.status },
        };
      }

      // Update tags (FIXED: only "Tags" property exists)
      if (updates.tags) {
        const tagMappings = updates.tags.map(tag => ({ name: tag }));
        properties.Tags = {
          multi_select: tagMappings,
        };
      }

      // Only proceed if we have properties to update
      if (Object.keys(properties).length === 0) {
        console.warn(`No matching properties found for update on idea ${id}. Available properties:`, Object.keys(existingProperties));
        // Return current idea without updating
        return this.pageToIdea(currentPage);
      }

      console.log(`Updating idea ${id} with properties:`, Object.keys(properties));

      const response = await this.notion.pages.update({
        page_id: id,
        properties,
      });

      return await this.pageToIdea(response);
    } catch (error) {
      throw new Error(`Failed to update idea ${id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Test the connection to Notion and verify database access
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.notion.databases.retrieve({ database_id: this.databaseId });
      return true;
    } catch (error) {
      console.error('Notion connection test failed:', error);
      return false;
    }
  }

  /**
   * Get database schema information for debugging
   */
  async getDatabaseSchema(): Promise<any> {
    try {
      const database = await this.notion.databases.retrieve({ database_id: this.databaseId });
      return {
        id: database.id,
        title: (database as any).title?.[0]?.plain_text || 'Unknown',
        properties: Object.keys((database as any).properties || {}),
        propertyDetails: (database as any).properties
      };
    } catch (error) {
      throw new Error(`Failed to get database schema: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} 
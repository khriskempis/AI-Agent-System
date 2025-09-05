import { Client } from '@notionhq/client';
import { DatabasePage, PageUpdate, GetPagesOptions, DatabaseConfig } from './types.js';

export class GenericNotionService {
  private notion: Client;

  constructor(token: string) {
    this.notion = new Client({ auth: token });
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
   * Extract property value based on property type
   */
  private extractPropertyValue(property: any, propertyType: string): any {
    switch (propertyType) {
      case 'title':
        return property?.title?.[0]?.plain_text || 'Untitled';
      case 'rich_text':
        return property?.rich_text?.[0]?.plain_text || '';
      case 'select':
        return property?.select?.name || '';
      case 'status':
        return property?.status?.name || '';
      case 'multi_select':
        return property?.multi_select?.map((item: any) => item.name) || [];
      case 'number':
        return property?.number || 0;
      case 'checkbox':
        return property?.checkbox || false;
      case 'date':
        return property?.date?.start || null;
      case 'url':
        return property?.url || '';
      case 'email':
        return property?.email || '';
      case 'phone_number':
        return property?.phone_number || '';
      default:
        return property || null;
    }
  }

  /**
   * Convert Notion page to generic DatabasePage format
   */
  private async pageToDatabasePage(page: any, config: DatabaseConfig, includeContent: boolean = true): Promise<DatabasePage> {
    const properties = page.properties;
    const mappings = config.propertyMappings;
    
    // Extract title using the configured mapping
    const titleProperty = properties[mappings.title];
    const title = this.extractPropertyValue(titleProperty, 'title');
    
    // Extract content from configured content property
    let content = '';
    if (mappings.content) {
      const contentProperty = properties[mappings.content];
      content = this.extractPropertyValue(contentProperty, 'rich_text');
    }
    
    // Get rich page content from blocks if enabled
    if (includeContent) {
      const pageContent = await this.getPageContent(page.id);
      if (pageContent.trim()) {
        content = pageContent;
      }
    }

    // Extract all properties for flexible access
    const extractedProperties: Record<string, any> = {};
    const schema = await this.getDatabaseSchema(config.id);
    
    for (const [propName, propConfig] of Object.entries(schema.propertyDetails || {})) {
      if (properties[propName]) {
        extractedProperties[propName] = this.extractPropertyValue(properties[propName], (propConfig as any).type);
      }
    }

    return {
      id: page.id,
      title,
      content,
      properties: extractedProperties,
      createdAt: page.created_time,
      lastEditedAt: page.last_edited_time,
      url: page.url,
    };
  }

  /**
   * Get all pages from a database
   */
  async getPages(config: DatabaseConfig, options: GetPagesOptions = {}): Promise<DatabasePage[]> {
    try {
      const { limit = 50, filter, status, daysBack } = options;
      
      const query: any = {
        database_id: config.id,
        page_size: Math.min(limit, 100),
      };

      // Build filters array
      const filters: any[] = [];

      // Add text search filter if provided
      if (filter && config.propertyMappings.title) {
        filters.push({
          or: [
            {
              property: config.propertyMappings.title,
              title: {
                contains: filter,
              },
            },
            ...(config.propertyMappings.content ? [{
              property: config.propertyMappings.content,
              rich_text: {
                contains: filter,
              },
            }] : [])
          ],
        });
      }

      // Add status filter if provided and configured
      if (status && config.propertyMappings.status) {
        filters.push({
          property: config.propertyMappings.status,
          status: {
            equals: status,
          },
        });
      }

      // Add date filter if daysBack is provided
      if (daysBack && daysBack > 0) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysBack);
        
        filters.push({
          property: 'Last edited time',
          date: {
            on_or_after: cutoffDate.toISOString(),
          },
        });
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

      console.log('Generic database query:', {
        database_id: config.id,
        type: config.type,
        page_size: query.page_size,
        filter: query.filter ? JSON.stringify(query.filter, null, 2) : 'No filter',
        totalFilters: filters.length
      });

      const response = await this.notion.databases.query(query);
      
      console.log('Generic database response:', {
        totalResults: response.results.length,
        hasMore: response.has_more,
        nextCursor: response.next_cursor || 'none'
      });
      
      const pages = await Promise.all(
        response.results.map(page => this.pageToDatabasePage(page, config))
      );
      return pages;
    } catch (error) {
      throw new Error(`Failed to get pages from database ${config.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get a specific page by ID
   */
  async getPageById(pageId: string, config: DatabaseConfig): Promise<DatabasePage> {
    try {
      const page = await this.notion.pages.retrieve({ page_id: pageId });
      return await this.pageToDatabasePage(page, config);
    } catch (error) {
      throw new Error(`Failed to get page ${pageId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Search pages in a database
   */
  async searchPages(config: DatabaseConfig, query: string, limit: number = 20): Promise<DatabasePage[]> {
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
        (result: any) => result.parent?.database_id === config.id
      );

      const pages = await Promise.all(
        filteredResults.map(page => this.pageToDatabasePage(page, config))
      );
      return pages;
    } catch (error) {
      throw new Error(`Failed to search pages in database ${config.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Update a page with generic property updates
   */
  async updatePage(pageId: string, config: DatabaseConfig, updates: PageUpdate): Promise<DatabasePage> {
    try {
      console.log('updatePage called with:', {
        id: pageId.substring(0, 8) + '...',
        updates: updates,
        updateKeys: Object.keys(updates || {}),
        databaseType: config.type
      });
      
      // Get the current page to understand its property structure
      const currentPage = await this.notion.pages.retrieve({ page_id: pageId });
      const existingProperties = (currentPage as any).properties;
      
      const properties: any = {};

      // Get database schema to understand property types
      const schema = await this.getDatabaseSchema(config.id);
      const propertyDetails = schema.propertyDetails || {};

      // Process each update based on property type
      for (const [propertyName, value] of Object.entries(updates)) {
        const propConfig = propertyDetails[propertyName];
        if (!propConfig) {
          console.warn(`Property ${propertyName} not found in database schema`);
          continue;
        }

        switch ((propConfig as any).type) {
          case 'title':
            properties[propertyName] = {
              title: [{ text: { content: String(value) } }],
            };
            break;
          case 'rich_text':
            properties[propertyName] = {
              rich_text: [{ text: { content: String(value) } }],
            };
            break;
          case 'select':
            properties[propertyName] = {
              select: { name: String(value) },
            };
            break;
          case 'status':
            properties[propertyName] = {
              status: { name: String(value) },
            };
            break;
          case 'multi_select':
            const tags = Array.isArray(value) ? value : [value];
            properties[propertyName] = {
              multi_select: tags.map(tag => ({ name: String(tag) })),
            };
            break;
          case 'number':
            properties[propertyName] = {
              number: Number(value),
            };
            break;
          case 'checkbox':
            properties[propertyName] = {
              checkbox: Boolean(value),
            };
            break;
          case 'url':
            properties[propertyName] = {
              url: String(value),
            };
            break;
          case 'email':
            properties[propertyName] = {
              email: String(value),
            };
            break;
          case 'phone_number':
            properties[propertyName] = {
              phone_number: String(value),
            };
            break;
          default:
            console.warn(`Unsupported property type: ${(propConfig as any).type} for property: ${propertyName}`);
        }
      }

      // Only proceed if we have properties to update
      if (Object.keys(properties).length === 0) {
        console.warn(`No valid properties found for update on page ${pageId}. Available properties:`, Object.keys(existingProperties));
        return this.pageToDatabasePage(currentPage, config);
      }

      console.log(`Updating page ${pageId} with properties:`, Object.keys(properties));

      const response = await this.notion.pages.update({
        page_id: pageId,
        properties,
      });

      return await this.pageToDatabasePage(response, config);
    } catch (error) {
      throw new Error(`Failed to update page ${pageId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Test the connection to Notion and verify database access
   */
  async testConnection(databaseId: string): Promise<{connected: boolean, databaseName?: string, error?: string}> {
    try {
      const database = await this.notion.databases.retrieve({ database_id: databaseId });
      const databaseName = (database as any).title?.[0]?.plain_text || 'Unknown Database Name';
      
      return {
        connected: true,
        databaseName: databaseName
      };
    } catch (error) {
      console.error(`Notion connection test failed for database ${databaseId}:`, error);
      return {
        connected: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Get database schema information
   */
  async getDatabaseSchema(databaseId: string): Promise<any> {
    try {
      const database = await this.notion.databases.retrieve({ database_id: databaseId });
      return {
        id: database.id,
        title: (database as any).title?.[0]?.plain_text || 'Unknown',
        properties: Object.keys((database as any).properties || {}),
        propertyDetails: (database as any).properties
      };
    } catch (error) {
      throw new Error(`Failed to get database schema for ${databaseId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Auto-detect database property mappings
   */
  async detectPropertyMappings(databaseId: string): Promise<DatabaseConfig['propertyMappings']> {
    try {
      const schema = await this.getDatabaseSchema(databaseId);
      const properties = schema.propertyDetails || {};
      
      const mappings: DatabaseConfig['propertyMappings'] = {
        title: 'Name' // Default fallback
      };

      // Look for title property
      for (const [propName, propConfig] of Object.entries(properties)) {
        const config = propConfig as any;
        if (config.type === 'title') {
          mappings.title = propName;
          break;
        }
      }

      // Look for common content properties
      const contentProperties = ['Content', 'Description', 'Direct LLM', 'Details', 'Notes'];
      for (const contentProp of contentProperties) {
        if (properties[contentProp] && (properties as any)[contentProp]?.type === 'rich_text') {
          mappings.content = contentProp;
          break;
        }
      }

      // Look for status property
      const statusProperties = ['Status', 'State', 'Progress'];
      for (const statusProp of statusProperties) {
        if (properties[statusProp] && 
            ((properties as any)[statusProp]?.type === 'status' || (properties as any)[statusProp]?.type === 'select')) {
          mappings.status = statusProp;
          break;
        }
      }

      // Look for tags property
      const tagProperties = ['Tags', 'Categories', 'Labels'];
      for (const tagProp of tagProperties) {
        if (properties[tagProp] && (properties as any)[tagProp]?.type === 'multi_select') {
          mappings.tags = tagProp;
          break;
        }
      }

      return mappings;
    } catch (error) {
      throw new Error(`Failed to detect property mappings for database ${databaseId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

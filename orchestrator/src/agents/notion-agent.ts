import "dotenv/config";
import type { NotionIdea, UpdateIdeaPayload } from "../notion-client.js";

const BASE_URL = (): string => process.env.NOTION_API_URL ?? "http://localhost:3001";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL()}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status} from ${url}: ${body}`);
  }
  return res.json() as Promise<T>;
}

/**
 * NotionAgent — general-purpose Notion API capability layer.
 *
 * Provides all read/write/search operations the system needs against Notion.
 * This is Layer 1 in the architecture: a Facade over the notion-idea-server HTTP API.
 * 
 * TODO: utilize notion mcp server to make sure return output is valid json
 */

export class NotionAgent {
  /** Fetch a single idea page by Notion page ID */
  async getIdea(id: string): Promise<NotionIdea> {
    return request<NotionIdea>(`/api/ideas/${id}`);
  }

  /** Fetch all ideas whose status is "Not Started" */
  async getAllUnprocessed(): Promise<NotionIdea[]> {
    return request<NotionIdea[]>("/api/ideas?status=Not%20Started");
  }

  /** Fetch all ideas, optionally filtered by status */
  async getIdeas(filter?: { status?: NotionIdea["status"] }): Promise<NotionIdea[]> {
    const params = filter?.status
      ? `?status=${encodeURIComponent(filter.status)}`
      : "";
    return request<NotionIdea[]>(`/api/ideas${params}`);
  }

  /** Full-text search across idea titles and content */
  async searchIdeas(query: string): Promise<NotionIdea[]> {
    return request<NotionIdea[]>("/api/ideas/search", {
      method: "POST",
      body: JSON.stringify({ query }),
    });
  }

  /** Fetch the raw content blocks of an idea page */
  async getIdeaContent(id: string): Promise<string> {
    const data = await request<{ content: string }>(`/api/ideas/${id}/content`);
    return data.content ?? "";
  }

  /** Write tags, status, howManyIdeas, or any combination back to Notion */
  async updateIdea(id: string, patch: UpdateIdeaPayload): Promise<void> {
    await request(`/api/ideas/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    });
  }

  /**
   * Create a new page in any database.
   * Auto-detects the title property name from the database schema.
   */
  async createPage(
    databaseId: string,
    title: string,
    content: string,
    tags: string[]
  ): Promise<{ id: string; url: string }> {
    // Fetch schema to find the title property name
    const schemaRes = await request<{ success: boolean; data: { propertyDetails: Record<string, { type: string }> } }>(
      `/api/databases/${databaseId}/schema`
    );
    const titleProp = Object.entries(schemaRes.data.propertyDetails).find(
      ([, v]) => v.type === "title"
    );
    if (!titleProp) {
      throw new Error(`No title property found in database ${databaseId}`);
    }
    const titlePropertyName = titleProp[0];

    const properties: Record<string, unknown> = {
      [titlePropertyName]: {
        title: [{ text: { content: title } }],
      },
    };

    // Add tags if the database has a Tags multi_select property
    const tagsProp = Object.entries(schemaRes.data.propertyDetails).find(
      ([name, v]) => v.type === "multi_select" && name.toLowerCase() === "tags"
    );
    if (tagsProp && tags.length > 0) {
      properties[tagsProp[0]] = {
        multi_select: tags.map((t) => ({ name: t })),
      };
    }

    return request<{ id: string; url: string }>(`/api/databases/${databaseId}/pages`, {
      method: "POST",
      body: JSON.stringify({ properties, content }),
    });
  }
}

import "dotenv/config";
import type { NotionIdea, ProjectPage, UpdateIdeaPayload } from "../notion-client.js";

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
  const json = await res.json() as any;
  // Unwrap { success, data } envelope from notion-idea-server responses
  return (json?.data !== undefined ? json.data : json) as T;
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

  /** Fetch all ideas whose status is "Not started" */
  async getAllUnprocessed(): Promise<NotionIdea[]> {
    return request<NotionIdea[]>("/api/ideas?status=Not%20started");
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
   * Fetch the available tag names from a database's Tags multi_select property.
   * Returns an empty array if the database has no Tags property.
   */
  async getTagOptions(databaseId: string): Promise<string[]> {
    const schemaRes = await request<{ propertyDetails: Record<string, any> }>(
      `/api/databases/${databaseId}/schema`
    );
    const tagsEntry = Object.entries(schemaRes.propertyDetails).find(
      ([name, v]) => v.type === "multi_select" && name.toLowerCase() === "tags"
    );
    if (!tagsEntry) return [];
    return (tagsEntry[1].multi_select?.options ?? []).map((o: any) => o.name as string);
  }

  /**
   * Create a new page in any database.
   * Auto-detects title, tags, and status property names from the database schema.
   * Filters tags to only those that exist in the database's multi_select options.
   */
  async createPage(
    databaseId: string,
    shortTitle: string,
    description: string,
    originalText: string,
    suggestedTags: string[]
  ): Promise<{ id: string; url: string }> {
    // Fetch schema (request auto-unwraps { success, data })
    const schemaRes = await request<{ propertyDetails: Record<string, any> }>(
      `/api/databases/${databaseId}/schema`
    );
    const details = schemaRes.propertyDetails;

    // Find title property
    const titleEntry = Object.entries(details).find(([, v]) => v.type === "title");
    if (!titleEntry) throw new Error(`No title property found in database ${databaseId}`);

    const properties: Record<string, unknown> = {
      [titleEntry[0]]: {
        title: [{ text: { content: shortTitle } }],
      },
    };

    // Find tags property and filter to only allowed options in this database
    const tagsEntry = Object.entries(details).find(
      ([name, v]) => v.type === "multi_select" && name.toLowerCase() === "tags"
    );
    if (tagsEntry && suggestedTags.length > 0) {
      const allowedOptions: string[] = (tagsEntry[1].multi_select?.options ?? []).map((o: any) => o.name as string);
      const validTags = suggestedTags.filter((t) => allowedOptions.includes(t));
      if (validTags.length > 0) {
        properties[tagsEntry[0]] = {
          multi_select: validTags.map((t) => ({ name: t })),
        };
      }
    }

    // Find status property and set to first available "not started" option
    const statusEntry = Object.entries(details).find(
      ([, v]) => v.type === "status" || v.type === "select"
    );
    if (statusEntry) {
      const options: string[] = (statusEntry[1].status?.options ?? statusEntry[1].select?.options ?? []).map((o: any) => o.name as string);
      const defaultStatus = options.find((o) =>
        ["not started", "to-do", "todo", "to do", "backlog"].includes(o.toLowerCase())
      ) ?? options[0];
      if (defaultStatus) {
        properties[statusEntry[0]] = statusEntry[1].type === "status"
          ? { status: { name: defaultStatus } }
          : { select: { name: defaultStatus } };
      }
    }

    // Build content: description first, then original blurb
    const content = `${description}\n\n---\n\nOriginal idea:\n${originalText}`;

    return request<{ id: string; url: string }>(`/api/databases/${databaseId}/pages`, {
      method: "POST",
      body: JSON.stringify({ properties, content }),
    });
  }

  // ─── Project database methods ──────────────────────────────────────────────
  // These operate on NOTION_PROJECTS_DATABASE_ID via the generic database endpoints.

  /** Fetch all project pages with status "Ready for Planning" */
  async getReadyForPlanningProjects(): Promise<ProjectPage[]> {
    const dbId = process.env.NOTION_PROJECTS_DATABASE_ID;
    if (!dbId) throw new Error("NOTION_PROJECTS_DATABASE_ID is not set");
    return request<ProjectPage[]>(
      `/api/databases/${dbId}/pages?status=Ready%20for%20Planning`
    );
  }

  /** Fetch a single project page by page ID */
  async getProjectPage(pageId: string): Promise<ProjectPage> {
    const dbId = process.env.NOTION_PROJECTS_DATABASE_ID;
    if (!dbId) throw new Error("NOTION_PROJECTS_DATABASE_ID is not set");
    return request<ProjectPage>(`/api/databases/${dbId}/pages/${pageId}`);
  }

  /** Update a project page — supports content and/or status */
  async updateProjectPage(
    pageId: string,
    patch: { content?: string; status?: string }
  ): Promise<void> {
    const dbId = process.env.NOTION_PROJECTS_DATABASE_ID;
    if (!dbId) throw new Error("NOTION_PROJECTS_DATABASE_ID is not set");
    await request(`/api/databases/${dbId}/pages/${pageId}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    });
  }
}

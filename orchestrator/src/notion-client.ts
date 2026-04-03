import "dotenv/config";

const BASE_URL = process.env.NOTION_API_URL ?? "http://localhost:3001";

export interface NotionIdea {
  id: string;
  title: string;
  status: "Not started" | "In progress" | "Done" | "Needs Review";
  tags: string[];
  howManyIdeas: number;
  content: string;
}

/** A page from the projects (or other destination) database, returned by the generic endpoint */
export interface ProjectPage {
  id: string;
  title: string;
  content: string;
  properties: Record<string, unknown>;
  url: string;
}

export interface UpdateIdeaPayload {
  tags?: string[];
  howManyIdeas?: number;
  status?: NotionIdea["status"];
  content?: string;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data: T }> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status} from ${url}: ${body}`);
  }
  return res.json() as Promise<{ success: boolean; data: T }>;
}

export async function getIdea(id: string): Promise<NotionIdea> {
  const res = await request<NotionIdea>(`/api/ideas/${id}`);
  return res.data;
}

export async function getAllUnprocessedIdeas(): Promise<NotionIdea[]> {
  const res = await request<NotionIdea[]>("/api/ideas?status=Not%20started");
  return res.data;
}

export async function updateIdea(
  id: string,
  payload: UpdateIdeaPayload
): Promise<void> {
  await request(`/api/ideas/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

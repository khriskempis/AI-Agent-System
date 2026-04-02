import "dotenv/config";

const BASE_URL = process.env.NOTION_API_URL ?? "http://localhost:3001";

export interface NotionIdea {
  id: string;
  name: string;
  status: "Not Started" | "In Progress" | "Done" | "Needs Review";
  tags: string[];
  howManyIdeas: number;
  content: string;
}

export interface UpdateIdeaPayload {
  tags?: string[];
  howManyIdeas?: number;
  status?: NotionIdea["status"];
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${BASE_URL}${path}`;
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

export async function getIdea(id: string): Promise<NotionIdea> {
  return request<NotionIdea>(`/api/ideas/${id}`);
}

export async function getAllUnprocessedIdeas(): Promise<NotionIdea[]> {
  return request<NotionIdea[]>("/api/ideas?status=Not%20Started");
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

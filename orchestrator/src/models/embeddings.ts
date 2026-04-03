/**
 * Embedding model wrapper — Ollama
 *
 * Calls POST /api/embeddings on the local Ollama instance and returns
 * a float32 vector. Mirrors the pattern of ollama.ts and claude.ts —
 * just a thin typed HTTP wrapper, no business logic.
 *
 * Model: mxbai-embed-large (670MB, 1024 dimensions, English-optimized)
 * Pull with: docker exec ollama ollama pull mxbai-embed-large
 */

const BASE_URL = (): string =>
  process.env.OLLAMA_URL ?? "http://localhost:11434";

export const EMBEDDING_MODEL = "mxbai-embed-large";
export const EMBEDDING_DIMENSIONS = 1024;

interface OllamaEmbeddingResponse {
  embedding: number[];
}

/**
 * Generate a 1024-dimension embedding vector for the given text.
 * The vector numerically encodes semantic meaning — similar texts produce
 * vectors close together in space, enabling similarity search in Qdrant.
 */
export async function embed(text: string): Promise<number[]> {
  const res = await fetch(`${BASE_URL()}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      prompt: text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ollama embeddings HTTP ${res.status}: ${body}`);
  }

  const data = (await res.json()) as OllamaEmbeddingResponse;
  return data.embedding;
}

/**
 * Build the canonical embedding text for a piece of content.
 * Concatenating caption + summary + insights gives a richer semantic
 * representation than embedding any single field alone.
 */
export function buildEmbedText(parts: {
  title?: string | null;
  summary?: string | null;
  insights?: string[];
}): string {
  const chunks: string[] = [];
  if (parts.title)   chunks.push(parts.title);
  if (parts.summary) chunks.push(parts.summary);
  if (parts.insights?.length) chunks.push(parts.insights.join(". "));
  return chunks.join(" | ");
}

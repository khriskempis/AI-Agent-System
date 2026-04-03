/**
 * Qdrant Client — Layer 1
 *
 * All reads and writes to the Qdrant vector database.
 * Uses Qdrant's REST API directly — no extra npm package required.
 * Mirrors the pattern of notion-client.ts and tiktok-client.ts.
 *
 * Collection: "knowledge"
 * A single source-agnostic collection holds all content types:
 * TikTok transcripts, articles, Notion pages, notes — anything.
 * The `source_type` payload field distinguishes them at query time.
 *
 * Vector dimensions: 1024 (mxbai-embed-large)
 */

import { EMBEDDING_DIMENSIONS } from "./models/embeddings.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Source types stored in the knowledge collection */
export type SourceType = "tiktok" | "article" | "notion" | "note";

/**
 * Metadata stored alongside each vector in Qdrant.
 * Returned with search results so callers have full context without
 * needing a second DB lookup.
 */
export interface KnowledgePayload {
  source_type:   SourceType;
  source_id:     string;          // video_id, notion_page_id, URL, etc.
  title:         string | null;   // caption, article title, page title
  summary:       string;
  content_type:  string | null;   // blog | social | reference
  source_url:    string | null;   // tiktok_url, article URL, etc.
  embedded_at:   string;          // ISO timestamp
}

export interface SearchResult {
  id:      string | number;
  score:   number;               // cosine similarity 0-1, higher = more similar
  payload: KnowledgePayload;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const COLLECTION = "knowledge";

const BASE_URL = (): string =>
  process.env.QDRANT_URL ?? "http://localhost:6333";

async function qdrant<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`${BASE_URL()}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Qdrant ${method} ${path} → HTTP ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Collection management
// ---------------------------------------------------------------------------

/**
 * Create the knowledge collection if it doesn't exist.
 * Safe to call on every startup — Qdrant ignores it if already present.
 */
export async function ensureCollection(): Promise<void> {
  // Check if it already exists
  const res = await fetch(`${BASE_URL()}/collections/${COLLECTION}`);
  if (res.ok) return;

  await qdrant("PUT", `/collections/${COLLECTION}`, {
    vectors: {
      size:     EMBEDDING_DIMENSIONS,
      distance: "Cosine",   // cosine similarity is standard for text embeddings
    },
  });
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * Upsert a single point into the knowledge collection.
 *
 * Uses the source_id as the point ID (hashed to a uint64) so re-running
 * the embedding pipeline on the same content is idempotent — it overwrites
 * the existing vector rather than creating a duplicate.
 */
export async function upsertPoint(
  sourceId: string,
  vector: number[],
  payload: KnowledgePayload
): Promise<void> {
  // Qdrant point IDs must be unsigned integers or UUIDs.
  // We derive a stable numeric ID from the source_id string.
  const pointId = stableId(sourceId);

  await qdrant("PUT", `/collections/${COLLECTION}/points`, {
    points: [{ id: pointId, vector, payload }],
  });
}

/**
 * Upsert multiple points in one HTTP call — much faster for batch imports.
 * Qdrant recommends batches of 100-500 for optimal throughput.
 */
export async function upsertBatch(
  points: Array<{
    sourceId: string;
    vector:   number[];
    payload:  KnowledgePayload;
  }>
): Promise<void> {
  await qdrant("PUT", `/collections/${COLLECTION}/points`, {
    points: points.map((p) => ({
      id:      stableId(p.sourceId),
      vector:  p.vector,
      payload: p.payload,
    })),
  });
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Search for the most semantically similar content to a given vector.
 *
 * @param vector     - embedding of the query text
 * @param limit      - number of results to return (default 5)
 * @param sourceType - optional filter to a specific source type
 */
export async function search(
  vector: number[],
  limit: number = 5,
  sourceType?: SourceType
): Promise<SearchResult[]> {
  const body: Record<string, unknown> = {
    vector,
    limit,
    with_payload: true,
  };

  if (sourceType) {
    body.filter = {
      must: [{ key: "source_type", match: { value: sourceType } }],
    };
  }

  const res = await qdrant<{ result: Array<{ id: number; score: number; payload: KnowledgePayload }> }>(
    "POST",
    `/collections/${COLLECTION}/points/search`,
    body
  );

  return res.result.map((r) => ({
    id:      r.id,
    score:   r.score,
    payload: r.payload,
  }));
}

/**
 * Check whether a source_id has already been embedded.
 * Used by the embedding pipeline to skip already-indexed content.
 */
export async function isIndexed(sourceId: string): Promise<boolean> {
  const pointId = stableId(sourceId);
  const res = await fetch(
    `${BASE_URL()}/collections/${COLLECTION}/points/${pointId}`
  );
  return res.ok;
}

/**
 * Return the total number of vectors in the collection.
 */
export async function collectionStats(): Promise<{ count: number }> {
  const res = await qdrant<{ result: { points_count: number } }>(
    "GET",
    `/collections/${COLLECTION}`
  );
  return { count: res.result.points_count };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derive a stable uint53 integer from a string.
 * Uses a simple FNV-1a hash — stable across runs, no external deps.
 * uint53 stays within JS safe integer range and Qdrant's uint64 limit.
 */
function stableId(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (Math.imul(hash, 16777619) >>> 0);
  }
  // Combine with a second pass to reduce collisions for short IDs like video_ids
  let hash2 = 0x811c9dc5;
  for (let i = input.length - 1; i >= 0; i--) {
    hash2 ^= input.charCodeAt(i);
    hash2 = (Math.imul(hash2, 16777619) >>> 0);
  }
  // Combine into a single number within JS safe integer range
  return (hash * 0x100000 + (hash2 & 0xfffff)) % Number.MAX_SAFE_INTEGER;
}

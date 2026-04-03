/**
 * embed-tiktok pipeline
 *
 * Reads analyzed TikTok videos from MySQL, generates embeddings via
 * mxbai-embed-large (Ollama), and upserts them into Qdrant's knowledge
 * collection. Safe to re-run — already-indexed videos are skipped.
 *
 * Usage:
 *   npx tsx src/index.ts embed-tiktok              # embed all unindexed analyzed videos
 *   npx tsx src/index.ts embed-tiktok --limit 200  # embed a batch of 200
 *   npx tsx src/index.ts embed-tiktok --reindex    # force re-embed everything (overwrites)
 */

import mysql from "mysql2/promise";
import { logger } from "../logger.js";
import { embed, buildEmbedText } from "../models/embeddings.js";
import {
  ensureCollection,
  upsertBatch,
  isIndexed,
  collectionStats,
  type KnowledgePayload,
} from "../qdrant-client.js";

const BATCH_SIZE = 100; // vectors per Qdrant upsert call

// ---------------------------------------------------------------------------
// MySQL — read analyzed videos
// ---------------------------------------------------------------------------

interface AnalyzedVideo {
  videoId:     string;
  caption:     string | null;
  tiktokUrl:   string | null;
  summary:     string;
  contentType: string | null;
  transcript:  string; // JSON blob: { transcript, keyInsights, contentOpportunities, suggestedNextSteps }
}

async function getAnalyzedVideos(limit: number): Promise<AnalyzedVideo[]> {
  const pool = mysql.createPool({
    host:     process.env.MYSQL_HOST     ?? "127.0.0.1",
    port:     Number(process.env.MYSQL_PORT ?? 3306),
    user:     process.env.MYSQL_USER     ?? "orchestrator",
    password: process.env.MYSQL_PASSWORD ?? "orchestrator",
    database: "tiktok",
    connectionLimit: 3,
    timezone: "Z",
  });

  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT v.video_id, v.caption, v.tiktok_url,
            a.summary, a.content_type, a.transcript
     FROM tiktok_videos v
     JOIN tiktok_analysis a ON a.video_id = v.video_id
     WHERE a.analysis_status = 'done'
       AND a.summary IS NOT NULL
     ORDER BY v.is_bookmarked DESC, v.digg_count DESC
     LIMIT ?`,
    [limit]
  );

  await pool.end();

  return rows.map((r) => ({
    videoId:     r.video_id,
    caption:     r.caption,
    tiktokUrl:   r.tiktok_url,
    summary:     r.summary,
    contentType: r.content_type,
    transcript:  r.transcript ?? "{}",
  }));
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export interface EmbedTiktokOptions {
  limit?:   number;
  reindex?: boolean;
}

export async function runTiktokEmbedding(options: EmbedTiktokOptions = {}): Promise<void> {
  const limit = options.limit ?? 10_000;

  logger.info("Ensuring Qdrant knowledge collection exists...");
  await ensureCollection();
  const before = await collectionStats();
  logger.info(`Collection currently has ${before.count.toLocaleString()} vectors`);

  logger.info(`\nFetching up to ${limit.toLocaleString()} analyzed videos from MySQL...`);
  const videos = await getAnalyzedVideos(limit);
  logger.info(`Found ${videos.length.toLocaleString()} analyzed videos`);

  if (videos.length === 0) {
    logger.warn("No analyzed videos to embed — run analyze-tiktok first");
    return;
  }

  // Filter out already-indexed unless --reindex
  let toEmbed = videos;
  if (!options.reindex) {
    logger.info("Checking which videos are already indexed...");
    const checks = await Promise.all(
      videos.map(async (v) => ({
        video: v,
        indexed: await isIndexed(`tiktok:${v.videoId}`),
      }))
    );
    toEmbed = checks.filter((c) => !c.indexed).map((c) => c.video);
    logger.info(
      `  ${videos.length - toEmbed.length} already indexed — embedding ${toEmbed.length} new`
    );
  }

  if (toEmbed.length === 0) {
    logger.success("All analyzed videos are already indexed in Qdrant");
    return;
  }

  // Process in batches
  let embedded = 0;
  let failed = 0;

  for (let i = 0; i < toEmbed.length; i += BATCH_SIZE) {
    const batch = toEmbed.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(toEmbed.length / BATCH_SIZE);

    process.stdout.write(
      `\r  Embedding batch ${batchNum}/${totalBatches} (${embedded} done, ${failed} failed)...`
    );

    const points: Array<{ sourceId: string; vector: number[]; payload: KnowledgePayload }> = [];

    for (const video of batch) {
      try {
        // Parse the JSON transcript blob to get keyInsights
        let keyInsights: string[] = [];
        try {
          const parsed = JSON.parse(video.transcript);
          keyInsights = parsed.keyInsights ?? [];
        } catch {
          // transcript is raw text (old format) — use as-is
        }

        const embedText = buildEmbedText({
          title:    video.caption,
          summary:  video.summary,
          insights: keyInsights,
        });

        const vector = await embed(embedText);

        points.push({
          sourceId: `tiktok:${video.videoId}`,
          vector,
          payload: {
            source_type:  "tiktok",
            source_id:    video.videoId,
            title:        video.caption,
            summary:      video.summary,
            content_type: video.contentType,
            source_url:   video.tiktokUrl,
            embedded_at:  new Date().toISOString(),
          },
        });

        embedded++;
      } catch (err) {
        failed++;
        // Don't abort the batch — log and continue
        logger.warn(`\n  Failed to embed ${video.videoId}: ${String(err)}`);
      }
    }

    if (points.length > 0) {
      await upsertBatch(points);
    }
  }

  const after = await collectionStats();
  console.log(""); // newline after progress line
  logger.success(
    `Embedding complete — ${embedded} embedded, ${failed} failed`
  );
  logger.info(
    `Qdrant collection: ${before.count.toLocaleString()} → ${after.count.toLocaleString()} vectors`
  );
}

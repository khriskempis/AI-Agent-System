/**
 * TikTok DB Client — Layer 1
 *
 * Typed read/write access to the `tiktok` MySQL database.
 * Mirrors the pattern of notion-client.ts — no LLM calls, just data access.
 *
 * Uses the same MySQL host/user/password as the orchestrator DB but connects
 * to the `tiktok` database instead. The orchestrator MySQL user was granted
 * access to `tiktok.*` in scripts/tiktok/schema.sql.
 */

import mysql from "mysql2/promise";
import { logger } from "./logger.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TiktokVideo {
  videoId: string;
  authorId: string;
  caption: string | null;
  createTime: Date | null;
  tiktokUrl: string | null;
  localFilePath: string;
  isLiked: boolean;
  isBookmarked: boolean;
  queuedForAnalysis: boolean;
}

export interface QueueStats {
  queued: number;        // queued_for_analysis=1, not yet done
  done: number;          // queued_for_analysis=1, analysis done
  total: number;         // total videos in library
  withLocalFile: number; // videos with local MP4
}

export interface TiktokAnalysisRow {
  id: number;
  videoId: string;
  transcript: string | null;
  summary: string | null;
  contentType: "blog" | "social" | "reference" | null;
  analysisStatus: "pending" | "done";
}

export interface SaveAnalysisPayload {
  title: string;
  transcript: string;
  summary: string;
  contentType: "blog" | "social" | "reference" | null;
  suggestedNextSteps: string[];
  keyInsights: string[];
  contentOpportunities: string[];
}

// ---------------------------------------------------------------------------
// Connection pool
// ---------------------------------------------------------------------------

let pool: mysql.Pool | null = null;

function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host:     process.env.MYSQL_HOST     ?? "127.0.0.1",
      port:     Number(process.env.MYSQL_PORT ?? 3306),
      user:     process.env.MYSQL_USER     ?? "orchestrator",
      password: process.env.MYSQL_PASSWORD ?? "orchestrator",
      database: "tiktok",
      waitForConnections: true,
      connectionLimit: 5,
      timezone: "Z",
    });
    logger.info("[tiktok-db] Pool created for tiktok database");
  }
  return pool;
}

export async function closeTiktokDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Fetch videos that are queued for analysis and not yet done.
 * Only returns videos where queued_for_analysis=1 — the pipeline
 * only processes what you've explicitly selected.
 * --id bypasses this (see getVideoById) for one-off runs.
 */
export async function getPendingVideos(limit: number = 50): Promise<TiktokVideo[]> {
  const db = getPool();
  const [rows] = await db.query<mysql.RowDataPacket[]>(
    `SELECT v.video_id, v.author_id, v.caption, v.create_time,
            v.tiktok_url, v.local_file_path, v.is_liked, v.is_bookmarked,
            v.queued_for_analysis
     FROM tiktok_videos v
     LEFT JOIN tiktok_analysis a ON a.video_id = v.video_id AND a.analysis_status = 'done'
     WHERE v.has_local_file = 1
       AND v.queued_for_analysis = 1
       AND a.video_id IS NULL
     ORDER BY v.is_bookmarked DESC, v.digg_count DESC
     LIMIT ?`,
    [limit]
  );

  return rows.map(rowToVideo);
}

/**
 * Fetch a single video by ID. Returns null if not found.
 * Used by --id flag — bypasses the queue flag.
 */
export async function getVideoById(videoId: string): Promise<TiktokVideo | null> {
  const db = getPool();
  const [rows] = await db.query<mysql.RowDataPacket[]>(
    `SELECT video_id, author_id, caption, create_time,
            tiktok_url, local_file_path, is_liked, is_bookmarked, queued_for_analysis
     FROM tiktok_videos
     WHERE video_id = ?`,
    [videoId]
  );

  if (rows.length === 0) return null;
  return rowToVideo(rows[0]);
}

/**
 * Queue one or more videos for analysis by setting queued_for_analysis=1.
 * Returns the number of rows actually updated (0 if IDs not found).
 */
export async function queueVideos(videoIds: string[]): Promise<number> {
  if (videoIds.length === 0) return 0;
  const db = getPool();
  const placeholders = videoIds.map(() => "?").join(",");
  const [result] = await db.query<mysql.ResultSetHeader>(
    `UPDATE tiktok_videos SET queued_for_analysis = 1 WHERE video_id IN (${placeholders})`,
    videoIds
  );
  return result.affectedRows;
}

/**
 * Queue videos by filter criteria. Returns count of newly queued videos.
 */
export async function queueByFilter(filter: {
  bookmarked?: boolean;
  liked?: boolean;
  authorHandle?: string;
  minPlays?: number;
}): Promise<number> {
  const db = getPool();
  const conditions: string[] = ["v.has_local_file = 1", "v.queued_for_analysis = 0"];
  const params: unknown[] = [];

  if (filter.bookmarked) { conditions.push("v.is_bookmarked = 1"); }
  if (filter.liked)      { conditions.push("v.is_liked = 1"); }
  if (filter.minPlays)   { conditions.push("v.play_count >= ?"); params.push(filter.minPlays); }

  if (filter.authorHandle) {
    conditions.push("a.unique_id = ?");
    params.push(filter.authorHandle.replace(/^@/, "")); // strip leading @ if present
  }

  const join = filter.authorHandle
    ? "JOIN tiktok_authors a ON a.author_id = v.author_id"
    : "";

  const [result] = await db.query<mysql.ResultSetHeader>(
    `UPDATE tiktok_videos v
     ${join}
     SET v.queued_for_analysis = 1
     WHERE ${conditions.join(" AND ")}`,
    params
  );
  return result.affectedRows;
}

/**
 * List all queued videos that haven't been analyzed yet.
 * Used by the --list flag to show what's pending.
 */
export async function listQueued(limit: number = 100): Promise<TiktokVideo[]> {
  const db = getPool();
  const [rows] = await db.query<mysql.RowDataPacket[]>(
    `SELECT v.video_id, v.author_id, v.caption, v.create_time,
            v.tiktok_url, v.local_file_path, v.is_liked, v.is_bookmarked,
            v.queued_for_analysis
     FROM tiktok_videos v
     LEFT JOIN tiktok_analysis a ON a.video_id = v.video_id AND a.analysis_status = 'done'
     WHERE v.queued_for_analysis = 1
       AND a.video_id IS NULL
     ORDER BY v.is_bookmarked DESC, v.digg_count DESC
     LIMIT ?`,
    [limit]
  );
  return rows.map(rowToVideo);
}

/**
 * Summary counts for the queue and library.
 */
export async function getQueueStats(): Promise<QueueStats> {
  const db = getPool();
  const [[row]] = await db.query<mysql.RowDataPacket[]>(`
    SELECT
      SUM(v.queued_for_analysis = 1 AND (a.analysis_status IS NULL OR a.analysis_status != 'done')) AS queued,
      SUM(v.queued_for_analysis = 1 AND a.analysis_status = 'done')                                 AS done,
      COUNT(*)                                                                                        AS total,
      SUM(v.has_local_file = 1)                                                                      AS with_local_file
    FROM tiktok_videos v
    LEFT JOIN tiktok_analysis a ON a.video_id = v.video_id
  `);
  return {
    queued:        Number(row.queued ?? 0),
    done:          Number(row.done ?? 0),
    total:         Number(row.total ?? 0),
    withLocalFile: Number(row.with_local_file ?? 0),
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function rowToVideo(r: mysql.RowDataPacket): TiktokVideo {
  return {
    videoId:           r.video_id,
    authorId:          r.author_id,
    caption:           r.caption,
    createTime:        r.create_time,
    tiktokUrl:         r.tiktok_url,
    localFilePath:     r.local_file_path,
    isLiked:           Boolean(r.is_liked),
    isBookmarked:      Boolean(r.is_bookmarked),
    queuedForAnalysis: Boolean(r.queued_for_analysis),
  };
}

/**
 * Look up an existing transcript for a video. Returns null if none exists.
 * Used by the ResearchAgent when given a TikTok URL to avoid re-transcribing.
 */
export async function getTranscriptForVideo(videoId: string): Promise<string | null> {
  const db = getPool();
  const [rows] = await db.query<mysql.RowDataPacket[]>(
    `SELECT transcript FROM tiktok_analysis
     WHERE video_id = ? AND transcript IS NOT NULL
     ORDER BY created_at DESC LIMIT 1`,
    [videoId]
  );
  return rows.length > 0 ? rows[0].transcript : null;
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * Insert a completed analysis row. The full ResearchOutput is stored as
 * separate columns (summary, content_type) plus JSON extras in the transcript
 * field to keep the schema simple.
 */
export async function saveAnalysis(
  videoId: string,
  payload: SaveAnalysisPayload
): Promise<void> {
  const db = getPool();

  // Pack the richer fields (insights, opportunities, next steps) into the
  // transcript column as a structured header above the raw transcript text.
  // This keeps the schema stable without adding columns for every new field.
  const fullTranscript = JSON.stringify({
    title:               payload.title,
    transcript:          payload.transcript,
    keyInsights:         payload.keyInsights,
    contentOpportunities: payload.contentOpportunities,
    suggestedNextSteps:  payload.suggestedNextSteps,
  });

  await db.query(
    `INSERT INTO tiktok_analysis (video_id, transcript, summary, content_type, analysis_status)
     VALUES (?, ?, ?, ?, 'done')
     ON DUPLICATE KEY UPDATE
       transcript      = VALUES(transcript),
       summary         = VALUES(summary),
       content_type    = VALUES(content_type),
       analysis_status = 'done',
       updated_at      = NOW()`,
    [videoId, fullTranscript, payload.summary, payload.contentType]
  );
}

/**
 * Record a failed analysis attempt so it can be retried or skipped later.
 * Does not flip analysis_status to 'done' — leaves it as 'pending' so the
 * next batch run will pick it up again.
 */
export async function recordFailure(videoId: string, errorMessage: string): Promise<void> {
  const db = getPool();
  // Log the error as a summary-only row so we have a record of what failed.
  await db.query(
    `INSERT INTO tiktok_analysis (video_id, summary, analysis_status)
     VALUES (?, ?, 'pending')
     ON DUPLICATE KEY UPDATE
       summary    = VALUES(summary),
       updated_at = NOW()`,
    [videoId, `ERROR: ${errorMessage}`]
  );
}

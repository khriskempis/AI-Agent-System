/**
 * analyze-tiktok pipeline — Layer 2
 *
 * Processes TikTok videos through four stages:
 *   FETCH      → load video metadata from tiktok DB
 *   TRANSCRIBE → send local MP4 to whisper-service, get back text
 *   ANALYZE    → pass transcript to ResearchAgent (Claude Sonnet)
 *   WRITE      → save results to tiktok_analysis, mark done
 *
 * Triggered via CLI:
 *   npx tsx src/index.ts analyze-tiktok --id <video_id>
 *   npx tsx src/index.ts analyze-tiktok --limit 50
 *   npx tsx src/index.ts analyze-tiktok --all
 */

import { logger } from "../logger.js";
import { withRetry } from "../workflow.js";
import {
  getPendingVideos,
  getVideoById,
  saveAnalysis,
  recordFailure,
  type TiktokVideo,
} from "../tiktok-client.js";
import { research } from "../agents/research-agent.js";

// ---------------------------------------------------------------------------
// Whisper service client
// ---------------------------------------------------------------------------

const WHISPER_URL = (): string =>
  process.env.WHISPER_URL ?? "http://localhost:9000";

interface WhisperResponse {
  transcript: string;
  language: string;
}

/**
 * Translate a WSL host path to the path as mounted inside the whisper container.
 *
 * The whisper service mounts:
 *   /mnt/m/TT videos/data  →  /tiktok-videos
 *
 * This translation is needed because local_file_path in the DB is the WSL path,
 * but the whisper container sees the files at the mounted path.
 */
function toContainerPath(localFilePath: string): string {
  const hostBase = process.env.TIKTOK_VIDEOS_PATH ?? "/mnt/m/TT videos/data";
  const containerBase = "/tiktok-videos";
  return localFilePath.replace(hostBase, containerBase);
}

async function transcribe(localFilePath: string): Promise<WhisperResponse> {
  const containerPath = toContainerPath(localFilePath);

  const res = await fetch(`${WHISPER_URL()}/transcribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_path: containerPath }),
    signal: AbortSignal.timeout(120_000), // transcription can take up to 2 min for long videos
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Whisper HTTP ${res.status}: ${body}`);
  }

  return res.json() as Promise<WhisperResponse>;
}

// ---------------------------------------------------------------------------
// Single video pipeline
// ---------------------------------------------------------------------------

export async function analyzeTiktokVideo(videoId: string): Promise<void> {
  // ── STAGE 1: FETCH ──────────────────────────────────────────────────────
  logger.stage("FETCH", `Loading video ${videoId} from tiktok DB`);

  const video = await withRetry(() => getVideoById(videoId), { label: "FETCH" });

  if (!video) {
    logger.warn(`Video ${videoId} not found in database — skipping`);
    return;
  }

  if (!video.localFilePath) {
    logger.warn(`Video ${videoId} has no local file path — skipping`);
    return;
  }

  logger.success(`Loaded: ${video.caption?.slice(0, 80) ?? "(no caption)"}`);

  // ── STAGE 2: TRANSCRIBE ─────────────────────────────────────────────────
  logger.stage("TRANSCRIBE", `Sending to whisper-service: ${video.localFilePath}`);

  let whisperResult: WhisperResponse;
  try {
    whisperResult = await withRetry(() => transcribe(video.localFilePath), {
      label: "TRANSCRIBE",
      maxAttempts: 2,
      backoffMs: 2000,
    });
  } catch (err) {
    logger.error(`Transcription failed for ${videoId}: ${String(err)}`);
    await recordFailure(videoId, `Transcription failed: ${String(err)}`);
    return;
  }

  logger.success(`Transcribed (${whisperResult.language}) — ${whisperResult.transcript.length} chars`);

  // ── STAGE 3: ANALYZE ────────────────────────────────────────────────────
  logger.stage("ANALYZE", `Running ResearchAgent on transcript`);

  const researchResult = await withRetry(
    () =>
      research({
        type: "text",
        content: whisperResult.transcript,
        context: "Evaluate this TikTok video for content repurposing opportunities",
        metadata: {
          caption:    video.caption ?? undefined,
          sourceType: "tiktok",
          tiktokUrl:  video.tiktokUrl ?? undefined,
        },
      }),
    { label: "ANALYZE", maxAttempts: 3 } // cap — each attempt hits Claude Sonnet
  );

  logger.success(`Analysis complete — confidence: ${researchResult.confidence}`);
  logger.info(`  Content type: ${researchResult.suggestedContentType ?? "none"}`);
  logger.info(`  Insights: ${researchResult.keyInsights.length}`);

  // ── STAGE 4: WRITE ──────────────────────────────────────────────────────
  logger.stage("WRITE", `Saving analysis for video ${videoId}`);

  await saveAnalysis(videoId, {
    title:                researchResult.title,
    transcript:           whisperResult.transcript,
    summary:              researchResult.summary,
    contentType:          researchResult.suggestedContentType,
    keyInsights:          researchResult.keyInsights,
    contentOpportunities: researchResult.contentOpportunities,
    suggestedNextSteps:   researchResult.suggestedNextSteps,
  });

  logger.success(`Saved — video ${videoId} marked done`);
}

// ---------------------------------------------------------------------------
// Batch runner
// ---------------------------------------------------------------------------

export interface AnalyzeTiktokOptions {
  id?: string;
  limit?: number;
  all?: boolean;
}

export async function runTiktokAnalysis(options: AnalyzeTiktokOptions): Promise<void> {
  if (options.id) {
    await analyzeTiktokVideo(options.id);
    return;
  }

  const limit = options.all ? 10_000 : (options.limit ?? 50);

  logger.info(`Fetching up to ${limit} pending videos (bookmarked first)...`);
  const videos: TiktokVideo[] = await getPendingVideos(limit);
  logger.info(`Found ${videos.length} video(s) to process\n`);

  let done = 0;
  let failed = 0;

  for (const video of videos) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`[${done + failed + 1}/${videos.length}] ${video.videoId}`);
    console.log("=".repeat(60));

    try {
      await analyzeTiktokVideo(video.videoId);
      done++;
    } catch (err) {
      logger.error(`Pipeline error for ${video.videoId}: ${String(err)}`);
      await recordFailure(video.videoId, String(err));
      failed++;
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  logger.info(`Batch complete — ${done} done, ${failed} failed out of ${videos.length}`);
}

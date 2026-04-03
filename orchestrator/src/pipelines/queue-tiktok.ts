/**
 * queue-tiktok pipeline
 *
 * Controls which TikTok videos get analyzed. Sets queued_for_analysis=1
 * on selected videos. The analyze-tiktok pipeline only processes queued videos.
 *
 * Usage:
 *   # Single video
 *   npx tsx src/index.ts queue-tiktok --id 7459779252146228497
 *
 *   # Multiple IDs, comma-separated
 *   npx tsx src/index.ts queue-tiktok --ids 7459779252146228497,7374814047495081248
 *
 *   # From a saved queue file (one video ID per line)
 *   npx tsx src/index.ts queue-tiktok --file scripts/tiktok/queues/my-list.txt
 *
 *   # By criteria — filter your whole library
 *   npx tsx src/index.ts queue-tiktok --bookmarked
 *   npx tsx src/index.ts queue-tiktok --liked
 *   npx tsx src/index.ts queue-tiktok --author raybrands
 *   npx tsx src/index.ts queue-tiktok --min-plays 1000000
 *
 *   # See what's currently queued (not yet analyzed)
 *   npx tsx src/index.ts queue-tiktok --list
 *
 *   # Overall queue stats
 *   npx tsx src/index.ts queue-tiktok --stats
 */

import * as fs from "fs";
import * as path from "path";
import { logger } from "../logger.js";
import {
  queueVideos,
  queueByFilter,
  listQueued,
  getQueueStats,
} from "../tiktok-client.js";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface QueueTiktokOptions {
  id?:        string;    // single video ID
  ids?:       string;    // comma-separated video IDs
  file?:      string;    // path to a .txt file with one ID per line
  bookmarked?: boolean;
  liked?:     boolean;
  author?:    string;    // @handle (@ is optional)
  minPlays?:  number;
  list?:      boolean;   // show queued videos, don't add anything
  stats?:     boolean;   // show counts only
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function runQueueTiktok(options: QueueTiktokOptions): Promise<void> {

  // ── --stats ───────────────────────────────────────────────────────────────
  if (options.stats) {
    const s = await getQueueStats();
    console.log("\nQueue stats:");
    console.log(`  Queued (not yet analyzed): ${s.queued.toLocaleString()}`);
    console.log(`  Already analyzed:          ${s.done.toLocaleString()}`);
    console.log(`  Total videos in library:   ${s.total.toLocaleString()}`);
    console.log(`  Videos with local MP4:     ${s.withLocalFile.toLocaleString()}`);
    return;
  }

  // ── --list ────────────────────────────────────────────────────────────────
  if (options.list) {
    const videos = await listQueued(200);
    if (videos.length === 0) {
      logger.warn("No videos currently queued for analysis.");
      logger.info("Use queue-tiktok --id / --ids / --file / --bookmarked to add some.");
      return;
    }
    console.log(`\nQueued for analysis (${videos.length} videos):\n`);
    for (const v of videos) {
      const flags = [v.isBookmarked ? "bookmarked" : null, v.isLiked ? "liked" : null]
        .filter(Boolean).join(", ");
      console.log(`  ${v.videoId}  ${flags ? `[${flags}]` : ""}`);
      if (v.caption) {
        console.log(`    ${v.caption.slice(0, 80)}${v.caption.length > 80 ? "…" : ""}`);
      }
    }
    return;
  }

  // ── Queue by explicit IDs ─────────────────────────────────────────────────
  if (options.id || options.ids) {
    const rawIds = [
      ...(options.id ? [options.id] : []),
      ...(options.ids ? options.ids.split(",").map((s) => s.trim()) : []),
    ].filter(Boolean);

    const count = await queueVideos(rawIds);
    console.log(`\nQueued ${count} of ${rawIds.length} video(s).`);
    if (count < rawIds.length) {
      logger.warn(`${rawIds.length - count} ID(s) not found in the database.`);
    }
    return;
  }

  // ── Queue from file ───────────────────────────────────────────────────────
  if (options.file) {
    const filePath = path.resolve(options.file);
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      process.exit(1);
    }

    const ids = fs
      .readFileSync(filePath, "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#")); // skip blank lines and comments

    if (ids.length === 0) {
      logger.warn("File is empty or contains only comments.");
      return;
    }

    console.log(`\nRead ${ids.length} video ID(s) from ${path.basename(filePath)}`);
    const count = await queueVideos(ids);
    console.log(`Queued ${count} of ${ids.length} video(s).`);
    if (count < ids.length) {
      logger.warn(`${ids.length - count} ID(s) not found in the database.`);
    }
    return;
  }

  // ── Queue by filter criteria ──────────────────────────────────────────────
  const hasFilter = options.bookmarked || options.liked || options.author || options.minPlays;
  if (hasFilter) {
    const filterDesc: string[] = [];
    if (options.bookmarked) filterDesc.push("bookmarked");
    if (options.liked)      filterDesc.push("liked");
    if (options.author)     filterDesc.push(`author @${options.author.replace(/^@/, "")}`);
    if (options.minPlays)   filterDesc.push(`min plays: ${options.minPlays.toLocaleString()}`);

    console.log(`\nQueuing videos matching: ${filterDesc.join(" + ")}`);

    const count = await queueByFilter({
      bookmarked:   options.bookmarked,
      liked:        options.liked,
      authorHandle: options.author,
      minPlays:     options.minPlays,
    });

    console.log(`Queued ${count.toLocaleString()} video(s).`);
    if (count > 0) {
      console.log(`Run 'analyze-tiktok --all' to process them.`);
    }
    return;
  }

  // ── No options — show help ────────────────────────────────────────────────
  console.error("\nUsage:");
  console.error("  queue-tiktok --id <video_id>");
  console.error("  queue-tiktok --ids <id1,id2,id3>");
  console.error("  queue-tiktok --file scripts/tiktok/queues/my-list.txt");
  console.error("  queue-tiktok --bookmarked");
  console.error("  queue-tiktok --liked");
  console.error("  queue-tiktok --author <handle>");
  console.error("  queue-tiktok --min-plays <number>");
  console.error("  queue-tiktok --list");
  console.error("  queue-tiktok --stats");
  process.exit(1);
}

/**
 * backfill-titles.ts
 *
 * One-shot script to generate short titles for already-analyzed videos
 * that are missing them in the JSON blob. Reads transcripts from MySQL,
 * asks Claude for a 5-8 word title, writes it back. No re-transcription.
 *
 * Run: npx tsx scripts/tiktok/backfill-titles.ts
 */

import "dotenv/config";
import mysql from "mysql2/promise";
import { askJSON } from "../../src/models/claude.js";

const pool = mysql.createPool({
  host:     process.env.MYSQL_HOST     ?? "127.0.0.1",
  port:     Number(process.env.MYSQL_PORT ?? 3306),
  user:     process.env.MYSQL_USER     ?? "orchestrator",
  password: process.env.MYSQL_PASSWORD ?? "orchestrator",
  database: "tiktok",
  connectionLimit: 3,
  timezone: "Z",
});

interface Row {
  video_id: string;
  transcript: string;
  summary: string;
}

async function main() {
  // Fetch all done analyses — we'll skip any that already have a title in the blob
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT video_id, transcript, summary
     FROM tiktok_analysis
     WHERE analysis_status = 'done' AND transcript IS NOT NULL`
  );

  const needsTitle = (rows as Row[]).filter((r) => {
    try {
      const parsed = JSON.parse(r.transcript);
      return !parsed.title;
    } catch {
      return true; // old raw-text format — also needs a title
    }
  });

  console.log(`${rows.length} analyzed videos total, ${needsTitle.length} need a title\n`);

  if (needsTitle.length === 0) {
    console.log("Nothing to do.");
    await pool.end();
    return;
  }

  let done = 0;
  let failed = 0;

  for (const row of needsTitle) {
    try {
      // Parse existing blob — may be raw text for old-format rows
      let blob: Record<string, unknown> = {};
      let transcriptText = row.transcript;
      try {
        blob = JSON.parse(row.transcript);
        transcriptText = (blob.transcript as string) ?? row.transcript;
      } catch {
        // raw text — treat as transcript
      }

      // Ask Claude for just a title — cheap haiku call
      const { title } = await askJSON<{ title: string }>(
        "claude-haiku-4-5-20251001",
        `You generate short, descriptive titles for content.
Given a transcript and summary, return a JSON object with a single field:
- "title": a clean 5-8 word title describing what this content is about.
  No hashtags. No TikTok language. Just a clear label, e.g. "Claude Code Project Config Walkthrough".
Return ONLY valid JSON.`,
        `Summary: ${row.summary}\n\nTranscript (first 500 chars): ${transcriptText.slice(0, 500)}`
      );

      // Write updated blob back
      const updated = JSON.stringify({ ...blob, title });
      await pool.query(
        `UPDATE tiktok_analysis SET transcript = ? WHERE video_id = ?`,
        [updated, row.video_id]
      );

      console.log(`  ✓ ${row.video_id} → "${title}"`);
      done++;
    } catch (err) {
      console.error(`  ✗ ${row.video_id} — ${String(err)}`);
      failed++;
    }
  }

  console.log(`\nDone: ${done} titled, ${failed} failed`);
  await pool.end();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

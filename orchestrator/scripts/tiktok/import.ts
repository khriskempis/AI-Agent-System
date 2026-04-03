/**
 * TikTok Archive Import Script
 *
 * Decodes the base64-gzip blobs from the myfavett plugin data files,
 * cross-references local MP4 files, and bulk-inserts everything into
 * the `tiktok` MySQL database.
 *
 * Usage:
 *   npx tsx scripts/tiktok/import.ts
 *   npx tsx scripts/tiktok/import.ts --dry-run   # print stats, no DB writes
 *
 * Source data is read from TIKTOK_DATA_PATH (default: /mnt/m/TT videos/data/.appdata)
 * Local videos are looked up under TIKTOK_VIDEOS_PATH (default: /mnt/m/TT videos/data)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import mysql from 'mysql2/promise';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DATA_PATH   = process.env.TIKTOK_DATA_PATH   ?? '/mnt/m/TT videos/data/.appdata';
const VIDEOS_PATH = process.env.TIKTOK_VIDEOS_PATH ?? '/mnt/m/TT videos/data';

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 500; // rows per INSERT

const DB_CONFIG = {
  host:     process.env.MYSQL_HOST     ?? '127.0.0.1',
  port:     Number(process.env.MYSQL_PORT ?? 3306),
  user:     process.env.MYSQL_USER     ?? 'root',
  password: process.env.MYSQL_PASSWORD ?? 'rootpassword',
  database: 'tiktok',
  multipleStatements: false,
};

// ---------------------------------------------------------------------------
// Types matching the decoded data structures
// ---------------------------------------------------------------------------

interface RawVideo {
  authorId:   string;
  createTime: number; // unix timestamp
  diggCount:  number;
  playCount:  number;
  audioId:    string;
  size:       number; // bytes
}

interface RawAuthor {
  uniqueIds:     string[];
  nicknames:     string[];
  followerCount: number;
  heartCount:    number;
  videoCount:    number;
}

// ---------------------------------------------------------------------------
// Decode a myfavett .js blob file
// ---------------------------------------------------------------------------

function decodeDbFile(filePath: string): Record<string, unknown> {
  const raw = fs.readFileSync(filePath, 'utf8');

  // Extract the base64 string between the quotes: window.xxx_base64="..."
  const match = raw.match(/=["']([A-Za-z0-9+/=\s]+)["']/);
  if (!match) throw new Error(`Could not find base64 payload in ${filePath}`);

  const b64 = match[1].replace(/\s/g, '');
  const compressed = Buffer.from(b64, 'base64');
  const json = zlib.gunzipSync(compressed).toString('utf8');
  return JSON.parse(json);
}

function decodeListFile(filePath: string): string[] {
  const raw = fs.readFileSync(filePath, 'utf8');
  const match = raw.match(/=["']([A-Za-z0-9+/=\s]+)["']/);
  if (!match) throw new Error(`Could not find base64 payload in ${filePath}`);
  const b64 = match[1].replace(/\s/g, '');
  const compressed = Buffer.from(b64, 'base64');
  const json = zlib.gunzipSync(compressed).toString('utf8');
  const parsed = JSON.parse(json);
  // officialList location varies by file:
  //   db_bookmarked.js → parsed.officialList
  //   db_likes.js      → parsed.likes.officialList
  if (Array.isArray(parsed)) return parsed;
  if (parsed.officialList) return parsed.officialList;
  if (parsed.likes?.officialList) return parsed.likes.officialList;
  if (parsed.bookmarks?.officialList) return parsed.bookmarks.officialList;
  return [];
}

// ---------------------------------------------------------------------------
// Build a Set of locally-present video IDs per category
// ---------------------------------------------------------------------------

function buildLocalFileIndex(): {
  likesSet: Set<string>;
  favoritesSet: Set<string>;
} {
  const likesDir     = path.join(VIDEOS_PATH, 'Likes', 'videos');
  const favoritesDir = path.join(VIDEOS_PATH, 'Favorites', 'videos');

  const readIds = (dir: string): Set<string> => {
    if (!fs.existsSync(dir)) return new Set();
    return new Set(
      fs.readdirSync(dir)
        .filter(f => f.endsWith('.mp4'))
        .map(f => f.replace('.mp4', ''))
    );
  };

  return {
    likesSet:     readIds(likesDir),
    favoritesSet: readIds(favoritesDir),
  };
}

// ---------------------------------------------------------------------------
// Batch insert helpers
// ---------------------------------------------------------------------------

async function insertAuthors(
  conn: mysql.Connection,
  authors: Array<{
    authorId: string;
    uniqueId: string | null;
    nickname: string | null;
    followerCount: number | null;
    heartCount: number | null;
    videoCount: number | null;
  }>
): Promise<void> {
  for (let i = 0; i < authors.length; i += BATCH_SIZE) {
    const batch = authors.slice(i, i + BATCH_SIZE);
    const placeholders = batch.map(() => '(?,?,?,?,?,?)').join(',');
    const values = batch.flatMap(a => [
      a.authorId, a.uniqueId, a.nickname, a.followerCount, a.heartCount, a.videoCount,
    ]);
    await conn.execute(
      `INSERT INTO tiktok_authors
         (author_id, unique_id, nickname, follower_count, heart_count, video_count)
       VALUES ${placeholders}
       ON DUPLICATE KEY UPDATE
         unique_id      = VALUES(unique_id),
         nickname       = VALUES(nickname),
         follower_count = VALUES(follower_count),
         heart_count    = VALUES(heart_count),
         video_count    = VALUES(video_count)`,
      values
    );
    console.log(`  authors: inserted batch ${i / BATCH_SIZE + 1} (${batch.length} rows)`);
  }
}

async function insertVideos(
  conn: mysql.Connection,
  videos: Array<{
    videoId: string;
    authorId: string;
    caption: string | null;
    createTime: Date | null;
    diggCount: number | null;
    playCount: number | null;
    audioId: string | null;
    sizeMb: number | null;
    tiktokUrl: string | null;
    isLiked: number;
    isBookmarked: number;
    hasLocalFile: number;
    localFilePath: string | null;
  }>
): Promise<void> {
  for (let i = 0; i < videos.length; i += BATCH_SIZE) {
    const batch = videos.slice(i, i + BATCH_SIZE);
    const placeholders = batch.map(() => '(?,?,?,?,?,?,?,?,?,?,?,?,?)').join(',');
    const values = batch.flatMap(v => [
      v.videoId, v.authorId, v.caption, v.createTime,
      v.diggCount, v.playCount, v.audioId, v.sizeMb, v.tiktokUrl,
      v.isLiked, v.isBookmarked, v.hasLocalFile, v.localFilePath,
    ]);
    await conn.execute(
      `INSERT INTO tiktok_videos
         (video_id, author_id, caption, create_time, digg_count, play_count,
          audio_id, size_mb, tiktok_url, is_liked, is_bookmarked,
          has_local_file, local_file_path)
       VALUES ${placeholders}
       ON DUPLICATE KEY UPDATE
         caption        = VALUES(caption),
         is_liked       = VALUES(is_liked),
         is_bookmarked  = VALUES(is_bookmarked),
         has_local_file = VALUES(has_local_file),
         local_file_path= VALUES(local_file_path)`,
      values
    );
    console.log(`  videos: inserted batch ${i / BATCH_SIZE + 1} (${batch.length} rows)`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`TikTok import — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Data path:   ${DATA_PATH}`);
  console.log(`Videos path: ${VIDEOS_PATH}`);
  console.log('');

  // 1. Decode source files
  console.log('Decoding source files...');
  const dbVideos    = decodeDbFile(path.join(DATA_PATH, 'db_videos.js'))    as Record<string, RawVideo>;
  const dbTexts     = decodeDbFile(path.join(DATA_PATH, 'db_texts.js'))     as Record<string, string>;
  const dbAuthors   = decodeDbFile(path.join(DATA_PATH, 'db_authors.js'))   as Record<string, RawAuthor>;

  // Liked / bookmarked lists — db_likes.js and db_bookmarked.js
  const likedIds      = new Set(decodeListFile(path.join(DATA_PATH, 'db_likes.js')));
  const bookmarkedIds = new Set(decodeListFile(path.join(DATA_PATH, 'db_bookmarked.js')));

  const videoIds  = Object.keys(dbVideos);
  const authorIds = Object.keys(dbAuthors);

  console.log(`  ${videoIds.length.toLocaleString()} videos`);
  console.log(`  ${authorIds.length.toLocaleString()} authors`);
  console.log(`  ${likedIds.size.toLocaleString()} liked`);
  console.log(`  ${bookmarkedIds.size.toLocaleString()} bookmarked`);

  // 2. Build local file index
  console.log('\nIndexing local MP4 files...');
  const { likesSet, favoritesSet } = buildLocalFileIndex();
  const allLocalIds = new Set([...likesSet, ...favoritesSet]);
  console.log(`  ${likesSet.size.toLocaleString()} in Likes/videos/`);
  console.log(`  ${favoritesSet.size.toLocaleString()} in Favorites/videos/`);
  console.log(`  ${allLocalIds.size.toLocaleString()} unique local files`);

  // 3. Build author rows
  const authorRows = authorIds.map(authorId => {
    const a = dbAuthors[authorId];
    return {
      authorId,
      uniqueId:      a.uniqueIds?.[0] ?? null,
      nickname:      a.nicknames?.[0] ?? null,
      followerCount: a.followerCount  ?? null,
      heartCount:    a.heartCount     ?? null,
      videoCount:    a.videoCount     ?? null,
    };
  });

  // 4. Build video rows
  const videoRows = videoIds.map(videoId => {
    const v       = dbVideos[videoId];
    const caption = dbTexts[videoId] ?? null;
    const author  = v.authorId ?? null;

    // Resolve unique_id for URL construction
    const rawAuthor = author ? dbAuthors[author] : null;
    const uniqueId  = rawAuthor?.uniqueIds?.[0] ?? null;
    const tiktokUrl = uniqueId
      ? `https://www.tiktok.com/@${uniqueId}/video/${videoId}`
      : null;

    const isLiked      = likedIds.has(videoId)      ? 1 : 0;
    const isBookmarked = bookmarkedIds.has(videoId)  ? 1 : 0;

    // Prefer Favorites path, fall back to Likes
    let hasLocalFile = 0;
    let localFilePath: string | null = null;
    if (favoritesSet.has(videoId)) {
      hasLocalFile  = 1;
      localFilePath = path.join(VIDEOS_PATH, 'Favorites', 'videos', `${videoId}.mp4`);
    } else if (likesSet.has(videoId)) {
      hasLocalFile  = 1;
      localFilePath = path.join(VIDEOS_PATH, 'Likes', 'videos', `${videoId}.mp4`);
    }

    return {
      videoId,
      authorId:     author ?? '',
      caption,
      createTime:   v.createTime ? new Date(v.createTime * 1000) : null,
      diggCount:    v.diggCount  ?? null,
      playCount:    v.playCount  ?? null,
      audioId:      v.audioId    ?? null,
      sizeMb:       v.size ? Math.round((v.size / 1024 / 1024) * 100) / 100 : null,
      tiktokUrl,
      isLiked,
      isBookmarked,
      hasLocalFile,
      localFilePath,
    };
  });

  const localCount = videoRows.filter(v => v.hasLocalFile).length;
  console.log(`\n${localCount.toLocaleString()} of ${videoRows.length.toLocaleString()} videos have local MP4 files`);

  if (DRY_RUN) {
    console.log('\nDry run complete — no DB writes.');
    console.log('Sample video row:', JSON.stringify(videoRows[0], null, 2));
    console.log('Sample author row:', JSON.stringify(authorRows[0], null, 2));
    return;
  }

  // 5. Connect and insert
  console.log('\nConnecting to MySQL...');
  const conn = await mysql.createConnection(DB_CONFIG);
  console.log('Connected.\n');

  try {
    console.log('Inserting authors...');
    await insertAuthors(conn, authorRows);

    console.log('\nInserting videos...');
    await insertVideos(conn, videoRows);

    console.log('\nImport complete.');
    const [[{ videoCount }]] = await conn.execute(
      'SELECT COUNT(*) AS videoCount FROM tiktok_videos'
    ) as any;
    const [[{ authorCount }]] = await conn.execute(
      'SELECT COUNT(*) AS authorCount FROM tiktok_authors'
    ) as any;
    console.log(`  tiktok_videos:  ${Number(videoCount).toLocaleString()} rows`);
    console.log(`  tiktok_authors: ${Number(authorCount).toLocaleString()} rows`);
  } finally {
    await conn.end();
  }
}

main().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});

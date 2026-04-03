-- TikTok Archive Schema
-- Lives in the same MySQL instance as the orchestrator DB but stays local-only.
-- Auto-loaded by MySQL container on first startup via 02-tiktok-schema.sql mount.

CREATE DATABASE IF NOT EXISTS tiktok;
USE tiktok;

CREATE TABLE IF NOT EXISTS tiktok_authors (
  author_id      VARCHAR(50)   NOT NULL PRIMARY KEY,
  unique_id      VARCHAR(100)  NULL,                  -- @handle (most recent)
  nickname       VARCHAR(255)  NULL,
  follower_count INT           NULL,
  heart_count    BIGINT        NULL,
  video_count    INT           NULL,
  imported_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tiktok_videos (
  video_id       VARCHAR(30)   NOT NULL PRIMARY KEY,
  author_id      VARCHAR(50)   NULL,
  caption        TEXT          NULL,
  create_time    DATETIME      NULL,
  digg_count     INT           NULL,
  play_count     INT           NULL,
  audio_id       VARCHAR(50)   NULL,
  size_mb        DECIMAL(8,2)  NULL,
  tiktok_url     VARCHAR(500)  NULL,
  is_liked       TINYINT(1)    NOT NULL DEFAULT 0,
  is_bookmarked  TINYINT(1)    NOT NULL DEFAULT 0,
  has_local_file TINYINT(1)    NOT NULL DEFAULT 0,    -- MP4 present on this machine
  local_file_path VARCHAR(500) NULL,                  -- absolute WSL path to the MP4
  queued_for_analysis TINYINT(1) NOT NULL DEFAULT 0, -- manually flagged for analysis
  imported_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (author_id) REFERENCES tiktok_authors(author_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS tiktok_analysis (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  video_id        VARCHAR(30)   NOT NULL,
  transcript      LONGTEXT      NULL,
  summary         TEXT          NULL,
  content_type    ENUM('blog','social','reference') NULL,
  analysis_status ENUM('pending','done') NOT NULL DEFAULT 'pending',
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (video_id) REFERENCES tiktok_videos(video_id) ON DELETE CASCADE
);

CREATE INDEX idx_videos_author     ON tiktok_videos(author_id);
CREATE INDEX idx_videos_liked      ON tiktok_videos(is_liked);
CREATE INDEX idx_videos_bookmarked ON tiktok_videos(is_bookmarked);
CREATE INDEX idx_videos_local      ON tiktok_videos(has_local_file);
CREATE INDEX idx_videos_queued     ON tiktok_videos(queued_for_analysis);
CREATE INDEX idx_analysis_video    ON tiktok_analysis(video_id);
CREATE INDEX idx_analysis_status   ON tiktok_analysis(analysis_status);

-- Grant the orchestrator MySQL user access to this database so the
-- orchestrator container can read/write tiktok data without root credentials.
GRANT ALL PRIVILEGES ON tiktok.* TO 'orchestrator'@'%';
FLUSH PRIVILEGES;

-- Orchestrator Workflow History Schema
-- Auto-loaded by MySQL container on first startup

CREATE DATABASE IF NOT EXISTS orchestrator;
USE orchestrator;

-- One row per pipeline execution
CREATE TABLE IF NOT EXISTS workflow_runs (
  id              VARCHAR(36)   NOT NULL PRIMARY KEY,          -- UUID
  pipeline        VARCHAR(100)  NOT NULL,                      -- e.g. 'categorize-idea'
  notion_page_id  VARCHAR(100)  NOT NULL,                      -- the Notion page being processed
  notion_page_name VARCHAR(500) NULL,                          -- human-readable name for querying
  status          ENUM('RUNNING','COMPLETED','FAILED','NEEDS_REVIEW') NOT NULL DEFAULT 'RUNNING',
  current_stage   VARCHAR(50)   NULL,                          -- last reached stage
  attempts        INT           NOT NULL DEFAULT 0,            -- QA loop attempts
  stage_results   JSON          NULL,                          -- cached outputs per stage (for replay)
  started_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  completed_at    DATETIME      NULL
);

-- Immutable audit log — one row per stage event
CREATE TABLE IF NOT EXISTS workflow_events (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  run_id        VARCHAR(36)   NOT NULL,
  stage         VARCHAR(50)   NOT NULL,                        -- FETCH, PARSE, CLASSIFY, etc.
  status        ENUM('STARTED','COMPLETED','FAILED','RETRYING') NOT NULL,
  attempt       INT           NOT NULL DEFAULT 1,
  result        JSON          NULL,                            -- full stage output
  error_message TEXT          NULL,
  duration_ms   INT           NULL,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (run_id) REFERENCES workflow_runs(id) ON DELETE CASCADE
);

CREATE INDEX idx_runs_notion_page ON workflow_runs(notion_page_id);
CREATE INDEX idx_runs_status      ON workflow_runs(status);
CREATE INDEX idx_runs_started     ON workflow_runs(started_at);
CREATE INDEX idx_events_run_id    ON workflow_events(run_id);
CREATE INDEX idx_events_stage     ON workflow_events(stage, status);

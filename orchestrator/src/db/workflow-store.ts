import { randomUUID } from "crypto";
import type { RowDataPacket } from "mysql2/promise";
import { getPool } from "./connection.js";

export type RunStatus = "RUNNING" | "COMPLETED" | "FAILED" | "NEEDS_REVIEW";
export type EventStatus = "STARTED" | "COMPLETED" | "FAILED" | "RETRYING";

/**
 * Check if a pipeline run is already active for a given Notion page.
 * Used to prevent duplicate concurrent executions (idempotency guard).
 */
export async function isRunning(notionPageId: string): Promise<boolean> {
  const pool = getPool();
  if (!pool) return false;

  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM workflow_runs WHERE notion_page_id = ? AND status = 'RUNNING' LIMIT 1",
    [notionPageId]
  );
  return rows.length > 0;
}

/**
 * Create a new workflow run row and return its UUID.
 * If the DB is not configured, still returns a UUID so the rest of the
 * pipeline can use it as a correlation ID in logs.
 */
export async function createRun(
  pipeline: string,
  notionPageId: string,
  pageName?: string
): Promise<string> {
  const runId = randomUUID();
  const pool = getPool();

  if (!pool) return runId;

  await pool.query(
    `INSERT INTO workflow_runs (id, pipeline, notion_page_id, notion_page_name, status, current_stage)
     VALUES (?, ?, ?, ?, 'RUNNING', 'INIT')`,
    [runId, pipeline, notionPageId, pageName ?? null]
  );

  return runId;
}

/**
 * Update the current stage and merge new stage outputs into the cached
 * stage_results JSON column (used for checkpoint / potential replay).
 */
export async function updateRunStage(
  runId: string,
  stage: string,
  newResults: Record<string, unknown>
): Promise<void> {
  const pool = getPool();
  if (!pool) return;

  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT stage_results FROM workflow_runs WHERE id = ?",
    [runId]
  );

  const existing: Record<string, unknown> =
    typeof rows[0]?.stage_results === "string"
      ? JSON.parse(rows[0].stage_results)
      : (rows[0]?.stage_results ?? {});

  const merged = { ...existing, ...newResults };

  await pool.query(
    "UPDATE workflow_runs SET current_stage = ?, stage_results = ?, updated_at = NOW() WHERE id = ?",
    [stage, JSON.stringify(merged), runId]
  );
}

/**
 * Mark a run as finished with a terminal status and set completed_at.
 */
export async function completeRun(
  runId: string,
  status: Exclude<RunStatus, "RUNNING">
): Promise<void> {
  const pool = getPool();
  if (!pool) return;

  await pool.query(
    "UPDATE workflow_runs SET status = ?, completed_at = NOW(), updated_at = NOW() WHERE id = ?",
    [status, runId]
  );
}

/**
 * Append an immutable event to the audit log for a run.
 * Each stage logs STARTED, then COMPLETED or FAILED.
 */
export async function logEvent(
  runId: string,
  stage: string,
  status: EventStatus,
  attempt: number,
  result?: unknown,
  errorMessage?: string,
  durationMs?: number
): Promise<void> {
  const pool = getPool();
  if (!pool) return;

  await pool.query(
    `INSERT INTO workflow_events (run_id, stage, status, attempt, result, error_message, duration_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      runId,
      stage,
      status,
      attempt,
      result !== undefined ? JSON.stringify(result) : null,
      errorMessage ?? null,
      durationMs ?? null,
    ]
  );
}

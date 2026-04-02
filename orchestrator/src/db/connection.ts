import mysql from "mysql2/promise";
import { logger } from "../logger.js";

let pool: mysql.Pool | null = null;

/**
 * Returns a MySQL connection pool if MYSQL_HOST is configured, null otherwise.
 * All workflow-store functions check for null and silently no-op, so the
 * pipeline runs fine without a database (useful for dry-runs or local dev).
 */
export function getPool(): mysql.Pool | null {
  if (!process.env.MYSQL_HOST) return null;

  if (!pool) {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST,
      port: Number(process.env.MYSQL_PORT ?? 3306),
      user: process.env.MYSQL_USER ?? "orchestrator",
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE ?? "orchestrator",
      waitForConnections: true,
      connectionLimit: 5,
      timezone: "Z",
    });

    logger.info(`[db] Connected to MySQL at ${process.env.MYSQL_HOST}:${process.env.MYSQL_PORT ?? 3306}`);
  }

  return pool;
}

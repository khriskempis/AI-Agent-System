import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Log file setup
// ---------------------------------------------------------------------------

// Resolve log file path — works both locally (relative to project root) and
// inside the orchestrator container where /logs is mounted as a volume.
const LOG_FILE =
  process.env.LOG_FILE ??
  (fs.existsSync("/logs")
    ? "/logs/pipeline.log"                              // inside container
    : path.resolve(process.cwd(), "../logs/pipeline.log")); // local dev

let logStream: fs.WriteStream | null = null;

function getStream(): fs.WriteStream | null {
  if (logStream) return logStream;
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    const stream = fs.createWriteStream(LOG_FILE, { flags: "a" });
    // Suppress async errors (e.g. permission denied in container) — don't crash
    stream.on("error", () => { logStream = null; });
    logStream = stream;
  } catch {
    // Sync errors (e.g. mkdir failed) — continue without log file
  }
  return logStream;
}

function write(level: string, message: string): void {
  const ts = new Date().toISOString();
  const line = `${ts} [${level}] ${message}\n`;
  getStream()?.write(line);
}

// ---------------------------------------------------------------------------
// Stage map
// ---------------------------------------------------------------------------

const STAGES = {
  FETCH: 1,
  PARSE: 2,
  CLASSIFY: 3,
  VALIDATE: 4,
  EVALUATE: 5,
  WRITE: 6,
  PLAN: 7,
  TRANSCRIBE: 8,
  ANALYZE: 9,
} as const;

type Stage = keyof typeof STAGES;

function label(stage: Stage): string {
  return `[STAGE ${STAGES[stage]}: ${stage}]`;
}

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

export const logger = {
  stage(stage: Stage, message: string): void {
    const msg = `${label(stage)} ${message}`;
    console.log(`\n${msg}`);
    write("STAGE", msg);
  },
  info(message: string): void {
    console.log(`  ${message}`);
    write("INFO ", message);
  },
  success(message: string): void {
    console.log(`  ✓ ${message}`);
    write("OK   ", message);
  },
  warn(message: string): void {
    console.warn(`  ⚠ ${message}`);
    write("WARN ", message);
  },
  error(message: string): void {
    console.error(`  ✗ ${message}`);
    write("ERROR", message);
  },
  json(label: string, data: unknown): void {
    const msg = `${label}: ${JSON.stringify(data)}`;
    console.log(`  ${label}:`, JSON.stringify(data, null, 2));
    write("JSON ", msg);
  },
};

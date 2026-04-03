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

export const logger = {
  stage(stage: Stage, message: string): void {
    console.log(`\n${label(stage)} ${message}`);
  },
  info(message: string): void {
    console.log(`  ${message}`);
  },
  success(message: string): void {
    console.log(`  ✓ ${message}`);
  },
  warn(message: string): void {
    console.warn(`  ⚠ ${message}`);
  },
  error(message: string): void {
    console.error(`  ✗ ${message}`);
  },
  json(label: string, data: unknown): void {
    console.log(`  ${label}:`, JSON.stringify(data, null, 2));
  },
};

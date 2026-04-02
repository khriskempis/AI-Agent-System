import { logger } from "./logger.js";

/**
 * Wraps an async function with automatic retry + exponential backoff.
 * Mirrors Temporal's Activity retry policy — each Claude/API call gets
 * its own retry budget independently of the pipeline's QA loop.
 *
 * @example
 *   const result = await withRetry(() => classifyIdeas(parsed), { label: "CLASSIFY" });
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    backoffMs?: number;
    label?: string;
  } = {}
): Promise<T> {
  const { maxAttempts = 3, backoffMs = 1000, label = "operation" } = options;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      const delay = backoffMs * attempt; // 1s, 2s, 3s ...
      logger.warn(
        `[retry] ${label} failed (attempt ${attempt}/${maxAttempts}) — retrying in ${delay}ms`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Unreachable, but satisfies TypeScript
  throw new Error(`withRetry: exhausted ${maxAttempts} attempts for "${label}"`);
}

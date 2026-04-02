import { logger } from "../logger.js";
import type { AgentInput, AgentOutput } from "./types.js";

/**
 * ValidationAgent — assesses the overall quality of a daily workflow run.
 *
 * Receives all prior phase results via input.parameters.phaseResults and
 * produces a pass/fail summary. Replaces the n8n "validation-agent-execute" webhook.
 *
 * Currently performs structural validation (counts, error rates).
 * Claude-based semantic validation can be layered on in a future phase.
 */
export class ValidationAgent {
  async execute(input: AgentInput): Promise<AgentOutput> {
    const start = Date.now();

    logger.info(`[ValidationAgent] Starting — workflowId: ${input.workflowId}`);

    const phaseResults = input.parameters.phaseResults as
      | Record<string, AgentOutput>
      | undefined;

    if (!phaseResults) {
      const msg = "No phase results provided to validate";
      logger.warn(`[ValidationAgent] ${msg}`);
      return {
        agentId: "validation-agent",
        phase: "validation",
        success: false,
        durationMs: Date.now() - start,
        results: {},
        errors: [msg],
      };
    }

    const notionResult = phaseResults["notion"];

    // If no notion phase ran, nothing to validate
    if (!notionResult) {
      logger.info("[ValidationAgent] No notion phase results — skipping validation");
      return {
        agentId: "validation-agent",
        phase: "validation",
        success: true,
        durationMs: Date.now() - start,
        results: { note: "No notion phase results to validate" },
        errors: [],
      };
    }

    const total = (notionResult.results.total as number) ?? 0;
    const processed = (notionResult.results.processed as number) ?? 0;
    const failed = (notionResult.results.failed as number) ?? 0;

    const passed = notionResult.success && failed === 0;
    const feedback = passed
      ? `All ${processed} idea(s) processed successfully.`
      : failed === total
      ? `All ${total} idea(s) failed — check connectivity and API credentials.`
      : `${failed} of ${total} idea(s) failed. ${processed} succeeded.`;

    logger.info(`[ValidationAgent] ${feedback}`);

    if (!passed && notionResult.errors.length > 0) {
      notionResult.errors.forEach((e) => logger.warn(`[ValidationAgent]   ↳ ${e}`));
    }

    return {
      agentId: "validation-agent",
      phase: "validation",
      success: passed,
      durationMs: Date.now() - start,
      results: {
        totalIdeas: total,
        processed,
        failed,
        feedback,
        notionAgentSuccess: notionResult.success,
      },
      errors: passed ? [] : notionResult.errors,
    };
  }
}

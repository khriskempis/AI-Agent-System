import { logger } from "../logger.js";
import type { AgentInput, AgentOutput } from "./types.js";

/**
 * ValidationAgent — assesses the quality of the daily categorization run.
 *
 * Receives all prior phase results via input.parameters.phaseResults and
 * produces a pass/fail summary of the notion (categorization) phase.
 *
 * Planning runs separately (plan-idea pipeline) and is not assessed here.
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
      ? `All ${processed} idea(s) categorized successfully.`
      : failed === total
      ? `All ${total} idea(s) failed — check connectivity and API credentials.`
      : `${failed} of ${total} idea(s) failed categorization. ${processed} succeeded.`;

    logger.info(`[ValidationAgent] ${feedback}`);

    if (!passed && notionResult.errors.length > 0) {
      notionResult.errors.forEach((e) => logger.warn(`[ValidationAgent]   ↳ ${e}`));
    }

    return {
      agentId: "validation-agent",
      phase: "validation",
      success: passed,
      durationMs: Date.now() - start,
      results: { totalIdeas: total, processed, failed, feedback },
      errors: passed ? [] : notionResult.errors,
    };
  }
}

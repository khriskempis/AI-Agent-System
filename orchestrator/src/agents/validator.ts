import { askJSON } from "../models/claude.js";
import type { ParsedIdea } from "../parser.js";
import type { ClassifyResult } from "./director.js";

export interface ValidationResult {
  score: number;
  passed: boolean;
  feedback: string;
  checklist: string[];
}

const VALIDATE_SYSTEM = `You are a classification QA agent. Score a per-idea classification result 0-10 and return JSON:
- "score": integer 0-10
- "passed": true if score >= 8
- "feedback": one sentence summary
- "checklist": array of short checklist items with ✓ or ✗

Scoring criteria:
- Each idea must have a "destination" of "projects", "journal", or "knowledge" — appropriate to the idea content
- Tags must come ONLY from: ["Blog", "Project Idea", "Thought", "Mix of Ideas"]
- Routing must be sensible: actionable items → projects, personal reflections → journal, reference/educational → knowledge
- Confidence should be reasonable given the content

Return ONLY valid JSON.`;

export async function validateClassification(
  ideas: ParsedIdea[],
  result: ClassifyResult
): Promise<ValidationResult> {
  const userMessage = `Ideas:\n${ideas.map((i) => i.text).join("\n")}

Classification:
${JSON.stringify(result, null, 2)}`;

  return askJSON<ValidationResult>(
    "claude-haiku-4-5-20251001",
    VALIDATE_SYSTEM,
    userMessage
  );
}

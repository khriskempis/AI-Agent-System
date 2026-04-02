import { askJSON } from "../models/claude.js";
import type { ParsedIdea } from "../parser.js";
import type { ClassifyResult } from "./director.js";

export interface ValidationResult {
  score: number;
  passed: boolean;
  feedback: string;
  checklist: string[];
}

const VALIDATE_SYSTEM = `You are a classification QA agent. Score a classification result 0-10 and return JSON:
- "score": integer 0-10
- "passed": true if score >= 8
- "feedback": one sentence summary
- "checklist": array of short checklist items with ✓ or ✗

Scoring criteria:
- Tags must come ONLY from: ["Blog", "Project Idea", "Thought", "Mix of Ideas"]
- "Mix of Ideas" should be used when ideas span multiple types, not when they all fit one type
- A single-type tag should be used when all ideas clearly belong to one category
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

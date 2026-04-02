import { askJSON } from "../models/claude.js";
import type { ParsedIdea } from "../parser.js";

const ALLOWED_TAGS = ["Blog", "Project Idea", "Thought", "Mix of Ideas"] as const;
export type IdeaTag = (typeof ALLOWED_TAGS)[number];

export interface ClassifyResult {
  tags: IdeaTag[];
  reasoning: string;
  confidence: number;
}

export interface EvaluateResult {
  accepted: boolean;
  reason: string;
}

const CLASSIFY_SYSTEM = `You are an idea classifier. Given a list of ideas, return a JSON object with:
- "tags": array of tags from ONLY this allowed set: ["Blog", "Project Idea", "Thought", "Mix of Ideas"]
  - Use "Mix of Ideas" if the ideas span multiple types
  - Use a single tag if all ideas clearly belong to one type
- "reasoning": one sentence explaining your classification
- "confidence": number 0.0-1.0

Return ONLY valid JSON. No markdown, no explanation outside the JSON.`;

const EVALUATE_SYSTEM = `You are a QA evaluator deciding whether to accept or retry a classification.
You receive the original ideas and a validator's score (0-10) with feedback.
Return a JSON object:
- "accepted": true if score >= 8, false otherwise
- "reason": one sentence explaining your decision`;

export async function classifyIdeas(ideas: ParsedIdea[]): Promise<ClassifyResult> {
  const userMessage = ideas
    .map((idea, i) => {
      const linkNote = idea.link ? ` [link: ${idea.link}]` : "";
      return `${i + 1}. ${idea.text}${linkNote}`;
    })
    .join("\n");

  return askJSON<ClassifyResult>(
    "claude-haiku-4-5-20251001",
    CLASSIFY_SYSTEM,
    `Classify these ideas:\n${userMessage}`
  );
}

export async function evaluateQA(
  ideas: ParsedIdea[],
  classifyResult: ClassifyResult,
  validationScore: number,
  validationFeedback: string
): Promise<EvaluateResult> {
  const userMessage = `Ideas:\n${ideas.map((i) => i.text).join("\n")}

Classification result: ${JSON.stringify(classifyResult)}

Validator score: ${validationScore}/10
Validator feedback: ${validationFeedback}`;

  return askJSON<EvaluateResult>(
    "claude-haiku-4-5-20251001",
    EVALUATE_SYSTEM,
    userMessage
  );
}

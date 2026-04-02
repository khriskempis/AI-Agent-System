import { askJSON } from "../models/claude.js";
import type { ParsedIdea } from "../parser.js";

const ALLOWED_TAGS = ["Blog", "Project Idea", "Thought", "Mix of Ideas"] as const;
export type IdeaTag = (typeof ALLOWED_TAGS)[number];

export type RoutingDestination = "projects" | "journal" | "knowledge";

export interface IdeaClassification {
  text: string;
  destination: RoutingDestination;
  tags: IdeaTag[];
  reasoning: string;
  confidence: number;
}

export type ClassifyResult = IdeaClassification[];

export interface EvaluateResult {
  accepted: boolean;
  reason: string;
}

const CLASSIFY_SYSTEM = `You are an idea classifier and router. Given a list of ideas, return a JSON object with an "ideas" array where each item corresponds to one input idea and contains:
- "text": the original idea text (copy exactly)
- "destination": one of "projects", "journal", or "knowledge"
  - "projects": actionable tasks, things to build, implement, or execute
  - "journal": personal thoughts, reflections, opinions, observations, insights
  - "knowledge": reference materials, articles, videos, tutorials, educational content
- "tags": array of 1-3 tags from ONLY this allowed set: ["Blog", "Project Idea", "Thought", "Mix of Ideas"]
- "reasoning": one sentence explaining the destination and tag choices
- "confidence": number 0.0-1.0

Return ONLY valid JSON in this shape: { "ideas": [ {...}, {...} ] }. No markdown, no explanation outside the JSON.`;

const EVALUATE_SYSTEM = `You are a QA evaluator deciding whether to accept or retry a per-idea classification.
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

  const response = await askJSON<{ ideas: IdeaClassification[] }>(
    "claude-haiku-4-5-20251001",
    CLASSIFY_SYSTEM,
    `Classify and route these ideas:\n${userMessage}`
  );
  return response.ideas;
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

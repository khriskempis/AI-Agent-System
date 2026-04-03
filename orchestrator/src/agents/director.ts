import { askJSON } from "../models/ollama.js";
import type { ParsedIdea } from "../parser.js";

const ALLOWED_TAGS = ["Blog", "Project Idea", "Thought", "Mix of Ideas"] as const;
export type IdeaTag = (typeof ALLOWED_TAGS)[number];

export type RoutingDestination = "projects" | "journal" | "knowledge";

export interface IdeaClassification {
  text: string;
  shortTitle: string;
  description: string;
  destination: RoutingDestination;
  tags: IdeaTag[];
  reasoning: string;
  confidence: number;
}

export type ClassifyResult = IdeaClassification[];

export interface DestinationTagOptions {
  projects: string[];
  journal: string[];
  knowledge: string[];
}

export interface EvaluateResult {
  accepted: boolean;
  reason: string;
}

function buildClassifySystem(tagOptions: DestinationTagOptions): string {
  return `You are an idea classifier and router. Given a list of ideas, return a JSON object with an "ideas" array where each item corresponds to one input idea and contains:
- "text": the original idea text (copy exactly)
- "shortTitle": a concise title of 3-8 words summarizing the idea
- "description": one or two sentences describing the idea and its value
- "destination": one of "projects", "journal", or "knowledge"
  - "projects": actionable tasks, things to build, implement, or execute
  - "journal": personal thoughts, reflections, opinions, observations, insights
  - "knowledge": reference materials, articles, videos, tutorials, educational content
- "tags": array of up to 3 tags, chosen from the allowed list for the chosen destination (most relevant first):
  - projects tags: ${JSON.stringify(tagOptions.projects)}
  - journal tags: ${JSON.stringify(tagOptions.journal)}
  - knowledge tags: ${JSON.stringify(tagOptions.knowledge)}
- "reasoning": one sentence explaining the destination and tag choices
- "confidence": number 0.0-1.0

Return ONLY valid JSON in this shape: { "ideas": [ {...}, {...} ] }. No markdown, no explanation outside the JSON.`;
}

const EVALUATE_SYSTEM = `You are a QA evaluator deciding whether to accept or retry a per-idea classification.
You receive the original ideas and a validator's score (0-10) with feedback.
Return a JSON object:
- "accepted": true if score >= 8, false otherwise
- "reason": one sentence explaining your decision`;

export async function classifyIdeas(ideas: ParsedIdea[], tagOptions: DestinationTagOptions): Promise<ClassifyResult> {
  const userMessage = ideas
    .map((idea, i) => {
      const linkNote = idea.link ? ` [link: ${idea.link}]` : "";
      return `${i + 1}. ${idea.text}${linkNote}`;
    })
    .join("\n");

  const response = await askJSON<{ ideas: IdeaClassification[] }>(
    "llama3.1:8b",
    buildClassifySystem(tagOptions),
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
    "llama3.1:8b",
    EVALUATE_SYSTEM,
    userMessage
  );
}

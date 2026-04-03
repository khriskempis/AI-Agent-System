import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export type ClaudeModel =
  | "claude-haiku-4-5-20251001"
  | "claude-sonnet-4-6"
  | "claude-opus-4-6";

export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

export async function ask(
  model: ClaudeModel,
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 4096
): Promise<string> {
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const block = response.content[0];
  if (block.type !== "text") {
    throw new Error(`Unexpected response block type: ${block.type}`);
  }
  return block.text;
}

function extractFirstJSON(text: string): string {
  const start = text.indexOf("{");
  if (start === -1) throw new Error("No JSON object found in response");
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  throw new Error("Unclosed JSON object in response");
}

export async function askJSON<T>(
  model: ClaudeModel,
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 4096
): Promise<T> {
  const raw = await ask(model, systemPrompt, userMessage, maxTokens);
  const json = extractFirstJSON(raw);
  return JSON.parse(json) as T;
}

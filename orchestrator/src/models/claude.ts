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
  userMessage: string
): Promise<string> {
  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const block = response.content[0];
  if (block.type !== "text") {
    throw new Error(`Unexpected response block type: ${block.type}`);
  }
  return block.text;
}

export async function askJSON<T>(
  model: ClaudeModel,
  systemPrompt: string,
  userMessage: string
): Promise<T> {
  const raw = await ask(model, systemPrompt, userMessage);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error(`No JSON object found in response: ${raw}`);
  }
  return JSON.parse(match[0]) as T;
}

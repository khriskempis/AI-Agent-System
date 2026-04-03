export type OllamaModel = "llama3.1:8b" | "deepseek-r1:14b";

const BASE_URL = (): string =>
  process.env.OLLAMA_URL ?? "http://localhost:11434";

interface OllamaChatResponse {
  message: { content: string };
}

export async function ask(
  model: OllamaModel,
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const res = await fetch(`${BASE_URL()}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ollama HTTP ${res.status}: ${body}`);
  }

  const data = (await res.json()) as OllamaChatResponse;
  return data.message.content;
}

function extractFirstJSON(text: string): string {
  // deepseek-r1 wraps output in <think>...</think> — strip it first
  const stripped = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const start = stripped.indexOf("{");
  if (start === -1) throw new Error("No JSON object found in response");
  let depth = 0;
  for (let i = start; i < stripped.length; i++) {
    if (stripped[i] === "{") depth++;
    else if (stripped[i] === "}") {
      depth--;
      if (depth === 0) return stripped.slice(start, i + 1);
    }
  }
  throw new Error("Unclosed JSON object in response");
}

export async function askJSON<T>(
  model: OllamaModel,
  systemPrompt: string,
  userMessage: string
): Promise<T> {
  const raw = await ask(model, systemPrompt, userMessage);
  const json = extractFirstJSON(raw);
  return JSON.parse(json) as T;
}

import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-4-6";

export function getAnthropic(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key === "your_anthropic_api_key") return null;
  return new Anthropic({ apiKey: key });
}

export async function callClaude(
  system: string,
  user: string,
  maxTokens: number,
): Promise<string> {
  const client = getAnthropic();
  if (!client) {
    return "";
  }
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  });
  const block = msg.content[0];
  if (block && block.type === "text") return block.text;
  return "";
}

export function safeJsonParse<T>(raw: string): T | null {
  try {
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

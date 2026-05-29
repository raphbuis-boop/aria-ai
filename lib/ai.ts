import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-4-20250514";

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
  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    });
    const block = msg.content[0];
    if (block && block.type === "text") return block.text;
    return "";
  } catch {
    return "";
  }
}

export function safeJsonParse<T>(raw: string): T | null {
  try {
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

/**
 * Strips AI formatting artifacts from a draft message so it reads as plain
 * human-written text.
 *
 * Removes:
 *  - Leading meta-labels ("Draft:", "SMS:", "Text:", "Message:", "Reply:", etc.)
 *  - Markdown bold/italic/code
 *  - Bullet lists
 *  - Unfilled [bracket placeholders] (≤ 40 chars)
 *  - "Subject: …" lines
 *  - Wrapping quote marks around the full message
 *  - Excess blank lines
 */
export function sanitizeDraft(raw: string): string {
  let t = raw.trim();

  // Strip wrapping outer quotes (entire message wrapped in "..." or '...')
  t = t.replace(/^"([\s\S]+)"$/, "$1").replace(/^'([\s\S]+)'$/, "$1").trim();

  // Strip leading labels e.g. "Draft: ", "SMS: ", "Here's a draft:", "Message:"
  t = t.replace(/^(draft|sms|text message|text|message|reply|response|email|here is|here's a)[:\s–-]+/i, "");

  // Strip Subject: lines (for emails)
  t = t.replace(/^Subject:.*$/im, "").trim();

  // Strip markdown bold/italic
  t = t.replace(/\*\*(.+?)\*\*/g, "$1");
  t = t.replace(/__(.+?)__/g, "$1");
  t = t.replace(/\*(.+?)\*/g, "$1");
  t = t.replace(/_(.+?)_/g, "$1");

  // Strip code fences and inline code
  t = t.replace(/```[\s\S]*?```/g, "");
  t = t.replace(/`([^`]+)`/g, "$1");

  // Strip markdown bullet/numbered list prefixes
  t = t.replace(/^[\s]*[-•*]\s+/gm, "");
  t = t.replace(/^\d+\.\s+/gm, "");

  // Strip unfilled [placeholder] tokens (bracket content ≤ 40 chars)
  t = t.replace(/\[[^\]]{1,40}\]/g, "").trim();

  // Collapse 3+ newlines to 2
  t = t.replace(/\n{3,}/g, "\n\n");

  return t.trim();
}

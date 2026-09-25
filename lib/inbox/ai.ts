import Anthropic from "@anthropic-ai/sdk";
import { getAnthropic } from "@/lib/ai";

/**
 * Claude calls behind the Aria inbox. Structured outputs keep the JSON
 * schema-valid; any failure returns null and the inbox falls back to the
 * plain Gmail snippet (it never invents a summary).
 */
const MODEL = "claude-opus-5";

export type Urgency = "high" | "medium" | "low";

async function structured<T>(system: string, user: string, schema: Record<string, unknown>, maxTokens = 3000): Promise<T | null> {
  const client = getAnthropic();
  if (!client) return null;
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      thinking: { type: "adaptive" },
      output_config: { effort: "low", format: { type: "json_schema", schema } },
      system,
      messages: [{ role: "user", content: user }],
    });
    if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") return null;
    const text = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    return text ? (JSON.parse(text.text) as T) : null;
  } catch (error) {
    console.error("[inbox/ai] failed", error instanceof Anthropic.APIError ? `${error.status} ${error.message}` : error);
    return null;
  }
}

const CONTEXT = `You triage email for a solo New Jersey real-estate agent. Their clients are home buyers and sellers; other important senders are lenders, attorneys, title, inspectors and other agents.
Be concrete and brief. Never invent facts that aren't in the email.`;

export type ThreadDigest = {
  threadId: string;
  summary: string;
  why: string;
  urgency: Urgency;
  needs_reply: boolean;
};

export type DigestInput = {
  threadId: string;
  from: string;
  client: string | null;
  subject: string;
  latest: string;
  ageHours: number;
};

/** One call for the inbox list: a line of summary + why it matters per thread. */
export async function digestThreads(threads: DigestInput[]): Promise<Map<string, ThreadDigest>> {
  const out = new Map<string, ThreadDigest>();
  if (!threads.length) return out;
  const result = await structured<{ threads: ThreadDigest[] }>(
    `${CONTEXT}
For each email thread return:
- summary: what the sender wants or said, in one sentence (max 20 words).
- why: why it matters to the agent's business right now (max 14 words), e.g. "Buyer ready to offer on 44 Park St".
- urgency: high (deal, deadline, showing or money at stake in the next ~2 days, or an unhappy client), medium (needs a reply this week), low (FYI).
- needs_reply: true if the agent should reply.`,
    JSON.stringify(threads),
    {
      type: "object",
      properties: {
        threads: {
          type: "array",
          items: {
            type: "object",
            properties: {
              threadId: { type: "string" },
              summary: { type: "string" },
              why: { type: "string" },
              urgency: { type: "string", enum: ["high", "medium", "low"] },
              needs_reply: { type: "boolean" },
            },
            required: ["threadId", "summary", "why", "urgency", "needs_reply"],
            additionalProperties: false,
          },
        },
      },
      required: ["threads"],
      additionalProperties: false,
    },
  );
  const valid = new Set(threads.map((t) => t.threadId));
  for (const d of result?.threads ?? []) if (valid.has(d.threadId)) out.set(d.threadId, d);
  return out;
}

export type ThreadAssist = { summary: string; why: string; urgency: Urgency; reply: string };

export type AssistInput = {
  agentName: string;
  signature: string | null;
  tone: string | null;
  client: { name: string; status: string | null; town: string | null; budget_max: number | null } | null;
  subject: string;
  messages: Array<{ from: string; date: string; body: string }>;
};

/** Thread view: summary, why it matters, urgency and a reply in the agent's voice. */
export async function assistThread(input: AssistInput): Promise<ThreadAssist | null> {
  const out = await structured<ThreadAssist>(
    `${CONTEXT}
Read the whole thread (oldest first) and return:
- summary: 1-2 sentences on where the conversation stands.
- why: why it matters / what's at stake (max 18 words).
- urgency: high | medium | low (same meaning as a triage queue).
- reply: the agent's reply to the latest message. Answer what was asked; if you'd need facts you don't have (a price, a time, a document), say the agent will confirm rather than inventing them.
  Tone: ${input.tone || "warm"}; plain text; no subject line; 2-5 short sentences; end with the agent's signature${input.signature ? ` exactly: "${input.signature}"` : ` as their first name (${input.agentName.split(" ")[0] || "the agent"})`}.`,
    JSON.stringify(input),
    {
      type: "object",
      properties: {
        summary: { type: "string" },
        why: { type: "string" },
        urgency: { type: "string", enum: ["high", "medium", "low"] },
        reply: { type: "string" },
      },
      required: ["summary", "why", "urgency", "reply"],
      additionalProperties: false,
    },
    4000,
  );
  if (!out) return null;
  return { ...out, reply: out.reply.trim() };
}

import { getAnthropic } from "@/lib/ai";

export const INBOX_DRAFT_MODEL = "claude-sonnet-4-20250514";

/** True if body looks like an automation placeholder, not real copy. */
export function isPlaceholderDraftBody(body: string | null | undefined): boolean {
  if (!body?.trim()) return true;
  const t = body.trim();
  if (/^Re-engagement text draft \(Day \d+\)/i.test(t)) return true;
  if (/^Welcome sequence \(Day \d+\)/i.test(t)) return true;
  if (/^Follow-up email draft \(Day \d+\)/i.test(t)) return true;
  if (/drafted intro text for/i.test(t) && /Day \d+/.test(t)) return true;
  return false;
}

export type ClientDraftContext = {
  name: string | null;
  status?: string | null;
  town?: string | null;
  budget_min?: number | null;
  budget_max?: number | null;
  last_engagement_at?: string | null;
};

function daysSinceLastContact(iso: string | null | undefined): number {
  if (!iso) return 999;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 999;
  return Math.max(0, Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000)));
}

/**
 * Generates a natural SMS for inbox (saved to activities.body).
 */
export async function generateInboxSmsDraft(
  client: ClientDraftContext,
  kind: "welcome" | "followup_email" | "reengage",
): Promise<string> {
  const name = client.name?.trim() || "there";
  const first = name.split(/\s+/)[0] || "there";
  const stage = (client.status ?? "new").replace(/_/g, " ");
  const town = client.town?.trim() || "your area";
  const budgetMin = client.budget_min;
  const budgetMax = client.budget_max;
  let budgetLine = "";
  if (budgetMin != null && budgetMax != null) {
    budgetLine = `$${Math.round(budgetMin / 1000)}k–$${Math.round(budgetMax / 1000)}k`;
  } else if (budgetMax != null) {
    budgetLine = `up to $${Math.round(budgetMax / 1000)}k`;
  } else {
    budgetLine = "their range";
  }
  const days = daysSinceLastContact(client.last_engagement_at);

  const scenario =
    kind === "welcome"
      ? "Day-1 welcome text after a new lead"
      : kind === "followup_email"
        ? "Short SMS that tees up a follow-up email (the SMS should stand alone and feel personal)"
        : "Day-14 re-engagement text to restart the conversation";

  const system = `You are a top New Jersey real estate agent texting a client from your phone. 
Write ONE text message only: conversational, warm, concise (max ~320 characters). 
No emojis unless they feel natural. No bullet points. No "Hope this finds you well" fluff.
Do not mention that you are an AI. Sound human.`;

  const user = `Write the SMS.

Scenario: ${scenario}
Client first name (use naturally): ${first}
Full name (for context only): ${name}
Pipeline stage: ${stage}
Preferred town/area: ${town}
Budget context: ${budgetLine}
Days since last contact: ${days}

Return ONLY the message text, nothing else.`;

  const anthropic = getAnthropic();
  if (!anthropic) {
    return `Hey ${first} — been thinking about your search in ${town}. Want to catch up this week? I’ve got a couple new things that might fit ${budgetLine}.`;
  }

  const msg = await anthropic.messages.create({
    model: INBOX_DRAFT_MODEL,
    max_tokens: 400,
    system,
    messages: [{ role: "user", content: user }],
  });
  const block = msg.content[0];
  const text = block && block.type === "text" ? block.text.trim() : "";
  if (!text) {
    return `Hey ${first} — circling back on ${town}. Still in the market around ${budgetLine}? I can send a few fresh listings if you’re game.`;
  }
  return text;
}

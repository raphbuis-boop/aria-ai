import Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, sanitizeDraft } from "@/lib/ai";

/**
 * Claude calls behind the Aria SMS lead flow. Every call uses structured
 * outputs so the JSON is schema-valid, and returns `null` on any failure
 * (API error, refusal, missing key). Callers treat `null` as "don't text the
 * client; tell the agent" — Aria never falls back to a canned auto-reply.
 */
const MODEL = "claude-opus-5";
const SMS_MAX = 480;

/** Occasionally the model double-escapes non-ASCII in JSON output, leaving a
 * literal "\u00b7" in the string. Decode those so the client never sees them. */
function decodeLiteralEscapes(text: string): string {
  return text.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) =>
    String.fromCharCode(parseInt(hex, 16)),
  );
}

function cleanSms(text: string): string {
  return sanitizeDraft(decodeLiteralEscapes(text)).slice(0, SMS_MAX);
}

async function structured<T>(
  system: string,
  user: string,
  schema: Record<string, unknown>,
  maxTokens = 2000,
): Promise<T | null> {
  const client = getAnthropic();
  if (!client) {
    console.error("[sms/claude] ANTHROPIC_API_KEY not set");
    return null;
  }
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      thinking: { type: "adaptive" },
      // SMS turnaround matters more than depth; these are short, bounded tasks.
      output_config: { effort: "low", format: { type: "json_schema", schema } },
      system,
      messages: [{ role: "user", content: user }],
    });
    if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") {
      console.error("[sms/claude] unusable stop_reason", response.stop_reason);
      return null;
    }
    const text = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text",
    );
    return text ? (JSON.parse(text.text) as T) : null;
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(`[sms/claude] API error ${error.status}:`, error.message);
    } else {
      console.error("[sms/claude] failed", error);
    }
    return null;
  }
}

const VOICE = `You text on behalf of a solo New Jersey real-estate agent, as "Aria", their assistant.
Voice: warm, specific, unhurried, plain. No emoji, no slang, no exclamation marks, no markdown.
Refer to the agent by first name only; never use pronouns (he/she/they) for the agent.
Never invent listings, prices, availability, or times. Never claim a showing is booked or say "I have you down" — only the agent can confirm one.
Never give legal, lending, or commission advice.`;

// ── First touch ──────────────────────────────────────────────────────────

export type FirstTouchInput = {
  agentName: string;
  clientFirstName: string;
  source: string | null;
  leadMessage: string | null;
  town: string | null;
  propertyAddress: string | null;
};

export async function draftFirstTouchSms(
  input: FirstTouchInput,
): Promise<string | null> {
  const system = `${VOICE}
Write the very first text to a new buyer lead who just reached out. Introduce yourself as Aria, texting for ${input.agentName}.
Acknowledge what they asked about, if anything. Ask exactly one easy question (what they're looking for, or when they hope to move).
Under 300 characters. End with: "Reply STOP to opt out."`;
  const out = await structured<{ smsBody: string }>(
    system,
    JSON.stringify(input),
    {
      type: "object",
      properties: { smsBody: { type: "string" } },
      required: ["smsBody"],
      additionalProperties: false,
    },
  );
  const body = out?.smsBody ? cleanSms(out.smsBody) : "";
  return body || null;
}

// ── Profile extraction ───────────────────────────────────────────────────

export type ClientProfile = {
  name: string;
  town: string | null;
  preferred_towns: string[] | null;
  budget_min: number | null;
  budget_max: number | null;
  beds_wanted: number | null;
  baths_wanted: number | null;
  timeline: string | null;
  notes: string | null;
};

export type ProfileUpdates = {
  full_name: string | null;
  budget_min: number | null;
  budget_max: number | null;
  preferred_towns: string[] | null;
  beds_wanted: number | null;
  baths_wanted: number | null;
  timeline: string | null;
  new_note: string | null;
};

const nullable = (type: string) => ({ type: [type, "null"] });

/** Pulls durable buyer-criteria facts out of the latest inbound text, in the
 * context of the thread. Only returns fields the client actually stated or
 * changed; everything else is null so the existing profile is kept. */
export async function extractProfileUpdates(input: {
  profile: ClientProfile;
  history: ThreadMessage[];
  latestMessage: string;
}): Promise<ProfileUpdates | null> {
  const system = `You update a real-estate buyer's CRM profile from their latest text message.
Return a field ONLY if the latest message states or changes it; otherwise null. Never guess.
- Budgets are whole US dollars: "450k" = 450000, "1M" or "a million" = 1000000, "under 600" in a home-search context = 600000. A single number is budget_max. Approximate wording ("about", "around", "up to roughly") still counts — use the number they gave.
- preferred_towns: New Jersey town names as the client said them, full replacement list if they changed their mind.
- timeline: short phrase, e.g. "within 3 months", "spring 2027".
- full_name: only if the client tells you their name (e.g. "this is Dana Reyes"); else null.
- new_note: one short sentence for anything else durable (must-haves, pre-approval status, pets, schools). Null if nothing.`;
  return structured<ProfileUpdates>(
    system,
    JSON.stringify(input),
    {
      type: "object",
      properties: {
        full_name: nullable("string"),
        budget_min: nullable("integer"),
        budget_max: nullable("integer"),
        preferred_towns: { type: ["array", "null"], items: { type: "string" } },
        beds_wanted: nullable("integer"),
        baths_wanted: nullable("number"),
        timeline: nullable("string"),
        new_note: nullable("string"),
      },
      required: [
        "full_name", "budget_min", "budget_max", "preferred_towns", "beds_wanted",
        "baths_wanted", "timeline", "new_note",
      ],
      additionalProperties: false,
    },
  );
}

// ── Conversation reply ───────────────────────────────────────────────────

export type ThreadMessage = { direction: string | null; body: string | null; at: string };

export type CandidateProperty = {
  id: string;
  address: string;
  town: string | null;
  price: number | null;
  beds: number | null;
  baths: number | null;
  score: number;
  already_sent: boolean;
};

export type ReplyInput = {
  agentName: string;
  now: string;
  profile: ClientProfile;
  history: ThreadMessage[];
  latestMessage: string;
  candidates: CandidateProperty[];
  openShowingRequests: Array<{ address: string | null; requested_time_text: string | null }>;
  upcomingShowings: Array<{ address: string | null; showing_date: string | null }>;
  bbaSigned: boolean;
};

export type ShowingRequest = {
  property_id: string | null;
  address: string | null;
  requested_time_text: string;
  requested_time_iso: string | null;
};

export type DraftedReply = {
  smsBody: string;
  intent: "qualify" | "recommend" | "schedule" | "nurture" | "handoff";
  rationale: string;
  recommended_property_ids: string[];
  showing_request: ShowingRequest | null;
};

export async function draftConversationReply(
  input: ReplyInput,
): Promise<DraftedReply | null> {
  const system = `${VOICE}
You are mid-conversation with a buyer. Write the next text, reacting to their latest message.
Goals, in order: answer what they asked; learn budget, towns, beds and timeline if still unknown (one question at a time, never re-ask something answered); once there's enough to go on, recommend homes; move toward a showing.

Recommending homes:
- You may ONLY mention homes from "candidates" (the agent's active inventory, pre-scored for fit). Put their ids in recommended_property_ids.
- Recommend at most 2 per text. Prefer candidates with already_sent=false. Mention address, price and beds compactly (e.g. "44 Park St, Montclair, $715k, 3 bd").
- If no candidate fits, say the agent will keep an eye out; do not invent one.

Showings:
- If the client asks to see a home, set showing_request. property_id must be a candidate id if they mean one of those homes (else null, with the address they gave).
- requested_time_text is their words ("Saturday afternoon"). requested_time_iso is an ISO 8601 datetime with a -04:00/-05:00 America/New_York offset ONLY if they gave a specific day AND time you can resolve against "now"; else null.
- If they want a showing but gave no time, still set showing_request and ask for a day and time in the reply.
- The reply must say you'll confirm the time with ${input.agentName} and text back. Never say it's booked.
- If there is already an open request for the same home, don't create another; just reassure them.
- Set intent "handoff" (and a brief, kind reply) if they ask something only the agent should handle, are upset, or want to talk to a person.

If "history" contains no earlier text from you, this person texted first: introduce yourself as Aria, texting for ${input.agentName}, and end with "Reply STOP to opt out."

Keep smsBody under 320 characters unless listing two homes (max 480).`;

  const out = await structured<DraftedReply>(
    system,
    JSON.stringify(input),
    {
      type: "object",
      properties: {
        smsBody: { type: "string" },
        intent: { type: "string", enum: ["qualify", "recommend", "schedule", "nurture", "handoff"] },
        rationale: { type: "string" },
        recommended_property_ids: { type: "array", items: { type: "string" } },
        showing_request: {
          anyOf: [
            { type: "null" },
            {
              type: "object",
              properties: {
                property_id: nullable("string"),
                address: nullable("string"),
                requested_time_text: { type: "string" },
                requested_time_iso: nullable("string"),
              },
              required: ["property_id", "address", "requested_time_text", "requested_time_iso"],
              additionalProperties: false,
            },
          ],
        },
      },
      required: ["smsBody", "intent", "rationale", "recommended_property_ids", "showing_request"],
      additionalProperties: false,
    },
    3000,
  );
  if (!out) return null;

  const smsBody = cleanSms(out.smsBody ?? "");
  if (!smsBody) return null;

  // Structured outputs guarantee shape, not truth — drop any id Claude made up.
  const validIds = new Set(input.candidates.map((c) => c.id));
  const showing = out.showing_request;
  if (showing && showing.property_id && !validIds.has(showing.property_id)) {
    showing.property_id = null;
  }
  if (showing?.requested_time_iso && Number.isNaN(Date.parse(showing.requested_time_iso))) {
    showing.requested_time_iso = null;
  }

  return {
    ...out,
    smsBody,
    recommended_property_ids: out.recommended_property_ids.filter((id) => validIds.has(id)),
  };
}

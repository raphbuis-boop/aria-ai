import { NextResponse } from "next/server";
import { callClaude, getAnthropic, sanitizeDraft } from "@/lib/ai";
import { getRouteSupabase } from "@/lib/api-auth";

const DRAFT_RULES = `Rules:
- Plain text only. No markdown, bullets, labels, or "Draft:" / "SMS:" prefixes.
- Never use bracket placeholders like [name] or [town] — use real values or leave them out.
- No commentary, explanations, or subject lines.
- Sound like a real person texting from their phone. Warm, concise, natural.
- Return ONLY the message text.`;

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { supabase, user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const clientName = String(body.clientName ?? "there");
  const context = String(body.context ?? "");
  const scenario = String(body.scenario ?? "");
  const voiceSamples = Array.isArray(body.voiceSamples)
    ? body.voiceSamples.map(String)
    : [];
  const clientId = body.clientId as string | undefined;
  const skipInsert = Boolean(body.skipInsert);
  const propertyContext = body.propertyContext
    ? String(body.propertyContext)
    : "";
  const matchPing = Boolean(body.matchPing);

  const firstName = clientName.split(/\s+/)[0] || "there";

  const samplesBlock = voiceSamples
    .map((s: string, i: number) => `Sample ${i + 1}: ${s}`)
    .join("\n");

  const system = matchPing
    ? `You ghost-write a single SMS for a New Jersey real estate agent introducing a specific property to a buyer client.
Keep it under 320 characters. Conversational — the agent knows this client personally.
${DRAFT_RULES}`
    : `You are ghostwriting a text message for a real estate agent. Match their tone from the provided samples.
1–3 sentences max. If property context is provided, introduce it naturally.
${DRAFT_RULES}`;

  const userMsg = matchPing
    ? `Client first name: ${firstName}
Property details:
${propertyContext || context}

Write ONE warm SMS introducing this property. Under 320 characters.`
    : `Client: ${clientName}
Scenario: ${scenario}
Context: ${context}${propertyContext ? `\nProperty: ${propertyContext}` : ""}

Voice samples (match this tone):
${samplesBlock || "(no samples — use warm, concise NJ agent tone)"}

Write ONE short text message.`;

  let draft = sanitizeDraft(await callClaude(system, userMsg, matchPing ? 220 : 150));

  if (!getAnthropic() || !draft) {
    // Safe generic fallback — no hardcoded towns or fabricated listing details
    draft = matchPing
      ? `Hey ${firstName} — found a property that might check your boxes. Want me to send the details?`
      : `Hey ${firstName} — just wanted to check in on your search. Any availability to connect this week?`;
  }

  if (clientId && !skipInsert) {
    await supabase.from("activities").insert({
      client_id: clientId,
      agent_id: user.id,
      type: "text",
      body: draft,
      ai_draft: true,
      approved: false,
      sent: false,
    });
  }

  return NextResponse.json({ draft });
}

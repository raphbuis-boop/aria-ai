import { NextResponse } from "next/server";
import { callClaude, getAnthropic, safeJsonParse } from "@/lib/ai";
import { getRouteSupabase } from "@/lib/api-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface DraftEmailBody {
  clientId?: string;
  clientName?: string;
  clientFirstName?: string;
  scenario?: string;
  context?: string;
  propertyContext?: string;
  voiceSamples?: string[];
}

interface DraftResponse {
  subject: string;
  body: string;
}

export async function POST(req: Request) {
  const { user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as DraftEmailBody;
  const clientName = String(body.clientName ?? "there");
  const first =
    body.clientFirstName?.trim() ||
    clientName.split(/\s+/)[0] ||
    "there";
  const scenario = String(body.scenario ?? "Warm follow-up");
  const context = String(body.context ?? "");
  const propertyContext = String(body.propertyContext ?? "");
  const voiceSamples = Array.isArray(body.voiceSamples)
    ? body.voiceSamples.filter((s): s is string => typeof s === "string")
    : [];

  const samplesBlock =
    voiceSamples.length > 0
      ? voiceSamples.map((s, i) => `Sample ${i + 1}: ${s}`).join("\n")
      : "(no samples — warm, professional NJ real-estate agent tone)";

  const system = `You ghost-write a single email for a New Jersey real-estate agent.
Return STRICT JSON in the shape { "subject": "...", "body": "..." } — no other text, no markdown fences.
• Subject: 4–9 words, concrete, specific, avoid clickbait.
• Body: HTML. Use <p> paragraphs. Allowed tags: <p>, <b>, <i>, <a>, <ul>, <li>. 90–180 words.
• Tone: human, warm, confident. Match the agent's voice samples exactly if provided.
• Do NOT invent property details that weren't provided. Do NOT include a signature — the app appends it.
• Reference the client by first name.`;

  const userMsg = `Client: ${clientName} (first name: ${first})
Scenario: ${scenario}
Context: ${context || "(none)"}
Property: ${propertyContext || "(none)"}

Voice samples:
${samplesBlock}

Write the email now.`;

  let raw = "";
  try {
    raw = await callClaude(system, userMsg, 600);
  } catch {
    raw = "";
  }

  if (!getAnthropic() || !raw.trim()) {
    return NextResponse.json({
      subject: `Quick note, ${first}`,
      body: `<p>Hi ${first},</p><p>Wanted to quickly check in — do you have a few minutes this week to talk through your next steps? Happy to line up options whenever works for you.</p>`,
      fallback: true,
    });
  }

  const parsed = safeJsonParse<DraftResponse>(raw);
  if (parsed && parsed.subject && parsed.body) {
    return NextResponse.json({
      subject: parsed.subject.trim(),
      body: parsed.body.trim(),
    });
  }

  // Claude didn't return valid JSON — surface the raw text as body with a
  // generic subject so the agent can salvage something.
  return NextResponse.json({
    subject: `Quick note, ${first}`,
    body: `<p>${raw
      .replace(/</g, "&lt;")
      .replace(/\n\n+/g, "</p><p>")
      .replace(/\n/g, "<br/>")}</p>`,
    raw: true,
  });
}

import { NextResponse } from "next/server";
import { callClaude, getAnthropic } from "@/lib/ai";
import { getRouteSupabase } from "@/lib/api-auth";

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

  const samplesBlock = voiceSamples
    .map((s: string, i: number) => `Sample ${i + 1}: ${s}`)
    .join("\n");

  const system =
    "You are ghostwriting a text message for a real estate agent. Match their tone exactly from the 5 samples. 1-3 sentences max. If propertyContext provided, introduce the property naturally. Return ONLY the message.";

  const userMsg = `Client: ${clientName}\nScenario: ${scenario}\nContext: ${context}\nProperty: ${propertyContext}\n\nVoice samples:\n${samplesBlock || "(no samples — warm NJ agent tone)"}`;

  let draft = await callClaude(system, userMsg, 150);
  if (!getAnthropic() || !draft.trim()) {
    draft = `Hey ${clientName.split(" ")[0] || "there"} — quick check-in on your search. I’ve got a Ridgewood option that lines up with what you wanted; want me to send details?`;
  }

  if (clientId && !skipInsert) {
    await supabase.from("activities").insert({
      client_id: clientId,
      agent_id: user.id,
      type: "text",
      body: draft.trim(),
      ai_draft: true,
      approved: false,
      sent: false,
    });
  }

  return NextResponse.json({ draft: draft.trim() });
}

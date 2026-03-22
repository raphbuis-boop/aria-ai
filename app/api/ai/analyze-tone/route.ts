import { NextResponse } from "next/server";
import { callClaude, getAnthropic } from "@/lib/ai";
import { getRouteSupabase } from "@/lib/api-auth";

export async function POST(req: Request) {
  const { user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const voiceSamples = Array.isArray(body.voiceSamples)
    ? body.voiceSamples.map(String)
    : [];

  const system =
    "Analyze these 5 texts. Return 1-2 sentence description of tone, style, emoji use, formality.";

  const userMsg = voiceSamples.join("\n---\n");

  let analysis = await callClaude(system, userMsg, 200);
  if (!getAnthropic() || !analysis.trim()) {
    analysis =
      "Warm, concise, and confident — light punctuation, occasional emoji optional, professional-but-friendly NJ agent voice.";
  }

  return NextResponse.json({ analysis: analysis.trim() });
}

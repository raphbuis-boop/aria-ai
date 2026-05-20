import { NextResponse } from "next/server";
import { callClaude } from "@/lib/ai";
import { getRouteSupabase } from "@/lib/api-auth";

export async function POST(req: Request) {
  const { user } = await getRouteSupabase();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const question = String(body.question ?? "");

  const system =
    "You are Aria, a voice AI assistant for a real estate agent. Reply in ONE short sentence — 15 words max. No lists, no markdown, no filler. Direct and warm.";

  const reply = await callClaude(system, question, 80);

  return NextResponse.json({ reply });
}

import { NextResponse } from "next/server";
import { callClaude, getAnthropic } from "@/lib/ai";
import { getRouteSupabase } from "@/lib/api-auth";

export async function POST(req: Request) {
  const { user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const question = String(body.question ?? "");
  const context = String(body.context ?? "");
  const history = Array.isArray(body.history) ? body.history : [];

  const histText = history
    .slice(-6)
    .map(
      (h: { role?: string; content?: string }) =>
        `${h.role ?? "user"}: ${h.content ?? ""}`,
    )
    .join("\n");

  const system =
    "You are Aria, an AI real estate CRM assistant for a New Jersey agent. Concise, warm, action-oriented. Always end with one specific suggested next action.";

  const userMsg = `Context:\n${context}\n\nPrior messages:\n${histText}\n\nQuestion:\n${question}`;

  let reply = await callClaude(system, userMsg, 500);
  if (!getAnthropic() || !reply.trim()) {
    reply =
      "Here’s a quick take: prioritize your hottest leads first, then follow up with anyone who toured in the last 48 hours. Next action: send one personalized check-in text to your top Ridgewood buyer before noon.";
  }

  return NextResponse.json({ reply });
}

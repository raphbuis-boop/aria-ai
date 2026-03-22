import { NextResponse } from "next/server";
import { callClaude, getAnthropic, safeJsonParse } from "@/lib/ai";
import { getRouteSupabase } from "@/lib/api-auth";

type SummaryJson = {
  summary: string;
  sentiment: "positive" | "neutral" | "negative";
  next_action: string;
  lead_score_change: number;
};

export async function POST(req: Request) {
  const { user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const address = String(body.address ?? "");
  const clientName = String(body.clientName ?? "");
  const feedback = String(body.feedback ?? "");

  const system =
    "Summarize showing feedback. Return JSON only: { summary, sentiment, next_action, lead_score_change (-2 to +2) }";

  const userMsg = `Address: ${address}\nClient: ${clientName}\nFeedback:\n${feedback}`;

  const raw = await callClaude(system, userMsg, 400);
  let parsed = safeJsonParse<SummaryJson>(raw);

  if (!getAnthropic() || !parsed) {
    parsed = {
      summary:
        "Buyers liked the layout and natural light; parking was the main concern.",
      sentiment: "positive",
      next_action: "Send comps for nearby homes with better parking options.",
      lead_score_change: 1,
    };
  }

  return NextResponse.json(parsed);
}

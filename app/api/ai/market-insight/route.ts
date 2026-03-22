import { NextResponse } from "next/server";
import { callClaude, getAnthropic } from "@/lib/ai";
import { getRouteSupabase } from "@/lib/api-auth";

export async function POST(req: Request) {
  const { user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const town = String(body.town ?? "");
  const stats = body.stats ?? {};

  const system =
    "NJ real estate market expert. Write 2-3 sentence insight from stats. End with one actionable recommendation.";

  const userMsg = `Town: ${town}\nStats JSON:\n${JSON.stringify(stats)}`;

  let insight = await callClaude(system, userMsg, 400);
  if (!getAnthropic() || !insight.trim()) {
    insight = `${town} remains competitive: inventory is tight and well-priced homes move quickly. Buyers should be pre-approved and ready to decide fast. Recommendation: preview two backups this weekend so you’re not starting from scratch if you lose a bid.`;
  }

  return NextResponse.json({ insight: insight.trim() });
}

import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { supabase, user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const itemId = String(body.itemId ?? "").trim();
  // Default snooze: 24h. Pass hours: 168 for 7-day dismiss.
  const hours = typeof body.hours === "number" ? Math.min(body.hours, 168) : 24;

  if (!itemId) {
    return NextResponse.json({ error: "itemId required" }, { status: 400 });
  }

  const dismissUntil = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

  // Upsert — re-dismissing the same item extends the snooze
  const { error } = await supabase
    .from("dismissed_opportunities")
    .upsert(
      { agent_id: user.id, item_id: itemId, dismiss_until: dismissUntil },
      { onConflict: "agent_id,item_id" },
    );

  if (error) {
    console.error("[dismiss] upsert error:", error);
    return NextResponse.json({ error: "Failed to dismiss" }, { status: 500 });
  }

  return NextResponse.json({ dismissed: true, until: dismissUntil });
}

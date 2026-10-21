import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/whatsapp/unknown — "New number messaged you — add as client?"
 * cards: only the number and the first line, for 24 hours.
 */
export async function GET() {
  const { supabase, user } = await getRouteSupabase();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const now = new Date().toISOString();
  // Expired cards are gone for good.
  await supabase.from("whatsapp_unknown_senders").delete().eq("agent_id", user.id).lt("expires_at", now);
  const { data } = await supabase
    .from("whatsapp_unknown_senders")
    .select("id, phone, first_line, received_at")
    .eq("agent_id", user.id)
    .gt("expires_at", now)
    .order("received_at", { ascending: false })
    .limit(10);
  return NextResponse.json({
    cards: (data ?? []).map((c) => ({ id: c.id, phone: c.phone, firstLine: c.first_line, receivedAt: c.received_at })),
  });
}

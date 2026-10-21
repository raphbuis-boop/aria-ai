import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { requestSync } from "@/lib/whatsapp/graph";
import { SYNC_WINDOW_MS, loadConnectionWithToken } from "@/lib/whatsapp/connection";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/whatsapp/history — bring in past chats (up to 6 months) after
 * connecting. WhatsApp allows this once, within 24 hours of connecting, and
 * asks her to confirm in the WhatsApp Business app. Only chats with existing
 * clients are kept when the history arrives.
 */
export async function POST() {
  const { user } = await getRouteSupabase();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conn = await loadConnectionWithToken(user.id).catch(() => null);
  if (!conn || conn.status === "disconnected") return NextResponse.json({ error: "Connect WhatsApp first" }, { status: 400 });
  if (conn.history_requested_at) return NextResponse.json({ error: "Past chats were already requested" }, { status: 409 });
  if (Date.now() - Date.parse(conn.connected_at) > SYNC_WINDOW_MS) {
    return NextResponse.json({ error: "WhatsApp only allows this within 24 hours of connecting." }, { status: 409 });
  }

  try {
    await requestSync(conn.token, conn.phone_number_id, "history");
  } catch (e) {
    console.error("[whatsapp/history] request failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "WhatsApp didn't accept the request. Try again." }, { status: 502 });
  }
  const now = new Date().toISOString();
  await createAdminClient()
    .from("whatsapp_connections")
    .update({ history_requested_at: now, history_status: "requested", updated_at: now })
    .eq("agent_id", user.id);
  return NextResponse.json({ ok: true });
}

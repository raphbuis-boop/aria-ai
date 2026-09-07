import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Public endpoint: the per-client portal (unauthenticated) posts behavioral
// events here. We resolve the client from their portal_token — never trusting a
// client_id from the body — and insert via the service-role admin client.
// Fail-soft everywhere: a logging failure must never break the portal.
const ALLOWED = new Set([
  "portal_open",
  "view",
  "favorite",
  "inquiry",
  "search",
  "alert_open",
]);

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const token = String(body.token ?? "").trim();
  const eventType = String(body.event_type ?? "").trim();

  if (!token || !ALLOWED.has(eventType)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: client } = await admin
    .from("clients")
    .select("id, agent_id")
    .eq("portal_token", token)
    .maybeSingle();

  if (!client) {
    // Unknown token — return ok:false but 200 so the beacon never surfaces an error.
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  const { error } = await admin.from("client_engagement_events").insert({
    agent_id: client.agent_id,
    client_id: client.id,
    event_type: eventType,
    listing_id: body.listing_id ? String(body.listing_id) : null,
    listing_address: body.listing_address ? String(body.listing_address) : null,
    mls_number: body.mls_number ? String(body.mls_number) : null,
    metadata:
      body.metadata && typeof body.metadata === "object" ? body.metadata : {},
  });

  // Fail-soft: even an insert error (e.g. table not migrated yet) returns 200.
  if (error) return NextResponse.json({ ok: false }, { status: 200 });
  return NextResponse.json({ ok: true });
}

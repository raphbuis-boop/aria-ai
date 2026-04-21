import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// GET /api/bba/[clientId]
// Returns the signed BBA for a client, or null. Public (no auth) so the
// signing page can show the current state to an unauthenticated client.
// We still scope by client_id only — no sensitive signature data is returned.
export async function GET(
  _req: Request,
  { params }: { params: { clientId: string } },
) {
  const admin = createAdminClient();

  const { data: client } = await admin
    .from("clients")
    .select("id, name, agent_id")
    .eq("id", params.clientId)
    .maybeSingle();

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const { data: agentProfile } = await admin
    .from("agent_profiles")
    .select("full_name")
    .eq("id", client.agent_id)
    .maybeSingle();

  const { data: bba } = await admin
    .from("buyer_broker_agreements")
    .select("id, signed_at, commission_pct, term_start, term_end, search_area, client_name, agent_name")
    .eq("client_id", params.clientId)
    .order("signed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    client: { id: client.id, name: client.name },
    agent: { name: agentProfile?.full_name ?? "Your Aria agent" },
    bba: bba ?? null,
  });
}

// POST /api/bba/[clientId]
// Creates a signed BBA. Accepts signature from either the authenticated
// agent or an unauthenticated client signing at a showing (via the public
// /bba/sign link). In the second case we use the admin client but derive
// agent_id from the client record, so callers cannot spoof ownership.
export async function POST(
  req: Request,
  { params }: { params: { clientId: string } },
) {
  const body = await req.json().catch(() => ({}));

  const clientName = String(body.clientName ?? "").trim();
  const agentName = String(body.agentName ?? "").trim();
  const commissionPct = Number(body.commissionPct ?? 2.5);
  const termStart = String(body.termStart ?? "").trim();
  const termEnd = String(body.termEnd ?? "").trim();
  const searchArea = String(body.searchArea ?? "").trim() || null;
  const signatureData = String(body.signatureData ?? "");

  if (!clientName || !agentName || !termStart || !termEnd || !signatureData) {
    return NextResponse.json(
      { error: "clientName, agentName, termStart, termEnd, signatureData required" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: client } = await admin
    .from("clients")
    .select("id, agent_id")
    .eq("id", params.clientId)
    .maybeSingle();

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  // Upsert so re-signing replaces the current agreement (unique index on client_id).
  const { data, error } = await admin
    .from("buyer_broker_agreements")
    .upsert(
      {
        client_id: client.id,
        agent_id: client.agent_id,
        agent_name: agentName,
        client_name: clientName,
        commission_pct: commissionPct,
        term_start: termStart,
        term_end: termEnd,
        search_area: searchArea,
        signature_data: signatureData,
        signed_at: new Date().toISOString(),
        ip_address:
          req.headers.get("x-forwarded-for") ??
          req.headers.get("x-real-ip") ??
          null,
        user_agent: req.headers.get("user-agent") ?? null,
      },
      { onConflict: "client_id" },
    )
    .select("id, signed_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Log an activity on the client's timeline (best-effort).
  await admin.from("activities").insert({
    client_id: client.id,
    agent_id: client.agent_id,
    type: "note",
    body: `Buyer Broker Agreement signed by ${clientName} (${commissionPct}% · ${termStart} → ${termEnd}).`,
    ai_draft: false,
    approved: true,
    sent: false,
  });

  return NextResponse.json({ ok: true, id: data.id, signed_at: data.signed_at });
}

// DELETE /api/bba/[clientId]
// Agent can revoke an agreement. Authed only.
export async function DELETE(
  _req: Request,
  { params }: { params: { clientId: string } },
) {
  const { supabase, user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { error } = await supabase
    .from("buyer_broker_agreements")
    .delete()
    .eq("client_id", params.clientId)
    .eq("agent_id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

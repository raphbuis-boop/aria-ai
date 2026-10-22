import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Buyers sign through /api/bba/sign/[token] (agent-set terms behind an
// expiring, single-use link) — this route no longer serves anything public.

/**
 * DELETE /api/bba/[clientId]
 * The agent revokes the client's current agreement. A signed agreement is a
 * record, so it is marked revoked (superseded_reason = 'revoked'), never
 * deleted; the client then has no current BBA until they sign a new one.
 */
export async function DELETE(_req: Request, props: { params: Promise<{ clientId: string }> }) {
  const params = await props.params;
  const { supabase, user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("id", params.clientId)
    .eq("agent_id", user.id)
    .maybeSingle();
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  // Agents can't write agreements under RLS; the server records the revocation.
  const { data, error } = await createAdminClient()
    .from("buyer_broker_agreements")
    .update({ superseded_at: new Date().toISOString(), superseded_reason: "revoked" })
    .eq("client_id", params.clientId)
    .eq("agent_id", user.id)
    .is("superseded_at", null)
    .select("id");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!data?.length) {
    return NextResponse.json({ error: "No current agreement to revoke" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

// Buyers sign through /api/bba/sign/[token] (agent-set terms behind an
// expiring, single-use link) — this route no longer serves anything public.

/**
 * DELETE /api/bba/[clientId]
 * Agent can revoke an agreement. Authed only.
 */
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

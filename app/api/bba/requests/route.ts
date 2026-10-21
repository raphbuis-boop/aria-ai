import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { bbaTermsError, issueBbaRequest } from "@/lib/bba";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/bba/requests { clientId, commissionPct, termStart, termEnd, searchArea? }
 * The agent sets the Buyer Broker Agreement terms and gets a signing link
 * (/bba/sign/<token>) that expires in 7 days and works once. Any earlier
 * open link for the client stops working.
 */
export async function POST(req: Request) {
  const { supabase, user } = await getRouteSupabase();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const clientId = String(body.clientId ?? "");
  const terms = {
    commissionPct: Number(body.commissionPct),
    termStart: String(body.termStart ?? "").trim(),
    termEnd: String(body.termEnd ?? "").trim(),
    searchArea: String(body.searchArea ?? "").trim().slice(0, 200) || null,
  };

  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("agent_id", user.id)
    .maybeSingle();
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const invalid = bbaTermsError(terms);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  // Ownership is checked above; the admin client also sees brokerage
  // templates uploaded by other agents in the same brokerage.
  const result = await issueBbaRequest(createAdminClient(), { clientId, agentId: user.id, ...terms });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  const r = result.request;
  return NextResponse.json({
    request: {
      token: r.token,
      commission_pct: Number(r.commission_pct),
      term_start: r.term_start,
      term_end: r.term_end,
      search_area: r.search_area,
      expires_at: r.expires_at,
    },
  });
}

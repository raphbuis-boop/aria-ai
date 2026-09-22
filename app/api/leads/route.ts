import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestLead, LeadError } from "@/lib/sms/lead";
import { normalizeLeadSource, parseLeadPayload } from "@/lib/sms/lead-sources";
import { bearerMatches, defaultLeadAgentId } from "@/lib/sms/lead-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/leads[?source=zillow|realtor|website|referral|manual|google|meta&agentId=…]
 *
 * A lead came in. Creates or finds the client and has Aria text them.
 *
 * Auth, either:
 *  - a signed-in agent (the lead is theirs; source defaults to "manual"), or
 *  - `Authorization: Bearer $LEAD_WEBHOOK_SECRET` from a lead source/partner;
 *    the agent is `agentId` (query or body) or LEAD_DEFAULT_AGENT_ID.
 *
 * Body: the provider's JSON payload (Zillow / Realtor.com shapes are
 * recognized), or a flat { name, phone, email?, message?, town?, budgetMax?,
 * propertyAddress?, eventId? }. Meta Lead Ads use /api/leads/meta instead.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  let agentId: string | null;
  let fromAgent = false;
  if (bearerMatches(request)) {
    agentId =
      url.searchParams.get("agentId") ??
      (typeof body.agentId === "string" ? body.agentId : null) ??
      defaultLeadAgentId();
    if (!agentId) {
      return NextResponse.json({ error: "agentId required (or set LEAD_DEFAULT_AGENT_ID)" }, { status: 400 });
    }
  } else {
    const { user } = await getRouteSupabase();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    agentId = user.id;
    fromAgent = true;
  }

  const source = normalizeLeadSource(
    url.searchParams.get("source") ?? body.source ?? (fromAgent ? "manual" : "other"),
  );
  const lead = parseLeadPayload(source, body);

  try {
    const result = await ingestLead(createAdminClient(), {
      agentId,
      source,
      ...lead,
      // Partners must say the lead agreed to texts; agents attest for their own.
      autoText: fromAgent || body.smsConsent !== false,
    });
    return NextResponse.json({ ok: true, ...result }, { status: result.created ? 201 : 200 });
  } catch (error) {
    if (error instanceof LeadError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[leads] ingest failed", error);
    return NextResponse.json({ error: "Could not ingest lead" }, { status: 500 });
  }
}

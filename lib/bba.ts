import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/** A signing link works for this long after the agent creates it. */
export const BBA_LINK_TTL_DAYS = 7;

/** Agent-set terms behind a signing link (public.bba_requests). */
export type BbaRequest = {
  id: string;
  token: string;
  client_id: string;
  agent_id: string;
  agent_name: string;
  commission_pct: number;
  term_start: string;
  term_end: string;
  search_area: string | null;
  template_id: string | null;
  expires_at: string;
  signed_at: string | null;
  voided_at: string | null;
};

export const BBA_REQUEST_COLUMNS =
  "id, token, client_id, agent_id, agent_name, commission_pct, term_start, term_end, search_area, template_id, expires_at, signed_at, voided_at";

export type BbaTerms = {
  commissionPct: number;
  termStart: string;
  termEnd: string;
  searchArea: string | null;
};

/** Public signing page for a request token. */
export function bbaSigningUrl(token: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://getariaai.com").replace(/\/$/, "");
  return `${base}/bba/sign/${token}`;
}

/** Tokens are 32 url-safe characters; anything else is rejected before a lookup. */
export function isBbaToken(value: string): boolean {
  return /^[A-Za-z0-9_-]{32}$/.test(value);
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** Validates agent-entered terms. Returns an error message, or null when valid. */
export function bbaTermsError(t: BbaTerms): string | null {
  if (!Number.isFinite(t.commissionPct) || t.commissionPct <= 0 || t.commissionPct > 10) {
    return "Commission must be between 0 and 10%";
  }
  if (!YMD.test(t.termStart) || !YMD.test(t.termEnd) || Number.isNaN(Date.parse(t.termStart)) || Number.isNaN(Date.parse(t.termEnd))) {
    return "Term start and end dates are required";
  }
  if (t.termEnd <= t.termStart) return "Term end must be after the start";
  if (t.termEnd < new Date().toISOString().slice(0, 10)) return "Term end is in the past";
  return null;
}

/** Why a request can't be signed, or null when it can. */
export function bbaRequestClosedReason(r: Pick<BbaRequest, "signed_at" | "voided_at" | "expires_at">): string | null {
  if (r.signed_at) return "This agreement was already signed with this link.";
  if (r.voided_at) return "This link was replaced by a newer one. Please use the latest link from your agent.";
  if (new Date(r.expires_at).getTime() <= Date.now()) return "This signing link has expired.";
  return null;
}

/**
 * Creates a signing link with the agent's terms and voids any still-open link
 * for the same client, so only the latest terms can be signed. The agent's
 * name and default brokerage template are captured with the terms.
 */
export async function issueBbaRequest(
  supabase: SupabaseClient,
  input: { clientId: string; agentId: string } & BbaTerms,
): Promise<{ ok: true; request: BbaRequest } | { ok: false; status: number; error: string }> {
  const { data: agent } = await supabase
    .from("agent_profiles")
    .select("full_name, brokerage_id")
    .eq("id", input.agentId)
    .maybeSingle();
  const agentName = (agent?.full_name as string | null)?.trim();
  if (!agentName) {
    return { ok: false, status: 400, error: "Add your name in Settings first — it goes on the agreement." };
  }

  let templateId: string | null = null;
  if (agent?.brokerage_id) {
    const { data: template } = await supabase
      .from("brokerage_bba_templates")
      .select("id")
      .eq("brokerage_id", agent.brokerage_id)
      .eq("is_default", true)
      .maybeSingle();
    templateId = (template?.id as string | undefined) ?? null;
  }

  await supabase
    .from("bba_requests")
    .update({ voided_at: new Date().toISOString() })
    .eq("client_id", input.clientId)
    .is("signed_at", null)
    .is("voided_at", null);

  const { data, error } = await supabase
    .from("bba_requests")
    .insert({
      token: randomBytes(24).toString("base64url"),
      client_id: input.clientId,
      agent_id: input.agentId,
      agent_name: agentName,
      commission_pct: input.commissionPct,
      term_start: input.termStart,
      term_end: input.termEnd,
      search_area: input.searchArea,
      template_id: templateId,
      expires_at: new Date(Date.now() + BBA_LINK_TTL_DAYS * 86_400_000).toISOString(),
    })
    .select(BBA_REQUEST_COLUMNS)
    .single();
  if (error || !data) {
    return { ok: false, status: 500, error: error?.message ?? "Could not create the signing link" };
  }
  return { ok: true, request: data as BbaRequest };
}

/** The client's newest request that hasn't been signed or voided (it may have expired). */
export async function latestOpenBbaRequest(
  supabase: SupabaseClient,
  clientId: string,
): Promise<BbaRequest | null> {
  const { data } = await supabase
    .from("bba_requests")
    .select(BBA_REQUEST_COLUMNS)
    .eq("client_id", clientId)
    .is("signed_at", null)
    .is("voided_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as BbaRequest | null) ?? null;
}

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  scoreFuzzyMatch,
  matchBadgeReasons,
  MATCH_MIN_SCORE,
  type MatchClient,
  type MatchProperty,
} from "@/lib/matching";

/**
 * Backwards-compatible shapes used by existing callers. The full
 * smart-matching shape lives in `lib/matching.ts`.
 */
export type ClientRow = {
  id: string;
  budget_max: number | null;
  budget_min: number | null;
  town: string | null;
  beds_wanted: number | null;
  baths_wanted: number | null;
  status: string | null;
  // Smart-matching fields — optional for backwards compat with older rows.
  preferred_towns?: string[] | null;
  nearby_towns_ok?: boolean | null;
  budget_flex_pct?: number | null;
  bed_flex?: number | null;
  bath_flex?: number | null;
};

export type PropertyRow = {
  id: string;
  price: number | null;
  town: string | null;
  beds: number | null;
  baths: number | null;
};

export type MatchReason = { score: number; reason: string };

/**
 * Score a (client, property) pair. Returns the total 0..100 score and a list
 * of short reason strings (for backwards compatibility with the existing
 * `match_reasons` column).
 */
export function scoreMatch(
  client: ClientRow,
  property: PropertyRow,
): { score: number; reasons: MatchReason[] } {
  const result = scoreFuzzyMatch(
    client as MatchClient,
    property as MatchProperty,
  );
  return {
    score: result.score,
    reasons: matchBadgeReasons(result).map((reason) => ({
      score: result.score,
      reason,
    })),
  };
}

const ACTIVE = new Set([
  "new",
  "contacted",
  "showing",
  "offer",
  "under_contract",
]);

export async function runPropertyMatching(
  supabase: SupabaseClient,
  agentId: string,
  propertyId?: string,
) {
  const { data: properties } = propertyId
    ? await supabase
        .from("properties")
        .select("*")
        .eq("id", propertyId)
        .eq("agent_id", agentId)
    : await supabase.from("properties").select("*").eq("agent_id", agentId);

  const { data: clients } = await supabase
    .from("clients")
    .select("*")
    .eq("agent_id", agentId);

  if (!properties?.length || !clients?.length) return { matched: 0 };

  let matched = 0;

  for (const p of properties as PropertyRow[]) {
    await supabase.from("property_matches").delete().eq("property_id", p.id);

    const rows: {
      property_id: string;
      client_id: string;
      agent_id: string;
      match_score: number;
      match_reasons: unknown;
      notified: boolean;
    }[] = [];

    for (const c of clients as ClientRow[]) {
      if (!c.status || !ACTIVE.has(c.status)) continue;
      const { score, reasons } = scoreMatch(c, p);
      if (score < MATCH_MIN_SCORE) continue;
      rows.push({
        property_id: p.id,
        client_id: c.id,
        agent_id: agentId,
        match_score: score,
        match_reasons: reasons.map((r) => r.reason),
        notified: false,
      });
    }

    rows.sort((a, b) => b.match_score - a.match_score);

    if (rows.length) {
      const { error } = await supabase.from("property_matches").insert(rows);
      if (!error) matched += rows.length;
    }
  }

  return { matched };
}

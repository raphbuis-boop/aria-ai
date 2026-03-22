import type { SupabaseClient } from "@supabase/supabase-js";

export type ClientRow = {
  id: string;
  budget_max: number | null;
  budget_min: number | null;
  town: string | null;
  beds_wanted: number | null;
  baths_wanted: number | null;
  status: string | null;
};

export type PropertyRow = {
  id: string;
  price: number | null;
  town: string | null;
  beds: number | null;
  baths: number | null;
};

export type MatchReason = { score: number; reason: string };

export function scoreMatch(
  client: ClientRow,
  property: PropertyRow,
): { score: number; reasons: MatchReason[] } {
  const reasons: MatchReason[] = [];
  let score = 0;
  const price = property.price ?? 0;
  const budgetMax = client.budget_max ?? 0;

  if (budgetMax > 0) {
    if (price <= budgetMax) {
      score += 40;
      reasons.push({ score: 40, reason: "budget ✅" });
    } else if (price <= budgetMax * 1.1) {
      score += 20;
      reasons.push({ score: 20, reason: "slightly over budget" });
    }
  }

  const town = (client.town ?? "").toLowerCase();
  const pTown = (property.town ?? "").toLowerCase();
  if (town && pTown && town === pTown) {
    score += 30;
    reasons.push({ score: 30, reason: "preferred town ✅" });
  }

  const bedsW = client.beds_wanted ?? 0;
  const bedsP = property.beds ?? 0;
  if (bedsW > 0) {
    if (bedsP >= bedsW) {
      score += 20;
      reasons.push({ score: 20, reason: "beds ✅" });
    } else if (bedsP >= bedsW - 1) {
      score += 10;
      reasons.push({ score: 10, reason: "close on beds" });
    }
  }

  const bathsW = Number(client.baths_wanted ?? 0);
  const bathsP = Number(property.baths ?? 0);
  if (bathsW > 0 && bathsP >= bathsW) {
    score += 10;
    reasons.push({ score: 10, reason: "baths ✅" });
  }

  return { score, reasons };
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
    ? await supabase.from("properties").select("*").eq("id", propertyId).eq("agent_id", agentId)
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
      if (score < 40) continue;
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

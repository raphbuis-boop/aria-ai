import type { SupabaseClient } from "@supabase/supabase-js";
import { scoreMatch, type ClientRow, type PropertyRow } from "@/lib/matchProperties";
import { MATCH_MIN_SCORE } from "@/lib/matching";
import type { CandidateProperty } from "@/lib/sms/conversation";

type InventoryRow = PropertyRow & { address: string | null; status: string | null };

/**
 * Scores the agent's available inventory against the client's (just-updated)
 * profile with the same fuzzy matcher the rest of the app uses. Only homes
 * clearing MATCH_MIN_SCORE are offered to Claude as candidates, so Aria can
 * never text a listing that isn't a real, active, reasonably-fitting home.
 */
export async function findCandidateProperties(
  supabase: SupabaseClient,
  client: ClientRow & { agent_id: string },
  alreadySentIds: Set<string>,
  limit = 6,
): Promise<CandidateProperty[]> {
  const { data: inventory } = await supabase
    .from("properties")
    .select("id, address, town, price, beds, baths, status")
    .eq("agent_id", client.agent_id)
    .eq("status", "available");

  return ((inventory ?? []) as InventoryRow[])
    .filter((p) => p.address)
    .map((p) => ({ p, score: scoreMatch(client, p).score }))
    .filter(({ score }) => score >= MATCH_MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ p, score }) => ({
      id: p.id,
      address: p.address as string,
      town: p.town,
      price: p.price,
      beds: p.beds,
      baths: p.baths,
      score,
      already_sent: alreadySentIds.has(p.id),
    }));
}

/**
 * Records homes Aria just texted as property_matches (notified=true), so they
 * show in the client profile's matched-properties strip like any other match.
 */
export async function recordRecommendations(
  supabase: SupabaseClient,
  client: { id: string; agent_id: string },
  recommended: CandidateProperty[],
) {
  if (!recommended.length) return;
  const now = new Date().toISOString();
  const ids = recommended.map((p) => p.id);

  await supabase
    .from("property_matches")
    .delete()
    .eq("client_id", client.id)
    .in("property_id", ids);

  const { error } = await supabase.from("property_matches").insert(
    recommended.map((p) => ({
      property_id: p.id,
      client_id: client.id,
      agent_id: client.agent_id,
      match_score: p.score,
      match_reasons: ["Recommended by Aria over SMS"],
      notified: true,
      notified_at: now,
    })),
  );
  if (error) console.error("[sms/recommend] property_matches insert failed", error.message);
}

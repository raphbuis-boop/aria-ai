import type { SupabaseClient } from "@supabase/supabase-js";
import { scoreMatch, type ClientRow, type PropertyRow } from "@/lib/matchProperties";
import { MATCH_MIN_SCORE } from "@/lib/matching";
import type { CandidateProperty } from "@/lib/sms/conversation";
import { ARIA_RECOMMENDED_REASON, AGENT_SENT_REASON } from "@/lib/sms/recommend-reasons";


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
      match_reasons: [ARIA_RECOMMENDED_REASON],
      notified: true,
    })),
  );
  if (error) console.error("[sms/recommend] property_matches insert failed", error.message);
}

/**
 * The agent texted a specific home to the client from Aria's number. Marks
 * (or creates) the client↔property match so it shows as sent everywhere.
 */
export async function recordAgentSentProperty(
  supabase: SupabaseClient,
  client: ClientRow & { agent_id: string },
  propertyId: string,
) {
  const { data: property } = await supabase
    .from("properties")
    .select("id, town, price, beds, baths")
    .eq("id", propertyId)
    .eq("agent_id", client.agent_id)
    .maybeSingle();
  if (!property) return;

  const { data: existing } = await supabase
    .from("property_matches")
    .select("id, match_reasons")
    .eq("client_id", client.id)
    .eq("property_id", propertyId)
    .maybeSingle();

  if (existing) {
    const reasons = Array.isArray(existing.match_reasons) ? (existing.match_reasons as string[]) : [];
    if (!reasons.includes(AGENT_SENT_REASON)) {
      await supabase
        .from("property_matches")
        .update({ match_reasons: [...reasons, AGENT_SENT_REASON], notified: true })
        .eq("id", existing.id);
    }
    return;
  }

  const { error } = await supabase.from("property_matches").insert({
    property_id: propertyId,
    client_id: client.id,
    agent_id: client.agent_id,
    match_score: scoreMatch(client, property as PropertyRow).score,
    match_reasons: [AGENT_SENT_REASON],
    notified: true,
  });
  if (error) console.error("[sms/recommend] agent-sent match insert failed", error.message);
}

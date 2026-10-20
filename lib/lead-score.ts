import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeLeadScore,
  type TodayActivity,
  type TodayEngagementEvent,
  type TodayTransaction,
} from "@/lib/today-items";

export type LeadScore = { score: number; reason: string };

/** computeLeadScore only looks back two weeks at portal engagement. */
const ENGAGEMENT_WINDOW_MS = 14 * 86_400_000;

/**
 * The 0–10 lead score for each client, from computeLeadScore (lib/today-items)
 * with one fixed set of inputs: the agent's activity history (newest first),
 * active transactions, and the last two weeks of portal engagement. Clients,
 * Ask Aria and voice all read scores from here, so every screen agrees —
 * never from the clients.lead_score column.
 *
 * Works with the server or browser Supabase client (RLS scopes it to the agent).
 */
export async function loadLeadScores(
  supabase: SupabaseClient,
  agentId: string,
  clients: { id: string; status: string | null }[],
): Promise<Map<string, LeadScore>> {
  const scores = new Map<string, LeadScore>();
  if (!clients.length) return scores;

  const [activitiesRes, transactionsRes, engagementRes] = await Promise.all([
    supabase
      .from("activities")
      .select("client_id, created_at, type, direction")
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false }),
    supabase
      .from("transactions")
      .select("id, client_id, address, closing_date, status")
      .eq("agent_id", agentId)
      .eq("status", "active"),
    supabase
      .from("client_engagement_events")
      .select("client_id, event_type, created_at")
      .eq("agent_id", agentId)
      .gte("created_at", new Date(Date.now() - ENGAGEMENT_WINDOW_MS).toISOString()),
  ]);
  if (activitiesRes.error) console.error("[lead-score] activities:", activitiesRes.error.message);

  const activities = (activitiesRes.data ?? []) as TodayActivity[];
  const transactions = (transactionsRes.data ?? []) as TodayTransaction[];
  // Fail-soft: no engagement table → scores fall back to the other signals.
  const engagement = (engagementRes.data ?? []) as TodayEngagementEvent[];

  for (const c of clients) {
    scores.set(
      c.id,
      computeLeadScore(
        {
          id: c.id,
          name: "",
          town: null,
          status: c.status,
          lead_score: null,
          budget_min: null,
          budget_max: null,
          phone: null,
          birthday: null,
          home_purchase_date: null,
        },
        activities,
        transactions,
        engagement,
      ),
    );
  }
  return scores;
}

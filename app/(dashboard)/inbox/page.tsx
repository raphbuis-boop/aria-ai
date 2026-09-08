import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { buildTodayItems } from "@/lib/today-items";
import type { TodayClient, TodayTransaction, TodayActivity, NewMatchItem, TodayEngagementEvent } from "@/lib/today-items";
import { FollowUpsClient } from "./followups-client";

export const dynamic = "force-dynamic";

// Follow-ups / Messages — the core-loop screen (VISION.md #4).
// Reuses the exact same "who needs contact" logic as Home (lib/today-items.ts),
// ranked by value instead of urgency, with every item treated as a message to
// draft, edit, and send.
export default async function FollowUpsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const now = new Date();
  const todayISO = now.toISOString().split("T")[0];
  const plus3 = new Date(now);
  plus3.setDate(plus3.getDate() + 3);
  const plus3ISO = plus3.toISOString().split("T")[0];
  const minus30ISO = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const minus24hISO = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const [clientsRes, transactionsRes, activitiesRes, mlsMatchesRes, bbaRes, dismissedRes] =
    await Promise.all([
      supabase
        .from("clients")
        .select("id, name, town, status, lead_score, budget_min, budget_max, phone, birthday, home_purchase_date")
        .eq("agent_id", user.id)
        .neq("status", "closed"),

      supabase
        .from("transactions")
        .select("id, client_id, address, closing_date, status")
        .eq("agent_id", user.id)
        .gte("closing_date", todayISO)
        .lte("closing_date", plus3ISO),

      supabase
        .from("activities")
        .select("client_id, created_at, type, direction")
        .eq("agent_id", user.id)
        .gte("created_at", minus30ISO)
        .order("created_at", { ascending: false }),

      supabase
        .from("property_matches")
        .select("client_id, match_score, properties(address)")
        .eq("agent_id", user.id)
        .eq("notified", false)
        .gte("created_at", minus24hISO)
        .order("match_score", { ascending: false }),

      supabase.from("buyer_broker_agreements").select("client_id").eq("agent_id", user.id),

      supabase
        .from("dismissed_opportunities")
        .select("item_id")
        .eq("agent_id", user.id)
        .gt("dismiss_until", now.toISOString()),
    ]);

  const clients = (clientsRes.data ?? []) as TodayClient[];
  const transactions = (transactionsRes.data ?? []) as TodayTransaction[];
  const activities = (activitiesRes.data ?? []) as TodayActivity[];
  const bbaSignedClientIds = (bbaRes.data ?? []).map((r) => String(r.client_id));

  const seen = new Set<string>();
  const newMatchItems: NewMatchItem[] = [];
  for (const row of mlsMatchesRes.data ?? []) {
    const clientId = String(row.client_id);
    if (seen.has(clientId)) continue;
    seen.add(clientId);
    const props = row.properties as unknown as { address: string } | null;
    newMatchItems.push({ clientId, propertyAddress: props?.address ?? null });
  }

  const dismissedIds = new Set((dismissedRes.data ?? []).map((r) => String(r.item_id)));

  const { data: engagementRows } = await supabase
    .from("client_engagement_events")
    .select("client_id, event_type, created_at, listing_address, mls_number")
    .eq("agent_id", user.id)
    .gte("created_at", minus30ISO);
  const engagement = (engagementRows ?? []) as TodayEngagementEvent[];

  // Past (closed) clients — the only pool propensity-to-sell (rank 6) scores
  // against. Separate from `clients` above, which excludes closed status.
  const { data: closedClientRows } = await supabase
    .from("clients")
    .select("id, name, town, status, lead_score, budget_min, budget_max, phone, birthday, home_purchase_date")
    .eq("agent_id", user.id)
    .eq("status", "closed");
  const closedClients = (closedClientRows ?? []) as TodayClient[];

  const allItems = buildTodayItems(
    clients,
    transactions,
    activities,
    newMatchItems,
    bbaSignedClientIds,
    engagement,
    closedClients,
  );
  const items = allItems
    .filter((i) => !dismissedIds.has(i.id))
    // Ranked by value — highest commission at stake first.
    .sort((a, b) => (b.commissionEst ?? 0) - (a.commissionEst ?? 0));

  const totalCommission = items.reduce((sum, i) => sum + (i.commissionEst ?? 0), 0);

  return <FollowUpsClient items={items} totalCommission={totalCommission} />;
}

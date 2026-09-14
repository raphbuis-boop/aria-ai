import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildTodayItems, activityVerb } from "@/lib/today-items";
import type { TodayClient, TodayTransaction, TodayActivity, NewMatchItem, TodayEngagementEvent } from "@/lib/today-items";
import { TodayClient as TodayClientComponent } from "./today-client";
import { initials } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Soft onboarding gate — redirect new users to the wizard before the dashboard
  const { data: onboardCheck } = await supabase
    .from("agent_profiles")
    .select("onboarding_complete")
    .eq("id", user.id)
    .maybeSingle();

  if (!onboardCheck?.onboarding_complete) {
    redirect("/onboarding");
  }

  const now = new Date();
  const todayISO = now.toISOString().split("T")[0];

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowISO = tomorrow.toISOString().split("T")[0];

  const plus7 = new Date(now);
  plus7.setDate(plus7.getDate() + 7);
  const plus7ISO = plus7.toISOString().split("T")[0];

  const minus30 = new Date(now);
  minus30.setDate(minus30.getDate() - 30);
  const minus30ISO = minus30.toISOString();

  const minus24hISO = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const [
    profileRes,
    clientsRes,
    transactionsRes,
    activitiesRes,
    mlsMatchesRes,
    bbaRes,
    showingsTodayRes,
    closingsThisWeekRes,
    dismissedRes,
    tasksDueRes,
    dealsMovingRes,
  ] = await Promise.all([
    // 0. Agent profile — real name (scoped by id, not agent_id)
    supabase
      .from("agent_profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle(),

    // 1. Clients — exclude closed at SQL level [agent_id scoped ✓]
    supabase
      .from("clients")
      .select("id, name, town, status, lead_score, budget_min, budget_max, phone, birthday, home_purchase_date")
      .eq("agent_id", user.id)  // SCOPE 1
      .neq("status", "closed"),

    // 2. Transactions — every active deal, with real contract price. Not just
    // closing-soon: computeMoneyEstimate/computeLeadScore need the full active
    // pipeline to compute real deal value and closing-proximity for every
    // client, not only the ones closing in the next 3 days. [agent_id scoped ✓]
    supabase
      .from("transactions")
      .select("id, client_id, address, closing_date, status, contract_price")
      .eq("agent_id", user.id)  // SCOPE 2
      .eq("status", "active"),

    // 3. Activities — last 30 days, most recent first [agent_id scoped ✓]
    supabase
      .from("activities")
      .select("client_id, created_at, type, direction, clients(name)")
      .eq("agent_id", user.id)  // SCOPE 3
      .gte("created_at", minus30ISO)
      .order("created_at", { ascending: false }),

    // 4. MLS matches — last 24h, unnotified, with property address via FK embed [agent_id scoped ✓]
    supabase
      .from("property_matches")
      .select("client_id, match_score, properties(address)")
      .eq("agent_id", user.id)  // SCOPE 4
      .eq("notified", false)
      .gte("created_at", minus24hISO)
      .order("match_score", { ascending: false }),

    // 5. BBA-signed clients + their real commission rate [agent_id scoped ✓]
    supabase
      .from("buyer_broker_agreements")
      .select("client_id, commission_pct")
      .eq("agent_id", user.id),  // SCOPE 5

    // 6. Showings today — full rows for inline schedule [agent_id scoped ✓]
    supabase
      .from("showings")
      .select("id, address, showing_date, status, clients(name)")
      .eq("agent_id", user.id)  // SCOPE 6
      .gte("showing_date", `${todayISO}T00:00:00`)
      .lt("showing_date", `${tomorrowISO}T00:00:00`)
      .order("showing_date", { ascending: true }),

    // 7. Closings this week count (briefing strip) [agent_id scoped ✓]
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("agent_id", user.id)  // SCOPE 7
      .gte("closing_date", todayISO)
      .lte("closing_date", plus7ISO),

    // 8. Active dismissals — item IDs snoozed past now [agent_id scoped ✓]
    supabase
      .from("dismissed_opportunities")
      .select("item_id")
      .eq("agent_id", user.id)
      .gt("dismiss_until", now.toISOString()),

    // 9. Tasks due today or overdue, not done [agent_id scoped ✓]
    supabase
      .from("tasks")
      .select("id, client_id, title, due_at, done, clients(name)")
      .eq("agent_id", user.id)  // SCOPE 9
      .eq("done", false)
      .lt("due_at", tomorrowISO)
      .order("due_at", { ascending: true }),

    // 10. Deals moving — all active transactions, nearest closing first [agent_id scoped ✓]
    supabase
      .from("transactions")
      .select("id, client_id, address, closing_date, status, clients(name)")
      .eq("agent_id", user.id)  // SCOPE 10
      .eq("status", "active")
      .order("closing_date", { ascending: true }),
  ]);

  // Log errors without crashing the page
  if (profileRes.error) console.error("[today] agent_profiles:", profileRes.error);
  if (clientsRes.error) console.error("[today] clients:", clientsRes.error);
  if (transactionsRes.error) console.error("[today] transactions:", transactionsRes.error);
  if (activitiesRes.error) console.error("[today] activities:", activitiesRes.error);
  if (mlsMatchesRes.error) console.error("[today] property_matches:", mlsMatchesRes.error);
  if (bbaRes.error) console.error("[today] buyer_broker_agreements:", bbaRes.error);
  if (showingsTodayRes.error) console.error("[today] showings:", showingsTodayRes.error);
  if (closingsThisWeekRes.error) console.error("[today] closings_week:", closingsThisWeekRes.error);
  if (dismissedRes.error) console.error("[today] dismissed_opportunities:", dismissedRes.error);
  if (tasksDueRes.error) console.error("[today] tasks:", tasksDueRes.error);
  if (dealsMovingRes.error) console.error("[today] deals_moving:", dealsMovingRes.error);

  const clients = (clientsRes.data ?? []) as TodayClient[];
  const transactions = (transactionsRes.data ?? []) as TodayTransaction[];
  const activities = (activitiesRes.data ?? []) as TodayActivity[];
  const bbaSignedClientIds = (bbaRes.data ?? []).map((r) => String(r.client_id));
  const bbaCommissionPctByClient = new Map(
    (bbaRes.data ?? [])
      .filter((r) => r.commission_pct != null)
      .map((r) => [String(r.client_id), Number(r.commission_pct)]),
  );

  // Deduplicate MLS matches by client_id, keeping highest match_score (already ordered desc).
  // Defensively handle null properties (deleted property or broken FK).
  const seen = new Set<string>();
  const newMatchItems: NewMatchItem[] = [];
  for (const row of mlsMatchesRes.data ?? []) {
    const clientId = String(row.client_id);
    if (seen.has(clientId)) continue;
    seen.add(clientId);
    const props = row.properties as unknown as { address: string } | null;
    newMatchItems.push({
      clientId,
      propertyAddress: props?.address ?? null,
    });
  }

  const dismissedIds = new Set((dismissedRes.data ?? []).map((r) => String(r.item_id)));

  // Behavioral engagement (last 30d) — feeds real lead heat. Fail-soft: if the
  // client_engagement_events table isn't migrated yet, this is null -> [] and
  // scoring simply falls back to the prior signals.
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
    bbaCommissionPctByClient,
  );

  // Filter out snoozed/dismissed items before sending to client
  const items = allItems.filter((i) => !dismissedIds.has(i.id));

  // Hero insight — "N clients likely to move this week, ~$X in projected commission."
  // "Likely to move" = urgencyRank 1–2 (closing at risk + quiet hot leads), deduped by client,
  // same bucket + same 2.5% commission convention the rest of the app already uses.
  const seenForInsight = new Set<string>();
  const likelyToMove = items.filter((i) => {
    if (i.urgencyRank > 2) return false;
    if (seenForInsight.has(i.clientId)) return false;
    seenForInsight.add(i.clientId);
    return true;
  });
  const insight = {
    count: likelyToMove.length,
    commissionEst: likelyToMove.reduce((sum, i) => sum + (i.commissionEst ?? 0), 0),
  };

  // Recent activity feed — real logged activities only, most recent first.
  type ActivityFeedRow = { client_id: string; created_at: string; type: string | null; direction: string | null; clients: { name: string } | { name: string }[] | null };
  const activityFeed = ((activitiesRes.data ?? []) as ActivityFeedRow[])
    .map((a) => {
      const verb = activityVerb(a.type, a.direction);
      if (!verb) return null;
      const client = Array.isArray(a.clients) ? a.clients[0] : a.clients;
      return {
        id: `${a.client_id}-${a.created_at}`,
        clientName: client?.name ?? "A client",
        verb,
        createdAt: a.created_at,
      };
    })
    .filter((r): r is { id: string; clientName: string; verb: string; createdAt: string } => r !== null)
    .slice(0, 8);

  // Mark shown MLS matches as notified so they don't accumulate forever.
  // Fire-and-forget — no await, doesn't block page render.
  if (newMatchItems.length > 0) {
    void supabase
      .from("property_matches")
      .update({ notified: true })
      .eq("agent_id", user.id)
      .eq("notified", false);
  }

  // Today's showings with client names for inline schedule.
  // Supabase returns the joined "clients" relation as an array even for to-one FK.
  type ShowingRow = { id: string; address: string | null; showing_date: string | null; status: string | null; clients: { name: string } | null };
  const showingsToday = (showingsTodayRes.data ?? []).map((s) => ({
    id: String(s.id),
    address: s.address as string | null,
    showing_date: s.showing_date as string | null,
    status: s.status as string | null,
    clients: Array.isArray(s.clients) ? (s.clients[0] as { name: string } ?? null) : s.clients as { name: string } | null,
  })) as ShowingRow[];

  const briefing = {
    showingsToday: showingsToday.length,
    closingsThisWeek: closingsThisWeekRes.count ?? 0,
    newMatches: newMatchItems.length,
  };

  // Tasks due today or overdue, not done — secondary "what do I do next" section.
  const tasksDue = (tasksDueRes.data ?? []).map((t) => ({
    id: String(t.id),
    clientId: t.client_id ? String(t.client_id) : null,
    clientName: Array.isArray(t.clients) ? (t.clients[0] as { name: string } | undefined)?.name ?? null : (t.clients as { name: string } | null)?.name ?? null,
    title: t.title as string,
    dueAt: t.due_at as string | null,
  }));

  // Deals moving — active transactions not already surfaced as an urgent hero item.
  const heroTransactionIds = new Set(items.map((i) => i.transactionId).filter(Boolean));
  const dealsMoving = (dealsMovingRes.data ?? [])
    .filter((d) => !heroTransactionIds.has(String(d.id)))
    .map((d) => ({
      id: String(d.id),
      clientId: String(d.client_id),
      clientName: Array.isArray(d.clients) ? (d.clients[0] as { name: string } | undefined)?.name ?? "Client" : (d.clients as { name: string } | null)?.name ?? "Client",
      address: d.address as string | null,
      closingDate: d.closing_date as string | null,
    }));

  // Active clients (non-closed)
  const activeClients = clients.length;
  const warmLeads = clients.filter(c => (c.lead_score ?? 0) >= 7 || c.status === "showing").length;
  const pipelineCount = clients.filter(c => ["offer", "under_contract"].includes(c.status ?? "")).length;
  const pendingDeals = (transactionsRes.data ?? []).length;

  const fullName =
    (profileRes.data?.full_name as string | undefined) ??
    (user.user_metadata?.full_name as string | undefined) ??
    null;
  const firstName = fullName?.split(" ")[0] ?? "there";
  const agentInitials = initials(fullName);

  const hasAnyClients = clients.length > 0;

  return (
    <TodayClientComponent
      items={items}
      briefing={briefing}
      showingsToday={showingsToday}
      tasksDue={tasksDue}
      dealsMoving={dealsMoving}
      insight={insight}
      activityFeed={activityFeed}
      userName={firstName}
      agentInitials={agentInitials}
      hasAnyClients={hasAnyClients}
      kpi={{ activeClients, warmLeads, pipelineCount, pendingDeals }}
    />
  );
}

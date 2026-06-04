import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildTodayItems } from "@/lib/today-items";
import { BriefService } from "@/lib/services/brief.service";
import type {
  TodayClient,
  TodayTransaction,
  TodayActivity,
  NewMatchItem,
} from "@/lib/today-items";
import type { MobileClientRow, MobileTxRow } from "@/lib/mobile-briefing";
import { TodayScreen } from "./today-screen";
import type { TodayScreenProps } from "./today-screen";

export const dynamic = "force-dynamic";

export default async function V2TodayPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const now = new Date();
  const todayISO = now.toISOString().split("T")[0];

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowISO = tomorrow.toISOString().split("T")[0];

  const plus3 = new Date(now);
  plus3.setDate(plus3.getDate() + 3);
  const plus3ISO = plus3.toISOString().split("T")[0];

  const plus7 = new Date(now);
  plus7.setDate(plus7.getDate() + 7);
  const plus7ISO = plus7.toISOString().split("T")[0];

  const minus30ISO = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
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
  ] = await Promise.all([
    // 0. Agent profile
    supabase
      .from("agent_profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle(),

    // 1. Non-closed clients
    supabase
      .from("clients")
      .select(
        "id, name, town, status, lead_score, budget_min, budget_max, phone, birthday, home_purchase_date",
      )
      .eq("agent_id", user.id)
      .neq("status", "closed"),

    // 2. Transactions closing in ≤3 days
    supabase
      .from("transactions")
      .select("id, client_id, address, closing_date, status")
      .eq("agent_id", user.id)
      .gte("closing_date", todayISO)
      .lte("closing_date", plus3ISO),

    // 3. Activities — last 30 days for "days since contact"
    supabase
      .from("activities")
      .select("client_id, created_at")
      .eq("agent_id", user.id)
      .gte("created_at", minus30ISO)
      .order("created_at", { ascending: false }),

    // 4. MLS matches — last 24h, unnotified
    supabase
      .from("property_matches")
      .select("client_id, match_score, properties(address)")
      .eq("agent_id", user.id)
      .eq("notified", false)
      .gte("created_at", minus24hISO)
      .order("match_score", { ascending: false }),

    // 5. BBA-signed client IDs
    supabase
      .from("buyer_broker_agreements")
      .select("client_id")
      .eq("agent_id", user.id),

    // 6. Showings today
    supabase
      .from("showings")
      .select("id, address, showing_date, status, clients(name)")
      .eq("agent_id", user.id)
      .gte("showing_date", `${todayISO}T00:00:00`)
      .lt("showing_date", `${tomorrowISO}T00:00:00`)
      .order("showing_date", { ascending: true }),

    // 7. Closings count this week
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("agent_id", user.id)
      .gte("closing_date", todayISO)
      .lte("closing_date", plus7ISO),

    // 8. Active dismissals (snoozed items)
    supabase
      .from("dismissed_opportunities")
      .select("item_id")
      .eq("agent_id", user.id)
      .gt("dismiss_until", now.toISOString()),
  ]);

  // Log errors without crashing
  if (profileRes.error) console.error("[v2/today] agent_profiles:", profileRes.error);
  if (clientsRes.error) console.error("[v2/today] clients:", clientsRes.error);
  if (transactionsRes.error) console.error("[v2/today] transactions:", transactionsRes.error);
  if (activitiesRes.error) console.error("[v2/today] activities:", activitiesRes.error);
  if (mlsMatchesRes.error) console.error("[v2/today] property_matches:", mlsMatchesRes.error);
  if (bbaRes.error) console.error("[v2/today] buyer_broker_agreements:", bbaRes.error);
  if (showingsTodayRes.error) console.error("[v2/today] showings:", showingsTodayRes.error);
  if (closingsThisWeekRes.error) console.error("[v2/today] closings_week:", closingsThisWeekRes.error);
  if (dismissedRes.error) console.error("[v2/today] dismissed_opportunities:", dismissedRes.error);

  const clients = (clientsRes.data ?? []) as TodayClient[];
  const transactions = (transactionsRes.data ?? []) as TodayTransaction[];
  const activities = (activitiesRes.data ?? []) as TodayActivity[];
  const bbaSignedClientIds = (bbaRes.data ?? []).map((r) => String(r.client_id));

  // Deduplicate MLS matches by client (keep highest score, already ordered desc)
  const seen = new Set<string>();
  const newMatchItems: NewMatchItem[] = [];
  for (const row of mlsMatchesRes.data ?? []) {
    const cId = String(row.client_id);
    if (seen.has(cId)) continue;
    seen.add(cId);
    const props = row.properties as unknown as { address: string } | null;
    newMatchItems.push({ clientId: cId, propertyAddress: props?.address ?? null });
  }

  const dismissedIds = new Set((dismissedRes.data ?? []).map((r) => String(r.item_id)));

  // Build ranked action items (buildTodayItems is the existing engine — not reimplemented)
  const allItems = buildTodayItems(
    clients,
    transactions,
    activities,
    newMatchItems,
    bbaSignedClientIds,
  );
  const items = allItems.filter((i) => !dismissedIds.has(i.id));

  // Build brief using BriefService (wraps buildMobileBriefing)
  const briefClients: MobileClientRow[] = clients.map((c) => ({
    id: c.id,
    name: c.name,
    town: c.town,
    status: c.status,
    lead_score: c.lead_score,
    budget_min: c.budget_min,
    budget_max: c.budget_max,
    phone: c.phone,
  }));
  const briefTx: MobileTxRow[] = (transactionsRes.data ?? []).map((t) => ({
    id: String(t.id),
    client_id: String(t.client_id),
    address: (t as { address?: string | null }).address ?? null,
    closing_date: (t as { closing_date?: string | null }).closing_date ?? null,
    status: (t as { status?: string | null }).status ?? null,
  }));
  const brief = BriefService.build(briefClients, briefTx, newMatchItems.length);

  // Pipeline total (from all non-closed clients, including those with no budget_max)
  const pipelineTotal = BriefService.pipelineTotal(clients);

  // KPIs from real data
  const kpi = {
    activeClients: clients.length,
    hotLeads: brief.hotLeadCount,
    closingsThisWeek: closingsThisWeekRes.count ?? 0,
    newMatches: newMatchItems.length,
  };

  // Today's showings with client name join
  type ShowingRaw = {
    id: unknown;
    address: unknown;
    showing_date: unknown;
    status: unknown;
    clients: unknown;
  };
  const showingsToday: TodayScreenProps["showingsToday"] = (
    showingsTodayRes.data ?? []
  ).map((s: ShowingRaw) => ({
    id: String(s.id),
    address: (s.address as string | null) ?? null,
    showingDate: (s.showing_date as string | null) ?? null,
    clientName: Array.isArray(s.clients)
      ? ((s.clients[0] as { name?: string } | undefined)?.name ?? null)
      : ((s.clients as { name?: string } | null)?.name ?? null),
  }));

  const firstName =
    (profileRes.data?.full_name as string | undefined)?.split(" ")[0] ??
    (user.user_metadata?.full_name as string | undefined)?.split(" ")[0] ??
    "there";

  // Mark MLS matches as notified (fire-and-forget)
  if (newMatchItems.length > 0) {
    void supabase
      .from("property_matches")
      .update({ notified: true })
      .eq("agent_id", user.id)
      .eq("notified", false);
  }

  return (
    <TodayScreen
      userName={firstName}
      brief={brief}
      items={items}
      pipelineTotal={pipelineTotal}
      kpi={kpi}
      showingsToday={showingsToday}
      hasAnyClients={clients.length > 0}
    />
  );
}

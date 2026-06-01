import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildTodayItems } from "@/lib/today-items";
import type { TodayClient, TodayTransaction, TodayActivity, NewMatchItem } from "@/lib/today-items";
import { TodayClient as TodayClientComponent } from "./today-client";

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

  const plus3 = new Date(now);
  plus3.setDate(plus3.getDate() + 3);
  const plus3ISO = plus3.toISOString().split("T")[0];

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

    // 2. Transactions — closing within the next 3 days (urgency cards) [agent_id scoped ✓]
    supabase
      .from("transactions")
      .select("id, client_id, address, closing_date, status")
      .eq("agent_id", user.id)  // SCOPE 2
      .gte("closing_date", todayISO)
      .lte("closing_date", plus3ISO),

    // 3. Activities — last 30 days, most recent first [agent_id scoped ✓]
    supabase
      .from("activities")
      .select("client_id, created_at")
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

    // 5. BBA-signed client IDs — any row = signed [agent_id scoped ✓]
    supabase
      .from("buyer_broker_agreements")
      .select("client_id")
      .eq("agent_id", user.id),  // SCOPE 5

    // 6. Showings today count (briefing strip) [agent_id scoped ✓]
    supabase
      .from("showings")
      .select("id", { count: "exact", head: true })
      .eq("agent_id", user.id)  // SCOPE 6
      .gte("showing_date", `${todayISO}T00:00:00`)
      .lt("showing_date", `${tomorrowISO}T00:00:00`),

    // 7. Closings this week count (briefing strip) [agent_id scoped ✓]
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("agent_id", user.id)  // SCOPE 7
      .gte("closing_date", todayISO)
      .lte("closing_date", plus7ISO),
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

  const clients = (clientsRes.data ?? []) as TodayClient[];
  const transactions = (transactionsRes.data ?? []) as TodayTransaction[];
  const activities = (activitiesRes.data ?? []) as TodayActivity[];
  const bbaSignedClientIds = (bbaRes.data ?? []).map((r) => String(r.client_id));

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

  const items = buildTodayItems(
    clients,
    transactions,
    activities,
    newMatchItems,
    bbaSignedClientIds,
  );

  const briefing = {
    showingsToday: showingsTodayRes.count ?? 0,
    closingsThisWeek: closingsThisWeekRes.count ?? 0,
    newMatches: newMatchItems.length,
  };

  const firstName =
    (profileRes.data?.full_name as string | undefined)?.split(" ")[0] ??
    (user.user_metadata?.full_name as string | undefined)?.split(" ")[0] ??
    "there";

  const hasAnyClients = clients.length > 0;

  return (
    <TodayClientComponent
      items={items}
      briefing={briefing}
      userName={firstName}
      hasAnyClients={hasAnyClients}
    />
  );
}

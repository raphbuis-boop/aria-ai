import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildTodayItems } from "@/lib/today-items";
import type { TodayClient, TodayTransaction, TodayActivity } from "@/lib/today-items";
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

  const now = new Date();
  const todayISO = now.toISOString().split("T")[0];
  const plus3ISO = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  const minus30ISO = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const minus24hISO = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const [
    clientsRes,
    transactionsRes,
    activitiesRes,
    matchesRes,
    bbaRes,
  ] = await Promise.all([
    // 1. Clients — exclude closed at the SQL level
    supabase
      .from("clients")
      .select("id, name, town, status, lead_score, budget_min, budget_max, phone, birthday, home_purchase_date")
      .eq("agent_id", user.id)
      .neq("status", "closed"),

    // 2. Transactions — closing within the next 3 days
    supabase
      .from("transactions")
      .select("id, client_id, address, closing_date, status")
      .eq("agent_id", user.id)
      .gte("closing_date", todayISO)
      .lte("closing_date", plus3ISO),

    // 3. Activities — last 30 days only, most recent first
    supabase
      .from("activities")
      .select("client_id, created_at")
      .eq("agent_id", user.id)
      .gte("created_at", minus30ISO)
      .order("created_at", { ascending: false }),

    // 4. New MLS matches — last 24h, not yet notified, distinct client_ids
    supabase
      .from("property_matches")
      .select("client_id")
      .eq("agent_id", user.id)
      .eq("notified", false)
      .gte("created_at", minus24hISO),

    // 5. BBA-signed client IDs — any row = signed
    supabase
      .from("buyer_broker_agreements")
      .select("client_id")
      .eq("agent_id", user.id),
  ]);

  // Log errors without crashing the page
  if (clientsRes.error) console.error("[today] clients:", clientsRes.error);
  if (transactionsRes.error) console.error("[today] transactions:", transactionsRes.error);
  if (activitiesRes.error) console.error("[today] activities:", activitiesRes.error);
  if (matchesRes.error) console.error("[today] property_matches:", matchesRes.error);
  if (bbaRes.error) console.error("[today] buyer_broker_agreements:", bbaRes.error);

  const clients = (clientsRes.data ?? []) as TodayClient[];
  const transactions = (transactionsRes.data ?? []) as TodayTransaction[];
  const activities = (activitiesRes.data ?? []) as TodayActivity[];

  // Deduplicate client_ids for matches
  const newMatchClientIds = [
    ...new Set((matchesRes.data ?? []).map((r) => String(r.client_id))),
  ];

  const bbaSignedClientIds = (bbaRes.data ?? []).map((r) => String(r.client_id));

  const { items, overflowCount } = buildTodayItems(
    clients,
    transactions,
    activities,
    newMatchClientIds,
    bbaSignedClientIds,
  );

  const firstName =
    (user.user_metadata?.full_name as string | undefined)?.split(" ")[0] ??
    user.email?.split("@")[0] ??
    "there";

  return (
    <TodayClientComponent
      items={items}
      overflowCount={overflowCount}
      userName={firstName}
    />
  );
}

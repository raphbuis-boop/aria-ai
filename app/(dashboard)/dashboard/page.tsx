import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildTodayItems } from "@/lib/today-items";
import type { TodayClient, TodayTransaction, TodayActivity, NewMatchItem, TodayEngagementEvent } from "@/lib/today-items";
import { TodayClient as TodayClientComponent, type NewLeadRow, type ConversationRow, type ShowingRow, type TaskDueRow } from "./today-client";
import { initials } from "@/lib/utils";
import { ARIA_TASK_KINDS } from "@/lib/sms/tasks";

export const dynamic = "force-dynamic";

type Rel<T> = T | T[] | null | undefined;
const one = <T,>(rel: Rel<T>): T | null => (Array.isArray(rel) ? rel[0] ?? null : rel ?? null);

const CLIENT_COLS =
  "id, name, town, status, lead_score, budget_min, budget_max, phone, birthday, home_purchase_date, created_at, lead_source, source, aria_paused, sms_opted_out";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const minus30ISO = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const minus7ISO = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const minus24hISO = new Date(now.getTime() - 86_400_000).toISOString();

  const [
    profileRes,
    clientsRes,
    closedClientsRes,
    transactionsRes,
    activitiesRes,
    mlsMatchesRes,
    bbaRes,
    showingsTodayRes,
    dismissedRes,
    tasksDueRes,
    ariaShowingRequestsRes,
    ariaTasksRes,
    engagementRes,
  ] = await Promise.all([
    supabase.from("agent_profiles").select("full_name, onboarding_complete").eq("id", user.id).maybeSingle(),
    supabase.from("clients").select(CLIENT_COLS).eq("agent_id", user.id).neq("status", "closed"),
    supabase.from("clients").select(CLIENT_COLS).eq("agent_id", user.id).eq("status", "closed"),
    supabase
      .from("transactions")
      .select("id, client_id, address, closing_date, status, contract_price")
      .eq("agent_id", user.id)
      .eq("status", "active"),
    // Last 30 days — follow-up scoring plus the recent-conversations list.
    supabase
      .from("activities")
      .select("client_id, created_at, type, direction, body, sent, ai_draft, approved, metadata")
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
    supabase.from("buyer_broker_agreements").select("client_id, commission_pct").eq("agent_id", user.id),
    supabase
      .from("showings")
      .select("id, address, showing_date, status, clients(id, name)")
      .eq("agent_id", user.id)
      .gte("showing_date", todayStart.toISOString())
      .lt("showing_date", tomorrowStart.toISOString())
      // Pending SMS requests aren't booked yet; they show under "Aria needs you".
      .in("status", ["scheduled", "completed"])
      .order("showing_date", { ascending: true }),
    supabase
      .from("dismissed_opportunities")
      .select("item_id")
      .eq("agent_id", user.id)
      .gt("dismiss_until", now.toISOString()),
    supabase
      .from("tasks")
      .select("id, client_id, title, due_at, kind, clients(name)")
      .eq("agent_id", user.id)
      .eq("done", false)
      .lt("due_at", tomorrowStart.toISOString())
      .order("due_at", { ascending: true }),
    supabase
      .from("showings")
      .select("id, address, showing_date, requested_time_text, notes, created_at, clients(id, name)")
      .eq("agent_id", user.id)
      .eq("status", "requested")
      .order("created_at", { ascending: true }),
    supabase
      .from("tasks")
      .select("id, kind, title, client_id, created_at, clients(name)")
      .eq("agent_id", user.id)
      .eq("done", false)
      .in("kind", ARIA_TASK_KINDS.filter((k) => k !== "aria_showing_approval"))
      .order("created_at", { ascending: true }),
    // Fail-soft: missing table → [] and scoring falls back to other signals.
    supabase
      .from("client_engagement_events")
      .select("client_id, event_type, created_at, listing_address, mls_number")
      .eq("agent_id", user.id)
      .gte("created_at", minus30ISO),
  ]);

  for (const [name, res] of Object.entries({
    clientsRes, transactionsRes, activitiesRes, showingsTodayRes, tasksDueRes, ariaShowingRequestsRes, ariaTasksRes,
  })) {
    if (res.error) console.error(`[today] ${name}:`, res.error.message);
  }

  if (!profileRes.data?.onboarding_complete) redirect("/onboarding");

  type ClientRow = TodayClient & {
    created_at: string;
    lead_source: string | null;
    source: string | null;
    aria_paused: boolean | null;
    sms_opted_out: boolean | null;
  };
  // A blank name must never crash label builders ("Text Sarah").
  const named = (rows: unknown[] | null) =>
    ((rows ?? []) as ClientRow[]).map((c) => ({ ...c, name: (c.name ?? "").trim() || "Client" }));
  const clients = named(clientsRes.data);
  const clientById = new Map(clients.map((c) => [c.id, c]));

  type ActivityRow = TodayActivity & {
    body: string | null;
    sent: boolean | null;
    ai_draft: boolean | null;
    approved: boolean | null;
    metadata: Record<string, unknown> | null;
  };
  const activities = (activitiesRes.data ?? []) as ActivityRow[];

  const ariaThreadClientIds = new Set(
    activities.filter((a) => a.type === "text" && a.metadata?.channel === "twilio").map((a) => a.client_id),
  );

  // ── Follow-ups (same scoring as before, minus snoozed items) ──
  const seen = new Set<string>();
  const newMatchItems: NewMatchItem[] = [];
  for (const row of mlsMatchesRes.data ?? []) {
    const clientId = String(row.client_id);
    if (seen.has(clientId)) continue;
    seen.add(clientId);
    newMatchItems.push({ clientId, propertyAddress: one(row.properties as Rel<{ address: string }>)?.address ?? null });
  }
  const dismissedIds = new Set((dismissedRes.data ?? []).map((r) => String(r.item_id)));
  const items = buildTodayItems(
    clients,
    (transactionsRes.data ?? []) as TodayTransaction[],
    activities,
    newMatchItems,
    (bbaRes.data ?? []).map((r) => String(r.client_id)),
    (engagementRes.data ?? []) as TodayEngagementEvent[],
    named(closedClientsRes.data),
    new Map(
      (bbaRes.data ?? [])
        .filter((r) => r.commission_pct != null)
        .map((r) => [String(r.client_id), Number(r.commission_pct)]),
    ),
  )
    .filter((i) => !dismissedIds.has(i.id))
    // Leads in an Aria SMS thread are answered from that thread (Aria's
    // number), not the agent's own Messages app.
    .map((i) =>
      ariaThreadClientIds.has(i.clientId) && i.actionType === "text"
        ? { ...i, actionType: "navigate" as const, navigateTo: `/clients/${i.clientId}#messages` }
        : i,
    );

  if (newMatchItems.length > 0) {
    // Shown once on Today, then they stop counting as "new".
    void supabase.from("property_matches").update({ notified: true }).eq("agent_id", user.id).eq("notified", false);
  }

  // ── Recent conversations: latest text per client, last 7 days ──
  const conversations: ConversationRow[] = [];
  const seenThread = new Set<string>();
  for (const a of activities) {
    if (a.type !== "text" || a.created_at < minus7ISO || seenThread.has(a.client_id)) continue;
    // An AI draft that was never approved or sent isn't part of the conversation.
    if (a.ai_draft && !a.approved && !a.sent) continue;
    seenThread.add(a.client_id);
    const c = clientById.get(a.client_id);
    if (!c) continue;
    const viaTwilio = a.direction === "outbound" && a.metadata?.channel === "twilio";
    conversations.push({
      clientId: c.id,
      clientName: c.name,
      body: a.body ?? "",
      inbound: a.direction === "inbound",
      byAria: viaTwilio && a.metadata?.kind !== "agent_reply",
      failed: viaTwilio && !a.sent,
      at: a.created_at,
      ariaActive: !c.aria_paused && !c.sms_opted_out,
    });
    if (conversations.length >= 6) break;
  }

  // ── New leads: clients created in the last 7 days ──
  const textedClientIds = new Set(
    activities.filter((a) => a.type === "text" && a.direction === "outbound" && a.sent).map((a) => a.client_id),
  );
  const newLeads: NewLeadRow[] = clients
    .filter((c) => c.created_at >= minus7ISO)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 5)
    .map((c) => ({
      id: c.id,
      name: c.name,
      source: c.lead_source ?? c.source,
      town: c.town,
      createdAt: c.created_at,
      ariaTexted: textedClientIds.has(c.id),
      ariaPaused: Boolean(c.aria_paused),
    }));

  const showingsToday: ShowingRow[] = (showingsTodayRes.data ?? []).map((s) => ({
    id: String(s.id),
    address: s.address as string | null,
    showingDate: s.showing_date as string | null,
    client: one(s.clients as Rel<{ id: string; name: string }>),
  }));

  const ariaKinds = new Set<string>(ARIA_TASK_KINDS);
  const tasksDue: TaskDueRow[] = (tasksDueRes.data ?? [])
    .filter((t) => !ariaKinds.has(String(t.kind ?? "")))
    .map((t) => ({
      id: String(t.id),
      clientId: t.client_id ? String(t.client_id) : null,
      clientName: one(t.clients as Rel<{ name: string }>)?.name ?? null,
      title: t.title as string,
      dueAt: t.due_at as string | null,
    }));

  const ariaShowingRequests = (ariaShowingRequestsRes.data ?? []).map((r) => ({
    id: String(r.id),
    address: r.address as string | null,
    showing_date: r.showing_date as string | null,
    requested_time_text: r.requested_time_text as string | null,
    notes: r.notes as string | null,
    created_at: r.created_at as string,
    client: one(r.clients as Rel<{ id: string; name: string }>),
  }));
  const ariaTasks = (ariaTasksRes.data ?? []).map((t) => ({
    id: String(t.id),
    kind: String(t.kind),
    title: t.title as string,
    clientId: t.client_id ? String(t.client_id) : null,
    clientName: one(t.clients as Rel<{ name: string }>)?.name ?? null,
    createdAt: t.created_at as string,
  }));

  const fullName =
    (profileRes.data?.full_name as string | undefined) ?? (user.user_metadata?.full_name as string | undefined) ?? null;

  return (
    <TodayClientComponent
      firstName={fullName?.split(" ")[0] ?? "there"}
      agentInitials={initials(fullName)}
      hasAnyClients={clients.length > 0}
      newLeads={newLeads}
      conversations={conversations}
      ariaShowingRequests={ariaShowingRequests}
      ariaTasks={ariaTasks}
      showingsToday={showingsToday}
      tasksDue={tasksDue}
      followUps={items}
    />
  );
}

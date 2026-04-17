import { HomeClient } from "@/components/HomeClient";
import { createClient } from "@/lib/supabase/server";
import {
  endOfMonth,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
} from "date-fns";

export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("agent_profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const displayName = profile?.full_name?.split(" ")[0] ?? "Agent";

  const since24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const since4h = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

  const { count: act24 } = await supabase
    .from("activities")
    .select("*", { count: "exact", head: true })
    .eq("agent_id", user.id)
    .gte("created_at", since24);

  const { data: clients } = await supabase
    .from("clients")
    .select("*")
    .eq("agent_id", user.id);

  const clientList = clients ?? [];

  const top = [...clientList].sort(
    (a, b) => (b.lead_score ?? 0) - (a.lead_score ?? 0),
  )[0];

  const { data: recentActs } = await supabase
    .from("activities")
    .select("client_id, created_at")
    .eq("agent_id", user.id)
    .gte("created_at", since4h);

  const hotIds = new Set(
    (recentActs ?? []).map((a) => a.client_id).filter(Boolean) as string[],
  );
  const hotActivityNames = clientList
    .filter((c) => hotIds.has(c.id))
    .map((c) => c.name);

  const { count: matchCount } = await supabase
    .from("property_matches")
    .select("*", { count: "exact", head: true })
    .eq("agent_id", user.id)
    .eq("notified", false);

  const briefingParts: string[] = [];
  briefingParts.push(`${act24 ?? 0} activities logged in the last 24 hours.`);
  if (top) {
    briefingParts.push(
      `Top lead: ${top.name} (${top.status ?? "new"}) in ${top.town ?? "NJ"}.`,
    );
  }
  if (hotActivityNames.length) {
    briefingParts.push(
      `Recent engagement in the last 4 hours — prioritize follow-ups.`,
    );
  }
  if ((matchCount ?? 0) > 0) {
    briefingParts.push(
      `${matchCount} new property matches found for your active buyers.`,
    );
  }

  const briefing = briefingParts.join(" ");

  const hotClients = clientList
    .filter((c) => (c.lead_score ?? 0) >= 8)
    .slice(0, 2);

  const { data: draftAct } = await supabase
    .from("activities")
    .select("id, body, client_id")
    .eq("agent_id", user.id)
    .eq("ai_draft", true)
    .eq("approved", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let approveDraft: {
    id: string;
    clientId: string;
    clientName: string;
    phone: string | null;
    body: string;
  } | null = null;

  if (draftAct?.client_id) {
    const { data: cli } = await supabase
      .from("clients")
      .select("name, phone")
      .eq("id", draftAct.client_id)
      .maybeSingle();
    approveDraft = {
      id: draftAct.id,
      clientId: draftAct.client_id,
      clientName: cli?.name ?? "Client",
      phone: cli?.phone ?? null,
      body: String(draftAct.body ?? ""),
    };
  }

  const closingClient =
    clientList.find((c) => c.status === "under_contract") ?? null;

  const activeStatuses = new Set([
    "new",
    "contacted",
    "showing",
    "offer",
    "under_contract",
  ]);
  const pipeline = clientList
    .filter((c) => activeStatuses.has(c.status ?? ""))
    .reduce((s, c) => s + (c.budget_max ?? 0), 0);

  const hot = clientList.filter((c) => (c.lead_score ?? 0) >= 8).length;

  const { data: tasks } = await supabase
    .from("tasks")
    .select("due_at, done")
    .eq("agent_id", user.id)
    .eq("done", false);

  const tasksToday =
    tasks?.filter((t) => t.due_at && isToday(parseISO(t.due_at))).length ?? 0;

  const { data: txs } = await supabase
    .from("transactions")
    .select("closing_date")
    .eq("agent_id", user.id);

  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());
  const closings =
    txs?.filter(
      (t) =>
        t.closing_date &&
        isSameMonth(parseISO(t.closing_date), new Date()) &&
        parseISO(t.closing_date) >= monthStart &&
        parseISO(t.closing_date) <= monthEnd,
    ).length ?? 0;

  const { data: matchRows } = await supabase
    .from("property_matches")
    .select(
      `
      id,
      match_score,
      match_reasons,
      notified,
      property_id,
      client_id,
      properties ( address, price, beds, baths, photos ),
      clients ( name )
    `,
    )
    .eq("agent_id", user.id)
    .eq("notified", false)
    .order("match_score", { ascending: false })
    .limit(4);

  const context = `Agent: ${displayName}. Clients: ${clientList.length}. Hot leads: ${hot}. Pipeline: ${pipeline}. Tasks due today: ${tasksToday}.`;

  const matchesNormalized = (matchRows ?? []).map((m) => {
    const p = m.properties as
      | { address: string | null; price: number | null }
      | { address: string | null; price: number | null }[]
      | null;
    const c = m.clients as { name: string | null } | { name: string | null }[] | null;
    const reasons = m.match_reasons as string[] | null;
    return {
      ...m,
      properties: Array.isArray(p) ? p[0] ?? null : p,
      clients: Array.isArray(c) ? c[0] ?? null : c,
      match_reasons: Array.isArray(reasons) ? reasons : reasons ?? [],
    };
  });

  return (
    <HomeClient
      displayName={displayName}
      briefing={briefing}
      hotActivityNames={hotActivityNames}
      hotClients={hotClients}
      approveDraft={approveDraft}
      closingClient={closingClient}
      stats={{
        pipeline,
        hot,
        tasksToday,
        closings,
      }}
      matches={matchesNormalized}
      context={context}
      hasHotLeadPulse={clientList.some((c) => (c.lead_score ?? 0) >= 8)}
    />
  );
}

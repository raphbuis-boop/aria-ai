import { createClient } from "@/lib/supabase/server";
import {
  buildMobileBriefing,
  isHotLead,
  pipelineTotalCompact,
  type MobileClientRow,
  type MobileTxRow,
} from "@/lib/mobile-briefing";
import { MobileAppClient } from "./mobile-app-client";

export const dynamic = "force-dynamic";

export type MobileInboxRow = {
  id: string;
  type: string;
  body: string | null;
  created_at: string;
  ai_draft: boolean | null;
  approved: boolean | null;
  sent: boolean | null;
  client_id: string;
  clients: { name: string | null; phone: string | null } | null;
};

export type MobileBbaAlert = {
  clientId: string;
  clientName: string;
  address: string | null;
  showingDate: string | null;
};

type ShowingRow = {
  id: string;
  client_id: string;
  address: string | null;
  showing_date: string | null;
  clients: { name: string | null } | null;
};

export default async function MobilePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const [
    clientsRes,
    transactionsRes,
    newMatchesRes,
    activitiesRes,
    tasksRes,
    profileRes,
    upcomingShowingsRes,
    bbaRes,
  ] = await Promise.all([
    supabase
      .from("clients")
      .select(
        "id, name, town, status, lead_score, budget_min, budget_max, phone",
      )
      .eq("agent_id", user.id)
      .order("lead_score", { ascending: false, nullsFirst: false }),
    supabase
      .from("transactions")
      .select("id, client_id, address, closing_date, status")
      .eq("agent_id", user.id),
    supabase
      .from("property_matches")
      .select("*", { count: "exact", head: true })
      .eq("agent_id", user.id)
      .eq("notified", false),
    supabase
      .from("activities")
      .select(
        `
        id,
        type,
        body,
        created_at,
        ai_draft,
        approved,
        sent,
        client_id,
        clients ( name, phone )
      `,
      )
      .eq("agent_id", user.id)
      .or("ai_draft.eq.false,sent.eq.false")
      .order("created_at", { ascending: false })
      .limit(80),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("agent_id", user.id)
      .eq("done", false),
    supabase
      .from("agent_profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("showings")
      .select("id, client_id, address, showing_date, clients(name)")
      .eq("agent_id", user.id)
      .gte("showing_date", new Date().toISOString())
      .order("showing_date", { ascending: true }),
    supabase
      .from("buyer_broker_agreements")
      .select("client_id")
      .eq("agent_id", user.id),
  ]);

  if (upcomingShowingsRes.error)
    console.error("[mobile] showings:", upcomingShowingsRes.error);
  if (bbaRes.error) console.error("[mobile] bba:", bbaRes.error);

  const clients = (clientsRes.data as MobileClientRow[] | null) ?? [];
  const transactions = (transactionsRes.data as MobileTxRow[] | null) ?? [];
  const newMatches = newMatchesRes.count ?? 0;

  const signedClientIds = new Set(
    (bbaRes.data ?? []).map((r) => String(r.client_id)),
  );
  const bbaAlerts: MobileBbaAlert[] = (
    (upcomingShowingsRes.data as ShowingRow[] | null) ?? []
  )
    .filter((s) => !signedClientIds.has(String(s.client_id ?? "")))
    .map((s) => ({
      clientId: String(s.client_id ?? ""),
      clientName: s.clients?.name ?? "Client",
      address: s.address,
      showingDate: s.showing_date,
    }));

  const inboxRows: MobileInboxRow[] = (activitiesRes.data ?? []).map((r) => {
    const c = r.clients as
      | { name: string | null; phone: string | null }
      | { name: string | null; phone: string | null }[]
      | null;
    const client = Array.isArray(c) ? c[0] : c;
    return { ...r, clients: client ?? null };
  });

  const visible = clients.filter((c) => c.status !== "closed");
  const hotLeads = clients.filter(
    (c) => isHotLead(c) && c.status !== "closed",
  );
  const underContractCount = Math.max(
    visible.filter((c) => c.status === "under_contract").length,
    transactions.filter((t) =>
      ["under_contract", "active"].includes(String(t.status ?? "active")),
    ).length,
  );

  const briefing = buildMobileBriefing(clients, transactions, newMatches);
  const draftPending = inboxRows.filter((r) => r.ai_draft && !r.approved);

  const followUpPreview = (() => {
    const v = visible.filter((c) => c.status !== "closed");
    return (
      v.find(
        (c) =>
          !isHotLead(c) &&
          (c.lead_score ?? 0) >= 5,
      ) ?? null
    );
  })();

  const fullName =
    profileRes.data?.full_name ??
    (user.user_metadata?.full_name as string | undefined) ??
    null;
  const email = user.email ?? null;

  return (
    <MobileAppClient
      user={{ email, fullName }}
      briefing={briefing}
      newMatches={newMatches}
      bbaAlerts={bbaAlerts}
      followUpPreview={followUpPreview}
      totalClients={clients.length}
      stats={{
        pipelineLabel: pipelineTotalCompact(visible),
        hotCount: hotLeads.length,
        activeCount: visible.length,
        closings: underContractCount,
        tasksOpen: tasksRes.count ?? 0,
      }}
      hotLeads={hotLeads}
      inboxRows={inboxRows}
      draftPendingCount={draftPending.length}
    />
  );
}

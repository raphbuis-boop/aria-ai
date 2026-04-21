import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "./dashboard-client";

export const dynamic = "force-dynamic";

type ClientRow = {
  id: string;
  name: string;
  town: string | null;
  status: string | null;
  lead_score: number | null;
  budget_min: number | null;
  budget_max: number | null;
  phone: string | null;
  client_role: string | null;
};

type ShowingRow = {
  id: string;
  client_id: string;
  address: string | null;
  showing_date: string | null;
  clients: { name: string | null } | null;
};

type TxRow = {
  id: string;
  client_id: string;
  address: string | null;
  closing_date: string | null;
  status: string | null;
};

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <DashboardClient user={null} initial={empty()} />;
  }

  const [
    { data: clients },
    { data: transactions },
    { count: newMatchesCount },
    { data: upcomingShowings },
    { data: bbaRows },
  ] = await Promise.all([
    supabase
      .from("clients")
      .select(
        "id, name, town, status, lead_score, budget_min, budget_max, phone, client_role",
      )
      .eq("agent_id", user.id)
      .order("lead_score", { ascending: false }),
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

  const signedClientIds = new Set(
    (bbaRows ?? []).map((r) => String(r.client_id)),
  );

  const bbaAlerts = ((upcomingShowings as ShowingRow[] | null) ?? [])
    .filter((s) => !signedClientIds.has(String(s.client_id ?? "")))
    .map((s) => ({
      clientId: String(s.client_id ?? ""),
      clientName: s.clients?.name ?? "Client",
      address: s.address,
      showingDate: s.showing_date,
    }));

  return (
    <DashboardClient
      user={{
        email: user.email ?? null,
        fullName:
          (user.user_metadata?.full_name as string | undefined) ?? null,
      }}
      initial={{
        clients: (clients as ClientRow[] | null) ?? [],
        transactions: (transactions as TxRow[] | null) ?? [],
        newMatches: newMatchesCount ?? 0,
        bbaAlerts,
      }}
    />
  );
}

function empty() {
  return { clients: [], transactions: [], newMatches: 0, bbaAlerts: [] };
}

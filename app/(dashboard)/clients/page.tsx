import { createClient } from "@/lib/supabase/server";
import { ClientsPageClient } from "./clients-client";
import { commissionFor } from "@/lib/today-items";
import type { TodayActivity, TodayTransaction } from "@/lib/today-items";

function normalizePhone(p: string | null | undefined): string {
  return (p ?? "").replace(/\D/g, "");
}

function dedupeClients<T extends { id: string; email?: string | null; phone?: string | null }>(
  rows: T[],
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const c of rows) {
    const e = (c.email ?? "").trim().toLowerCase();
    const ph = normalizePhone(c.phone);
    const key = e || ph || c.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

export default async function ClientsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: clients }, { data: activeTransactions }, { data: activities }, { data: bbas }] = await Promise.all([
    supabase
      .from("clients")
      .select("id, name, town, status, lead_score, budget_min, budget_max, phone, email, beds_wanted, baths_wanted, notes, client_role")
      .eq("agent_id", user.id)
      .order("last_engagement_at", { ascending: false }),

    // Active deals — real contract_price beats a budget-based estimate, and
    // closing_date feeds computeLeadScore's closing-proximity boost.
    supabase
      .from("transactions")
      .select("id, client_id, contract_price, address, closing_date, status")
      .eq("agent_id", user.id)
      .eq("status", "active"),

    // Full activity history — computeLeadScore needs the true last-contact
    // date, not a rolling window, so a client gone quiet for months still
    // scores as stale rather than reading as "no data".
    supabase
      .from("activities")
      .select("client_id, created_at, type, direction")
      .eq("agent_id", user.id),

    // Signed BBAs — real commission rate beats the 2.5% default.
    supabase
      .from("buyer_broker_agreements")
      .select("client_id, commission_pct")
      .eq("agent_id", user.id),
  ]);

  const dealValueByClient = new Map<string, number>();
  for (const t of activeTransactions ?? []) {
    if (t.contract_price) dealValueByClient.set(String(t.client_id), t.contract_price as number);
  }

  const commissionPctByClient = new Map<string, number>();
  for (const b of bbas ?? []) {
    if (b.commission_pct != null) commissionPctByClient.set(String(b.client_id), Number(b.commission_pct));
  }

  const transactions = (activeTransactions ?? []) as TodayTransaction[];
  const clientActivities = (activities ?? []) as TodayActivity[];

  const rows = dedupeClients(clients ?? []).map((c) => {
    const dealValue = dealValueByClient.get(c.id as string) ?? (c.budget_max as number | null) ?? null;
    return {
      ...c,
      dealValue,
      dealValueIsReal: dealValueByClient.has(c.id as string),
      commissionEst: commissionFor(dealValue, commissionPctByClient.get(c.id as string)),
    };
  });

  return <ClientsPageClient initial={rows} activities={clientActivities} transactions={transactions} />;
}

import { createClient } from "@/lib/supabase/server";
import { ClientsPageClient } from "./clients-client";
import { commissionFor } from "@/lib/today-items";

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

  const [{ data: clients }, { data: activeTransactions }] = await Promise.all([
    supabase
      .from("clients")
      .select("id, name, town, status, lead_score, budget_min, budget_max, phone, email, beds_wanted, baths_wanted, notes, client_role")
      .eq("agent_id", user.id)
      .order("last_engagement_at", { ascending: false }),

    // Active deals — real contract_price beats a budget-based estimate.
    supabase
      .from("transactions")
      .select("client_id, contract_price")
      .eq("agent_id", user.id)
      .eq("status", "active"),
  ]);

  const dealValueByClient = new Map<string, number>();
  for (const t of activeTransactions ?? []) {
    if (t.contract_price) dealValueByClient.set(String(t.client_id), t.contract_price as number);
  }

  const rows = dedupeClients(clients ?? []).map((c) => {
    const dealValue = dealValueByClient.get(c.id as string) ?? (c.budget_max as number | null) ?? null;
    return {
      ...c,
      dealValue,
      dealValueIsReal: dealValueByClient.has(c.id as string),
      commissionEst: commissionFor(dealValue),
    };
  });

  return <ClientsPageClient initial={rows} />;
}

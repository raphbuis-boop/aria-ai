import { createClient } from "@/lib/supabase/server";
import { ClientsPageClient } from "./clients-client";
import { redirect } from "next/navigation";

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
  if (!user) redirect("/login");

  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, town, status, lead_score, budget_min, budget_max, phone, email, beds_wanted, baths_wanted, notes, client_role")
    .eq("agent_id", user.id)
    .order("last_engagement_at", { ascending: false });

  return <ClientsPageClient initial={dedupeClients(clients ?? [])} />;
}

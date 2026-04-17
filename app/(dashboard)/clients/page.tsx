import { createClient } from "@/lib/supabase/server";
import { ClientsPageClient } from "./clients-client";

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

  const { data: clients } = await supabase
    .from("clients")
    .select("*")
    .eq("agent_id", user.id)
    .order("last_engagement_at", { ascending: false });

  return <ClientsPageClient initial={dedupeClients(clients ?? [])} />;
}

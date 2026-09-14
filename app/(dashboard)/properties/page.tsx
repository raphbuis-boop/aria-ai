import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PropertiesClient } from "./properties-client";

type JoinedClient = { id: string; name: string | null };
type MatchRow = {
  property_id: string;
  match_score: number | null;
  match_reasons: unknown;
  clients: JoinedClient | JoinedClient[] | null;
};

export type PropertyMatch = { clientId: string; clientName: string; score: number; reasons: string[] };

export default async function PropertiesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: props }, { data: matches }] = await Promise.all([
    supabase
      .from("properties")
      .select("*")
      .eq("agent_id", user.id)
      .order("created_at", { ascending: false }),
    // Highest score first — matchMap[id][0] is always the best match.
    supabase
      .from("property_matches")
      .select("property_id, match_score, match_reasons, clients(id, name)")
      .eq("agent_id", user.id)
      .order("match_score", { ascending: false }),
  ]);

  const matchMap: Record<string, PropertyMatch[]> = {};
  for (const raw of (matches ?? []) as unknown as MatchRow[]) {
    const pid = raw.property_id;
    const joined = Array.isArray(raw.clients) ? raw.clients[0] : raw.clients;
    if (!pid || !joined) continue;
    (matchMap[pid] ||= []).push({
      clientId: joined.id,
      clientName: joined.name ?? "Client",
      score: Number(raw.match_score ?? 0),
      reasons: Array.isArray(raw.match_reasons) ? (raw.match_reasons as string[]) : [],
    });
  }

  const properties = (props ?? []).map((p) => ({
    ...p,
    matches: matchMap[p.id as string] ?? [],
  }));

  return <PropertiesClient initial={properties} />;
}

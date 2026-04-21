import { createClient } from "@/lib/supabase/server";
import { PropertiesClient, type PropertyMatchMap } from "./properties-client";

type JoinedClient = { id: string; name: string | null };
type MatchRow = {
  property_id: string;
  match_score: number | null;
  // Supabase's generated types model the join as an array; at runtime this is
  // the related row (single row per FK) so we normalize to "first match".
  clients: JoinedClient | JoinedClient[] | null;
};

export default async function PropertiesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: props }, { data: matches }] = await Promise.all([
    supabase
      .from("properties")
      .select("*")
      .eq("agent_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("property_matches")
      .select("property_id, match_score, clients(id, name)")
      .eq("agent_id", user.id)
      .order("match_score", { ascending: false }),
  ]);

  const matchMap: PropertyMatchMap = {};
  for (const raw of (matches ?? []) as unknown as MatchRow[]) {
    const pid = raw.property_id;
    const joined = Array.isArray(raw.clients) ? raw.clients[0] : raw.clients;
    if (!pid || !joined) continue;
    (matchMap[pid] ||= []).push({
      client_id: joined.id,
      client_name: joined.name ?? "Client",
      score: Number(raw.match_score ?? 0),
    });
  }

  const available =
    props?.filter((p) => p.status === "available").length ?? 0;

  return (
    <PropertiesClient
      initial={props ?? []}
      availableCount={available}
      matchMap={matchMap}
    />
  );
}

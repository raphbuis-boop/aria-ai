import { fetchMlsListingsForClient } from "@/lib/simplyrets";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ClientDetail } from "./client-detail";

export default async function ClientDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", params.id)
    .eq("agent_id", user.id)
    .maybeSingle();

  if (!client) notFound();

  const { data: activities } = await supabase
    .from("activities")
    .select("*")
    .eq("client_id", params.id)
    .order("created_at", { ascending: false });

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("client_id", params.id)
    .order("due_at", { ascending: true });

  const { data: files } = await supabase
    .from("files")
    .select("*")
    .eq("client_id", params.id);

  const { data: showings } = await supabase
    .from("showings")
    .select("*")
    .eq("client_id", params.id)
    .order("showing_date", { ascending: false });

  const { data: matches } = await supabase
    .from("property_matches")
    .select("*, properties(*)")
    .eq("client_id", params.id)
    .order("match_score", { ascending: false });

  const { data: bba } = await supabase
    .from("buyer_broker_agreements")
    .select("signed_at, commission_pct, term_start, term_end, search_area, agent_name, client_name")
    .eq("client_id", params.id)
    .order("signed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const mlsLive = await fetchMlsListingsForClient({
    city: client.town as string | null,
    minPrice: client.budget_min as number | null,
    maxPrice: client.budget_max as number | null,
    minBeds: client.beds_wanted as number | null,
    limit: 24,
  });

  return (
    <ClientDetail
      client={client}
      activities={activities ?? []}
      tasks={tasks ?? []}
      files={files ?? []}
      showings={showings ?? []}
      matches={matches ?? []}
      mlsLive={mlsLive}
      bba={bba ?? null}
    />
  );
}

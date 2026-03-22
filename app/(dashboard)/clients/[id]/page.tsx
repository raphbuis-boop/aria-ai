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

  return (
    <ClientDetail
      client={client}
      activities={activities ?? []}
      tasks={tasks ?? []}
      files={files ?? []}
      showings={showings ?? []}
      matches={matches ?? []}
    />
  );
}

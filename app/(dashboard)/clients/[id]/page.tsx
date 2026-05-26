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
    .eq("agent_id", user.id) // multi-tenant safety
    .maybeSingle();

  if (!client) notFound();

  const minus24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [{ data: activities }, { data: tasks }, { data: matches }] =
    await Promise.all([
      // All activities for this client, newest first
      supabase
        .from("activities")
        .select("id, type, body, ai_draft, approved, sent, created_at")
        .eq("client_id", params.id)
        .eq("agent_id", user.id)
        .order("created_at", { ascending: false }),

      // Open tasks
      supabase
        .from("tasks")
        .select("id, done")
        .eq("client_id", params.id)
        .eq("agent_id", user.id),

      // Property matches — recent (last 24h, unnotified) for badge count
      supabase
        .from("property_matches")
        .select("id, created_at, notified")
        .eq("client_id", params.id)
        .eq("agent_id", user.id)
        .gte("created_at", minus24h)
        .eq("notified", false),
    ]);

  const allActivities = activities ?? [];
  const allTasks = tasks ?? [];
  const allMatches = matches ?? [];

  // Inbox: drafts awaiting agent review (activities table has no inbound
  // direction — inbox = ai_draft=true, approved=false, sent=false)
  const draftCount = allActivities.filter(
    (a) => a.ai_draft && !a.approved && !a.sent,
  ).length;

  const lastDraftBody =
    (allActivities.find((a) => a.ai_draft && !a.approved && !a.sent)
      ?.body as string | null) ?? null;

  const openTaskCount = allTasks.filter((t) => !t.done).length;

  const recentMatchCount = allMatches.length;

  // Last 5 activities for the timeline
  const recentActivities = allActivities.slice(0, 5);

  return (
    <ClientDetail
      client={client}
      recentActivities={recentActivities}
      draftCount={draftCount}
      lastDraftBody={lastDraftBody}
      openTaskCount={openTaskCount}
      recentMatchCount={recentMatchCount}
    />
  );
}

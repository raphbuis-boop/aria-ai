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

  const [
    { data: activities },
    { data: tasks },
    { data: matches },
    { data: matchedPropertyRows },
  ] = await Promise.all([
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

    // Matched properties with details — top 3 by score for the strip
    supabase
      .from("property_matches")
      .select("match_score, properties(id, address, price, beds, baths, town, status)")
      .eq("client_id", params.id)
      .eq("agent_id", user.id)
      .order("match_score", { ascending: false })
      .limit(3),
  ]);

  const allActivities = activities ?? [];
  const allTasks = tasks ?? [];
  const allMatches = matches ?? [];

  const draftCount = allActivities.filter(
    (a) => a.ai_draft && !a.approved && !a.sent,
  ).length;

  const lastDraftBody =
    (allActivities.find((a) => a.ai_draft && !a.approved && !a.sent)
      ?.body as string | null) ?? null;

  const openTaskCount = allTasks.filter((t) => !t.done).length;
  const recentMatchCount = allMatches.length;
  const recentActivities = allActivities.slice(0, 5);

  // Normalise the property_matches join (Supabase returns the FK join as
  // a single object or null, but TypeScript types it as array or object)
  type RawMatchRow = {
    match_score: number | null;
    properties: {
      id: string;
      address: string | null;
      price: number | null;
      beds: number | null;
      baths: number | null;
      town: string | null;
      status: string | null;
    } | {
      id: string;
      address: string | null;
      price: number | null;
      beds: number | null;
      baths: number | null;
      town: string | null;
      status: string | null;
    }[] | null;
  };

  const matchedProperties = ((matchedPropertyRows ?? []) as unknown as RawMatchRow[])
    .map((row) => {
      const prop = Array.isArray(row.properties) ? row.properties[0] : row.properties;
      if (!prop) return null;
      return {
        id: prop.id,
        address: prop.address,
        price: prop.price,
        beds: prop.beds,
        baths: prop.baths,
        town: prop.town,
        status: prop.status,
        score: Number(row.match_score ?? 0),
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  return (
    <ClientDetail
      client={client}
      recentActivities={recentActivities}
      draftCount={draftCount}
      lastDraftBody={lastDraftBody}
      openTaskCount={openTaskCount}
      recentMatchCount={recentMatchCount}
      matchedProperties={matchedProperties}
    />
  );
}

import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ClientDetail } from "./client-detail";
import { buildClientBrief } from "@/lib/client-brief";

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
    { data: recentMatches },
    { data: matchedPropertyRows },
    { data: transactions },
    { data: bba },
  ] = await Promise.all([
    // Full activity history for this client, newest first — the timeline.
    supabase
      .from("activities")
      .select("id, type, direction, body, ai_draft, approved, sent, created_at")
      .eq("client_id", params.id)
      .eq("agent_id", user.id)
      .order("created_at", { ascending: false }),

    // Property matches — recent (last 24h, unnotified), feeds the briefing.
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

    // Transactions for this client — deal value, closing date, status.
    supabase
      .from("transactions")
      .select("id, status, closing_date, contract_price")
      .eq("client_id", params.id)
      .eq("agent_id", user.id),

    // Signed BBA — real commission rate, beats the 2.5% default.
    supabase
      .from("buyer_broker_agreements")
      .select("commission_pct")
      .eq("client_id", params.id)
      .eq("agent_id", user.id)
      .maybeSingle(),
  ]);

  const allActivities = activities ?? [];
  const allMatches = recentMatches ?? [];
  const allTransactions = transactions ?? [];

  const draftCount = allActivities.filter(
    (a) => a.ai_draft && !a.approved && !a.sent,
  ).length;

  const lastDraftBody =
    (allActivities.find((a) => a.ai_draft && !a.approved && !a.sent)
      ?.body as string | null) ?? null;

  const recentMatchCount = allMatches.length;

  const brief = buildClientBrief(
    {
      name: client.name as string,
      phone: client.phone as string | null,
      status: client.status as string | null,
      clientRole: client.client_role as string | null,
      budgetMin: client.budget_min as number | null,
      budgetMax: client.budget_max as number | null,
      town: client.town as string | null,
      leadScore: client.lead_score as number | null,
    },
    allActivities,
    allTransactions,
    allMatches,
    (bba?.commission_pct as number | null | undefined) ?? null,
  );

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
      activities={allActivities}
      draftCount={draftCount}
      lastDraftBody={lastDraftBody}
      recentMatchCount={recentMatchCount}
      matchedProperties={matchedProperties}
      brief={brief}
    />
  );
}

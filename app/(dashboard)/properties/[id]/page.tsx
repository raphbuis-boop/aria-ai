import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { PropertyPageClient } from "./property-page-client";
import { InternalPropertyDetail } from "./internal-property-detail";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function PropertyByIdPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { return?: string };
}) {
  const id = decodeURIComponent(params.id);
  const returnTo =
    typeof searchParams.return === "string" ? searchParams.return : null;

  if (UUID_RE.test(id)) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const [{ data: prop }, { data: matchRows }] = await Promise.all([
      supabase
        .from("properties")
        .select("*")
        .eq("id", id)
        .eq("agent_id", user.id)
        .maybeSingle(),

      supabase
        .from("property_matches")
        .select("match_score, match_reasons, clients(id, name)")
        .eq("property_id", id)
        .eq("agent_id", user.id)
        .order("match_score", { ascending: false }),
    ]);

    if (!prop) notFound();

    type JoinedClient = { id: string; name: string | null };
    type MatchRow = {
      match_score: number | null;
      match_reasons: unknown;
      clients: JoinedClient | JoinedClient[] | null;
    };

    const matches = ((matchRows ?? []) as unknown as MatchRow[])
      .map((m) => {
        const client = Array.isArray(m.clients) ? m.clients[0] : m.clients;
        if (!client) return null;
        return {
          clientId: client.id,
          clientName: client.name ?? "Client",
          score: Number(m.match_score ?? 0),
          reasons: Array.isArray(m.match_reasons) ? (m.match_reasons as string[]) : [],
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);

    const townForMarket = (prop as { town?: string | null }).town ?? null;
    const { data: market } = townForMarket
      ? await supabase.from("market_data").select("*").eq("town", townForMarket).maybeSingle()
      : { data: null };

    return (
      <InternalPropertyDetail
        property={prop as Record<string, unknown>}
        matches={matches}
        market={(market as Record<string, unknown> | null) ?? null}
        returnTo={returnTo}
      />
    );
  }

  return <PropertyPageClient mode="mls" mlsId={id} returnTo={returnTo} />;
}

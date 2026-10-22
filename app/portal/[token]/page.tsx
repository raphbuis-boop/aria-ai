import { createAdminClient } from "@/lib/supabase/admin";
import { MarketsComingSoonNote } from "@/components/MarketsComingSoonNote";
import { MarketCard } from "@/components/MarketCard";
import { PortalBeacon } from "@/components/PortalBeacon";
import { PortalListingCard } from "@/components/PortalListingCard";

export default async function PortalPage(
  props: {
    params: Promise<{ token: string }>;
  }
) {
  const params = await props.params;
  const admin = createAdminClient();
  const { data: client } = await admin
    .from("clients")
    .select("*")
    .eq("portal_token", params.token)
    .maybeSingle();

  if (!client) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="text-[15px] text-foreground/75">
          This link is no longer active.
        </p>
      </div>
    );
  }

  const town = client.town ? String(client.town) : null;

  const [
    { data: agent },
    { data: matches },
    { data: market },
  ] = await Promise.all([
    admin
      .from("agent_profiles")
      .select("full_name, phone, email")
      .eq("id", client.agent_id)
      .maybeSingle(),
    admin
      .from("property_matches")
      .select("*, properties(*)")
      .eq("client_id", client.id)
      .order("match_score", { ascending: false }),
    // The agent's tasks are internal ("Archive / re-qualify", "Reply to …") and
    // are never shown to the client.
    town
      ? admin.from("market_data").select("*").eq("town", town).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const first = String(client.name ?? "there").split(" ")[0];

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <PortalBeacon token={params.token} />
      <div className="text-[22px] font-medium text-primary">Aria</div>
      <div className="text-[13px] text-muted-foreground">{agent?.full_name}</div>
      <div className="mt-6 text-[22px] text-foreground">Hi {first},</div>

      <div className="mt-8">
        <div className="text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">
          Your saved homes
        </div>
        <div className="mt-3 space-y-3">
          {(matches ?? []).map((m) => {
            const p = m.properties as Record<string, unknown> | null;
            const reasons = (m.match_reasons as string[]) ?? [];
            return (
              <PortalListingCard
                key={String(m.id)}
                token={params.token}
                listingId={String(p?.id ?? m.id)}
                address={String(p?.address ?? "")}
                price={(p?.price as number | null) ?? null}
                reasons={reasons}
                mlsNumber={(p?.mls_number as string | null) ?? null}
              />
            );
          })}
        </div>
      </div>

      <div className="mt-8">
        <div className="text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">
          Market update
        </div>
        <MarketsComingSoonNote className="mt-2" />
        {market ? (
          <div className="mt-3">
            <MarketCard
              town={market.town}
              avg_sale_price={market.avg_sale_price}
              days_on_market={market.days_on_market}
              price_change_pct={market.price_change_pct}
              inventory_change_pct={market.inventory_change_pct}
              month_year={market.month_year}
            />
          </div>
        ) : null}
      </div>

      <div className="mt-10 flex flex-col gap-2">
        {agent?.phone ? (
          <a
            href={`tel:${agent.phone}`}
            className="rounded-[8px] bg-primary py-3 text-center text-[14px] font-medium text-primary-foreground"
          >
            Message your agent
          </a>
        ) : null}
        {agent?.email ? (
          <a
            href={`mailto:${agent.email}`}
            className="rounded-[8px] border border-border py-3 text-center text-[14px] text-primary"
          >
            Email your agent
          </a>
        ) : null}
      </div>
    </div>
  );
}

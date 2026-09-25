import { createAdminClient } from "@/lib/supabase/admin";
import { MarketsComingSoonNote } from "@/components/MarketsComingSoonNote";
import { MarketCard } from "@/components/MarketCard";
import { PortalBeacon } from "@/components/PortalBeacon";
import { PortalListingCard } from "@/components/PortalListingCard";
import { fmtDate } from "@/lib/utils";

export default async function PortalPage({
  params,
}: {
  params: { token: string };
}) {
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

  const town = String(client.town ?? "Ridgewood");

  const [
    { data: agent },
    { data: matches },
    { data: tasks },
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
    admin
      .from("tasks")
      .select("*")
      .eq("client_id", client.id)
      .order("due_at", { ascending: true }),
    admin
      .from("market_data")
      .select("*")
      .eq("town", town)
      .maybeSingle(),
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
          Next steps
        </div>
        <div className="mt-3 space-y-2">
          {(tasks ?? []).map((t) => (
            <div
              key={String(t.id)}
              className="flex items-start justify-between gap-3 rounded-[10px] border border-border bg-card px-3 py-2"
            >
              <span
                className={`text-[13px] ${t.done ? "text-muted-foreground line-through" : "text-foreground"}`}
              >
                {String(t.title)}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {fmtDate(t.due_at as string | null)}
              </span>
            </div>
          ))}
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

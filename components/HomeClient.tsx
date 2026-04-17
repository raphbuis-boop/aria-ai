"use client";

import { MarketsComingSoonNote } from "@/components/MarketsComingSoonNote";
import { ActionCard } from "@/components/ActionCard";
import { AIBar } from "@/components/AIBar";
import { FocusModeToggle } from "@/components/FocusModeCard";
import { MorningBriefing } from "@/components/MorningBriefing";
import { PulseIndicator } from "@/components/PulseIndicator";
import { createClient } from "@/lib/supabase/client";
import { fmtMoney, initials } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type Client = {
  id: string;
  name: string;
  town: string | null;
  status: string | null;
  lead_score: number | null;
  budget_max: number | null;
  phone: string | null;
};

type MatchRow = {
  id: string;
  match_score: number | null;
  match_reasons: string[] | null;
  notified: boolean | null;
  property_id: string;
  client_id: string;
  properties: {
    address: string | null;
    price: number | null;
    beds?: number | null;
    baths?: number | null;
    photos?: unknown;
  } | null;
  clients: { name: string | null } | null;
};

export function HomeClient({
  displayName,
  briefing,
  hotActivityNames,
  hotClients,
  approveDraft,
  closingClient,
  stats,
  matches,
  context,
  hasHotLeadPulse,
}: {
  displayName: string;
  briefing: string;
  hotActivityNames: string[];
  hotClients: Client[];
  approveDraft: {
    id: string;
    clientId: string;
    clientName: string;
    phone: string | null;
    body: string;
  } | null;
  closingClient: Client | null;
  stats: {
    pipeline: number;
    hot: number;
    tasksToday: number;
    closings: number;
  };
  matches: MatchRow[];
  context: string;
  hasHotLeadPulse: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [focus, setFocus] = useState(false);
  const mlsSyncRan = useRef(false);

  useEffect(() => {
    if (mlsSyncRan.current) return;
    mlsSyncRan.current = true;
    void (async () => {
      const params = new URLSearchParams();
      params.set("state", "NJ");
      params.set("limit", "20");
      const res = await fetch(`/api/mls/listings?${params}`);
      const data = await res.json();
      if (!data.listings?.length) return;
      await fetch("/api/mls/apply-matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listings: data.listings }),
      });
      router.refresh();
    })();
  }, [router]);

  const stack = useMemo(() => {
    const cards: React.ReactNode[] = [];
    const hot = hotClients[0];
    if (hot) {
      cards.push(
        <ActionCard
          key="hot"
          kind="hot"
          title={`${hot.name} · ${hot.town ?? ""}`}
          subtitle={hot.status ?? ""}
          body={`Lead score ${hot.lead_score ?? 0} · prioritize outreach`}
          timestamp="now"
          clientId={hot.id}
          clientPhone={hot.phone}
        />,
      );
    }
    if (approveDraft) {
      cards.push(
        <ActionCard
          key="approve"
          kind="approve"
          title={approveDraft.clientName}
          draft={approveDraft.body}
          clientId={approveDraft.clientId}
          clientPhone={approveDraft.phone}
          activityId={approveDraft.id}
        />,
      );
    }
    if (closingClient) {
      cards.push(
        <ActionCard
          key="close"
          kind="closing"
          title={`${closingClient.name} — under contract`}
          subtitle={closingClient.town ?? ""}
          body="Milestone check-ins due"
        />,
      );
    }
    if (!cards.length) {
      cards.push(
        <div
          key="empty"
          className="rounded-[14px] border border-border-card bg-bg-card p-4 text-[13px] text-text-muted"
        >
          You’re caught up. Tap Pipeline to move deals forward.
        </div>,
      );
    }
    return cards;
  }, [approveDraft, closingClient, hotClients]);

  const visibleStack = focus ? stack.slice(0, 1) : stack.slice(0, 3);

  async function dismissMatch(id: string) {
    await supabase.from("property_matches").update({ notified: true }).eq("id", id);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-8 pt-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-medium text-accent-blue">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </div>
          <div className="mt-1 flex items-center gap-2 text-[19px] text-text-primary">
            good morning, {displayName}
            <PulseIndicator active={hasHotLeadPulse} />
          </div>
        </div>
        <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-border-card bg-bg-card text-[12px] font-medium text-accent-blue">
          {initials(displayName)}
        </div>
      </header>

      <div className="mt-5">
        <MorningBriefing text={briefing} />
        {hotActivityNames.length ? (
          <p className="mt-2 text-[13px] font-medium text-accent-amber">
            Hot: {hotActivityNames.join(", ")}
          </p>
        ) : null}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div className="text-[10px] font-medium uppercase tracking-[0.07em] text-text-dim">
          Action stack
        </div>
        <FocusModeToggle on={focus} onToggle={() => setFocus((v) => !v)} />
      </div>
      <div className="mt-3 space-y-3">{visibleStack}</div>

      {matches.length ? (
        <div className="mt-8">
          <div className="text-[10px] font-medium uppercase tracking-[0.07em] text-text-dim">
            New property matches
          </div>
          <div className="mt-3 space-y-3">
            {matches.slice(0, 2).map((m) => (
              <div
                key={m.id}
                className="rounded-[14px] border border-border-card bg-bg-card p-4"
              >
                {(() => {
                  const ph = m.properties?.photos;
                  const url =
                    Array.isArray(ph) && ph[0]
                      ? typeof ph[0] === "string"
                        ? ph[0]
                        : String((ph[0] as { href?: string }).href ?? "")
                      : null;
                  return url ? (
                    <div className="mb-3 h-28 w-full overflow-hidden rounded-[10px] bg-bg-deep">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : null;
                })()}
                <div className="text-[14px] font-medium text-text-primary">
                  {m.properties?.address}
                </div>
                <div className="text-[13px] text-accent-blue">
                  {m.properties?.price != null
                    ? fmtMoney(m.properties.price)
                    : "—"}
                </div>
                <div className="mt-1 text-[11px] text-text-dim">
                  {m.properties?.beds != null ? `${m.properties.beds} bd` : ""}
                  {m.properties?.baths != null
                    ? ` · ${m.properties.baths} ba`
                    : ""}
                </div>
                <div className="mt-2 text-[12px] text-text-secondary">
                  Matches{" "}
                  <span className="font-medium text-accent-amber">
                    {m.clients?.name}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(m.match_reasons ?? []).map((r) => (
                    <span
                      key={r}
                      className="rounded-full bg-bg-deep px-2 py-0.5 text-[11px] text-text-muted"
                    >
                      {r}
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-[8px] border border-border-card bg-bg-card px-3 py-2 text-[12px] font-medium text-accent-blue"
                    onClick={async () => {
                      const clientId = m.client_id;
                      const res = await fetch("/api/ai/draft-text", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          clientId,
                          clientName: m.clients?.name,
                          matchPing: true,
                          propertyContext: `${m.properties?.beds ?? "?"} bed / ${m.properties?.baths ?? "?"} bath at ${m.properties?.address} — ${fmtMoney(m.properties?.price ?? null)}`,
                          scenario: "Property match text",
                          skipInsert: false,
                        }),
                      });
                      await res.json();
                      router.push("/inbox");
                    }}
                  >
                    AI Text Client
                  </button>
                  <button
                    type="button"
                    onClick={() => dismissMatch(m.id)}
                    className="rounded-[8px] border border-border-card bg-bg-primary px-3 py-2 text-[12px] text-text-dim"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
          <Link
            href="/properties"
            className="mt-3 inline-block text-[12px] font-medium text-accent-blue"
          >
            View all matches →
          </Link>
        </div>
      ) : null}

      <div className="mt-8 grid grid-cols-2 gap-3">
        <div className="rounded-[14px] border border-border-card bg-bg-deep p-3">
          <div className="text-[11px] text-text-dim">Pipeline value</div>
          <div className="mt-1 text-[18px] font-medium text-accent-blue">
            {fmtMoney(stats.pipeline)}
          </div>
        </div>
        <div className="rounded-[14px] border border-border-card bg-bg-deep p-3">
          <div className="text-[11px] text-text-dim">Hot leads</div>
          <div className="mt-1 text-[18px] font-medium text-accent-amber">
            {stats.hot}
          </div>
        </div>
        <div className="rounded-[14px] border border-border-card bg-bg-deep p-3">
          <div className="text-[11px] text-text-dim">Tasks due today</div>
          <div className="mt-1 text-[18px] font-medium text-text-primary">
            {stats.tasksToday}
          </div>
        </div>
        <div className="rounded-[14px] border border-border-card bg-bg-deep p-3">
          <div className="text-[11px] text-text-dim">Closings this month</div>
          <div className="mt-1 text-[18px] font-medium text-accent-green">
            {stats.closings}
          </div>
        </div>
      </div>

      <div className="mt-8">
        <div className="text-[10px] font-medium uppercase tracking-[0.07em] text-text-dim">
          Ask Aria
        </div>
        <div className="mt-2">
          <AIBar context={context} />
        </div>
      </div>

      <div className="mt-6">
        <div className="text-[10px] font-medium uppercase tracking-[0.07em] text-text-dim">
          Quick actions
        </div>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {[
            ["+ New Client", "/clients"],
            ["Log Showing", "/showings"],
            ["New Listing", "/listings/new"],
            ["Properties", "/properties"],
            ["MLS Search", "/mls"],
            ["Market Pulse", "/market-pulse"],
            ["New Referral", "/referrals"],
          ].map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="shrink-0 rounded-full border border-border-card bg-bg-deep px-3 py-2 text-[12px] text-text-secondary"
            >
              {label}
            </Link>
          ))}
        </div>
        <MarketsComingSoonNote className="mt-2 px-0.5" />
      </div>
    </div>
  );
}

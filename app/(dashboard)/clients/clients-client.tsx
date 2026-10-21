"use client";

import { fmtMoney, humanizeSource, relTime } from "@/lib/utils";
import { heatFromScore } from "@/lib/today-items";
import { statusShortLabel } from "@/lib/client-brief";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, Sparkles, Upload, Users, X } from "lucide-react";
import { Avatar, Pill } from "@/components/Section";
import Link from "next/link";
import { useMemo, useState } from "react";
import { openQuickAdd } from "@/components/QuickAddClient";

const FILTERS = ["All", "New", "Aria texting", "Hot", "Showing", "Under contract", "Closed"] as const;

type Row = {
  id: string;
  name: string;
  town: string | null;
  preferred_towns?: string[] | null;
  status: string | null;
  lead_score: number | null;
  budget_min: number | null;
  budget_max: number | null;
  phone?: string | null;
  email?: string | null;
  client_role?: string | null;
  source?: string | null;
  lead_source?: string | null;
  aria_paused?: boolean | null;
  sms_opted_out?: boolean | null;
  created_at?: string | null;
  dealValue: number | null;
  dealValueIsReal: boolean;
  commissionEst: number | null;
  lastText: { body: string | null; inbound: boolean } | null;
  lastContactAt: string | null;
  ariaThread: boolean;
};

function budgetLabel(min: number | null, max: number | null): string | null {
  if (min && max) return `${fmtMoney(min)}–${fmtMoney(max)}`;
  if (max) return `≤ ${fmtMoney(max)}`;
  if (min) return `${fmtMoney(min)}+`;
  return null;
}

function ariaState(c: Row): "texting" | "paused" | "opted_out" | null {
  if (c.sms_opted_out) return "opted_out";
  if (!c.ariaThread) return null;
  return c.aria_paused ? "paused" : "texting";
}

function ClientRow({ client }: { client: Row }) {
  const heat = heatFromScore(client.lead_score);
  const aria = ariaState(client);
  const towns = client.preferred_towns?.length ? client.preferred_towns.join(", ") : client.town;
  const meta = [
    humanizeSource(client.lead_source ?? client.source ?? null),
    towns,
    budgetLabel(client.budget_min, client.budget_max),
  ].filter(Boolean);

  return (
    <Link href={`/clients/${client.id}`} className="flex items-start gap-3.5 px-5 py-4 hover:bg-secondary/50">
      <Avatar name={client.name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="flex min-w-0 items-center gap-2">
            <span className="truncate font-display text-body-lg font-semibold text-foreground">{client.name}</span>
            {heat !== "cold" ? (
              <span className={`size-2 shrink-0 rounded-full ${heat === "hot" ? "bg-hot" : "bg-warm"}`} aria-label={`${heat} lead`} />
            ) : null}
          </p>
          <span className="shrink-0 font-display text-caption text-muted-foreground">
            {client.lastContactAt ? relTime(client.lastContactAt) : "No contact"}
          </span>
        </div>
        {meta.length ? (
          <p className="mt-0.5 truncate font-display text-caption text-muted-foreground">{meta.join(" · ")}</p>
        ) : null}
        {client.lastText?.body ? (
          <p className={`mt-1 line-clamp-1 font-display text-body ${client.lastText.inbound ? "text-foreground" : "text-muted-foreground"}`}>
            {client.lastText.inbound ? "" : "↳ "}
            {client.lastText.body}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Pill>{statusShortLabel(client.status)}</Pill>
          {aria === "texting" ? (
            <Pill tone="primary">
              <Sparkles className="size-3" /> Aria active
            </Pill>
          ) : aria === "paused" ? (
            <Pill>Aria paused</Pill>
          ) : aria === "opted_out" ? (
            <Pill tone="hot">Opted out</Pill>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

export function ClientsPageClient({
  initial,
  smsEnabled,
}: {
  /** lead_score is already the computed score (lib/lead-score.ts), the same
   * one Ask Aria and voice use — not the clients.lead_score column. */
  initial: Row[];
  smsEnabled: boolean;
}) {
  const rows = initial;

  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const s = search.trim().toLowerCase();
    return rows
      .filter((c) => {
        if (filter === "New" && !((c.created_at ?? "") >= weekAgo || c.status === "new")) return false;
        if (filter === "Aria texting" && ariaState(c) !== "texting") return false;
        if (filter === "Hot" && (c.lead_score ?? 0) < 7) return false;
        if (filter === "Showing" && c.status !== "showing") return false;
        if (filter === "Under contract" && c.status !== "under_contract") return false;
        if (filter === "Closed" && c.status !== "closed") return false;
        if (s && ![c.name, c.town, c.phone, c.email].some((v) => (v ?? "").toLowerCase().includes(s))) return false;
        return true;
      })
      .sort((a, b) => (b.lastContactAt ?? b.created_at ?? "").localeCompare(a.lastContactAt ?? a.created_at ?? ""));
  }, [rows, filter, search]);

  const hotCount = rows.filter((c) => (c.lead_score ?? 0) >= 7).length;

  return (
    <div className="min-h-[100dvh] bg-background text-foreground pb-[130px]">
      <div className="mx-auto max-w-2xl px-5 pt-10 sm:px-8">
        {/* Header */}
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="font-heading text-[34px] leading-tight text-foreground">Clients</h1>
            <p className="font-display text-caption text-muted-foreground mt-1">
              {rows.length} total{hotCount > 0 ? ` · ${hotCount} hot` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" className="rounded-full h-9 px-3.5 text-caption font-semibold">
              <Link href="/clients/import">
                <Upload className="size-3.5" /> Import
              </Link>
            </Button>
            <Button onClick={openQuickAdd} className="rounded-full h-9 px-4 text-caption font-semibold">
              + Add
            </Button>
          </div>
        </div>

        {rows.length > 0 ? (
        <>
        {/* Search */}
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
          <Search className="size-3.5 text-muted-foreground shrink-0" />
          <input aria-label="Search name, town, phone, email"
            type="text"
            placeholder="Search name, town, phone, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-focus-parent
            className="flex-1 bg-transparent outline-none font-display text-body text-foreground placeholder:text-muted-foreground"
          />
          {search && (
            <button type="button" onClick={() => setSearch("")} aria-label="Clear search">
              <X className="size-3.5 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="mb-6 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {FILTERS.filter((f) => smsEnabled || f !== "Aria texting").map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={
                filter === f
                  ? "whitespace-nowrap rounded-full px-3.5 py-2 font-display text-caption font-semibold bg-primary text-primary-foreground transition-colors"
                  : "whitespace-nowrap rounded-full px-3.5 py-2 font-display text-caption font-semibold bg-secondary text-muted-foreground border border-transparent hover:border-input transition-colors"
              }
            >
              {f}
            </button>
          ))}
        </div>
        </>
        ) : null}

        {/* List */}
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center">
            <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full bg-secondary">
              <Users className="size-4 text-muted-foreground" />
            </div>
            <p className="font-display text-body text-muted-foreground">
              {rows.length === 0
                ? "No clients yet. Import your contacts (Google, your phone, a spreadsheet) or add someone by hand."
                : "Try adjusting your search or filters"}
            </p>
            {rows.length === 0 && (
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Button asChild className="rounded-full h-10 px-5 text-body font-semibold">
                  <Link href="/clients/import">Import contacts</Link>
                </Button>
                <Button variant="outline" onClick={openQuickAdd} className="rounded-full h-10 px-5 text-body font-semibold">
                  Add a client
                </Button>
              </div>
            )}
          </div>
        ) : (
          <Card className="divide-y divide-border overflow-hidden">
            {filtered.map((client) => (
              <ClientRow key={client.id} client={client} />
            ))}
          </Card>
        )}
      </div>

    </div>
  );
}

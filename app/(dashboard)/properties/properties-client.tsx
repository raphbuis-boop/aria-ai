"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ExternalLink, Home as HomeIcon, Plus, Search, Sparkles, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/Section";
import { Toaster } from "@/components/ui/sonner";
import { ARIA_RECOMMENDED_REASON, AGENT_SENT_REASON } from "@/lib/sms/recommend-reasons";
import { IdxComplianceNotice } from "@/components/IdxComplianceNotice";
import { AddPropertySheet } from "@/components/AddPropertySheet";
import { fmtMoney } from "@/lib/utils";
import { humanizeMatchReasons } from "@/lib/match-language";
import type { PropertyMatch } from "./page";
import type { ParsedSearchFilters } from "@/app/api/ai/search-parse/route";

const STATUS_FILTERS = ["All", "Available", "Pending", "Sold"] as const;
const PRICE_FILTERS = ["Any price", "Under $750k", "$750k–1M", "$1M+"] as const;

const STATUS_LABEL: Record<string, string> = {
  available: "Available",
  pending: "Pending",
  sold: "Sold",
  off_market: "Off market",
  archived: "Archived",
};

type Property = {
  id: string;
  address: string | null;
  town: string | null;
  price: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  status: string | null;
  property_type: string | null;
  photos: unknown;
  matches: PropertyMatch[];
};

function photoUrlOf(photos: unknown): string | null {
  return Array.isArray(photos) && typeof photos[0] === "string" ? photos[0] : null;
}

function bestMatchOf(matches: PropertyMatch[]): PropertyMatch | null {
  return matches.length > 0 ? matches[0] : null;
}

function MatchCue({ matches, property }: { matches: PropertyMatch[]; property: Property }) {
  const best = bestMatchOf(matches);
  const byAria = matches.filter((m) => m.reasons.includes(ARIA_RECOMMENDED_REASON)).length;
  const byAgent = matches.filter((m) => m.reasons.includes(AGENT_SENT_REASON) && !m.reasons.includes(ARIA_RECOMMENDED_REASON)).length;
  const sentPills =
    byAria || byAgent ? (
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {byAria ? (
          <Pill tone="primary">
            <Sparkles className="size-3" /> Sent by Aria · {byAria}
          </Pill>
        ) : null}
        {byAgent ? <Pill>Sent by you · {byAgent}</Pill> : null}
      </div>
    ) : null;
  if (!best) {
    return (
      <p className="font-display text-caption text-muted-foreground mt-2">No client matches yet</p>
    );
  }
  const reason = humanizeMatchReasons(best.clientName, best.reasons, {
    town: property.town,
    price: property.price,
    beds: property.beds,
    baths: property.baths,
    propertyType: property.property_type,
  });
  return (
    <div className="mt-2">
      <div className="flex items-center gap-1.5">
        <Sparkles className="size-3 text-primary shrink-0" />
        <p className="font-display text-caption text-primary">
          Matches {matches.length} client{matches.length === 1 ? "" : "s"} · best: {best.clientName}{" "}
          {best.score}%
        </p>
      </div>
      <p className="font-display text-caption text-muted-foreground mt-1 line-clamp-1">{reason}</p>
      {sentPills}
    </div>
  );
}

function PropertyRow({ p }: { p: Property }) {
  const photo = photoUrlOf(p.photos);
  const [failed, setFailed] = useState(false);
  return (
    <Link href={`/properties/${p.id}`} className="flex gap-4 px-5 py-4 hover:bg-accent/50 transition-colors">
      <div className="size-16 shrink-0 rounded-xl bg-secondary overflow-hidden flex items-center justify-center">
        {photo && !failed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="size-full object-cover" onError={() => setFailed(true)} />
        ) : (
          <HomeIcon className="size-5 text-muted-foreground" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-body-lg font-semibold text-foreground truncate">
              {p.address ?? "Property"}
            </p>
            <p className="font-display text-caption text-muted-foreground mt-0.5">
              {p.town ?? "—"}
              {p.beds != null || p.baths != null ? ` · ${p.beds ?? "—"} bd · ${p.baths ?? "—"} ba` : ""}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-display text-body font-semibold text-foreground">{fmtMoney(p.price)}</p>
            {p.status && (
              <span className="inline-block mt-1 rounded-full bg-secondary px-2 py-0.5 font-display text-[11px] font-semibold text-muted-foreground">
                {STATUS_LABEL[p.status] ?? p.status}
              </span>
            )}
          </div>
        </div>
        <MatchCue matches={p.matches} property={p} />
      </div>
    </Link>
  );
}

export function PropertiesClient({
  initial,
  mlsSearchHref,
}: {
  initial: Property[];
  /** Set when no MLS feed is connected: "Search NJMLS" opens this site instead of in-app search. */
  mlsSearchHref: string | null;
}) {
  const [adding, setAdding] = useState(false);
  // /properties?add=1 (from "Add a property" on the MLS screen) opens the sheet.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("add") === "1") setAdding(true);
  }, []);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("All");
  const [priceFilter, setPriceFilter] = useState<(typeof PRICE_FILTERS)[number]>("Any price");

  // Natural-language search — parses free text into town/beds/baths/price and
  // applies it alongside the structured filters above (additive, not a
  // replacement). Property type isn't matched here: this table stores it as
  // "single_family"/"condo" etc., not the Title Case the parser returns, so a
  // strict match would silently drop results — safer to skip it than guess.
  const [nlQuery, setNlQuery] = useState("");
  const [nlParsing, setNlParsing] = useState(false);
  const [nlFilters, setNlFilters] = useState<ParsedSearchFilters | null>(null);

  const nlRequest = useRef(0);
  async function runNlSearch(query: string) {
    const q = query.trim();
    const requestId = ++nlRequest.current;
    if (!q || nlParsing) return;
    setNlParsing(true);
    try {
      const res = await fetch("/api/ai/search-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = (await res.json()) as {
        filters?: ParsedSearchFilters;
        keywordFallback?: string;
      };
      // The agent kept typing or searched again — this answer is stale.
      if (requestId !== nlRequest.current) return;
      const f = data.filters;
      const hasStructured =
        f && (f.towns.length > 0 || f.beds != null || f.baths != null || f.minPrice != null || f.maxPrice != null);
      if (hasStructured) {
        setNlFilters(f!);
      } else {
        setNlFilters(null);
        if (data.keywordFallback) setSearch(data.keywordFallback);
      }
    } finally {
      setNlParsing(false);
    }
  }

  const filtered = useMemo(() => {
    return initial.filter((p) => {
      if (statusFilter !== "All" && p.status !== statusFilter.toLowerCase()) return false;
      if (priceFilter === "Under $750k" && !(p.price != null && p.price < 750_000)) return false;
      if (priceFilter === "$750k–1M" && !(p.price != null && p.price >= 750_000 && p.price <= 1_000_000)) return false;
      if (priceFilter === "$1M+" && !(p.price != null && p.price > 1_000_000)) return false;
      if (search && !nlFilters) {
        const s = search.toLowerCase();
        if (!p.address?.toLowerCase().includes(s) && !(p.town ?? "").toLowerCase().includes(s)) return false;
      }
      if (nlFilters) {
        if (
          nlFilters.towns.length > 0 &&
          !nlFilters.towns.some((t) => (p.town ?? "").toLowerCase().includes(t.toLowerCase()))
        )
          return false;
        if (nlFilters.beds != null && (p.beds ?? 0) < nlFilters.beds) return false;
        if (nlFilters.baths != null && (p.baths ?? 0) < nlFilters.baths) return false;
        if (nlFilters.minPrice != null && (p.price ?? -Infinity) < nlFilters.minPrice) return false;
        if (nlFilters.maxPrice != null && (p.price ?? Infinity) > nlFilters.maxPrice) return false;
      }
      return true;
    });
  }, [initial, statusFilter, priceFilter, search, nlFilters]);

  const matchedCount = initial.filter((p) => p.matches.length > 0).length;

  return (
    <div className="min-h-[100dvh] bg-background text-foreground pb-[130px]">
      <div className="mx-auto max-w-2xl px-5 pt-10 sm:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-heading text-[34px] leading-tight text-foreground">Properties</h1>
            <p className="mt-1 font-display text-caption text-muted-foreground">
              {initial.length} home{initial.length === 1 ? "" : "s"}
              {matchedCount > 0 ? ` · ${matchedCount} matched to clients` : ""}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button asChild variant="outline" className="h-9 rounded-full px-4 text-caption font-semibold">
              {mlsSearchHref ? (
                <a href={mlsSearchHref} target="_blank" rel="noopener noreferrer">
                  Search NJMLS <ExternalLink className="size-3.5" />
                </a>
              ) : (
                <Link href="/listings">Search MLS</Link>
              )}
            </Button>
            <Button onClick={() => setAdding(true)} className="h-9 rounded-full px-4 text-caption font-semibold">
              <Plus className="size-3.5" /> Add
            </Button>
          </div>
        </div>

        {initial.length > 0 ? (
        <>
        {/* Search — filters as you type; Enter asks Aria to read it ("3-bed under $900k in Tenafly") */}
        <form
          className="mb-3 flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
          onSubmit={(e) => {
            e.preventDefault();
            setNlQuery(search);
            void runNlSearch(search);
          }}
        >
          <Search className="size-3.5 shrink-0 text-muted-foreground" />
          <input aria-label="Search, or describe it"
            type="text"
            placeholder="Search, or describe it — “3-bed under $900k in Tenafly”"
            value={search}
            onChange={(e) => {
              nlRequest.current++;
              setSearch(e.target.value);
              if (nlFilters) setNlFilters(null);
            }}
            disabled={nlParsing}
            data-focus-parent
            className="min-w-0 flex-1 bg-transparent font-display text-body text-foreground outline-none placeholder:text-muted-foreground"
          />
          {search || nlFilters ? (
            <button
              type="button"
              onClick={() => {
                nlRequest.current++;
                setSearch("");
                setNlQuery("");
                setNlFilters(null);
              }}
              aria-label="Clear search"
            >
              <X className="size-3.5 text-muted-foreground" />
            </button>
          ) : null}
        </form>
        {nlFilters ? (
          <p className="-mt-1 mb-3 flex items-center gap-1.5 font-display text-caption text-primary">
            <Sparkles className="size-3" /> Showing homes that fit “{nlQuery}”
          </p>
        ) : null}

        {/* Filters: status chips + price */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {STATUS_FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={statusFilter === f}
                onClick={() => setStatusFilter(f)}
                className={
                  statusFilter === f
                    ? "whitespace-nowrap rounded-full px-3.5 py-2 font-display text-caption font-semibold bg-primary text-primary-foreground transition-colors"
                    : "whitespace-nowrap rounded-full px-3.5 py-2 font-display text-caption font-semibold bg-secondary text-muted-foreground border border-transparent hover:border-input transition-colors"
                }
              >
                {f}
              </button>
            ))}
          </div>
          <select
            aria-label="Price range"
            value={priceFilter}
            onChange={(e) => setPriceFilter(e.target.value as typeof priceFilter)}
            className="mb-1 shrink-0 rounded-full border border-input bg-card py-1.5 pl-3.5 pr-2 font-display font-semibold text-foreground"
          >
            {PRICE_FILTERS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        </>
        ) : null}

        {/* List */}
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center">
            <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full bg-secondary">
              <HomeIcon className="size-4 text-muted-foreground" />
            </div>
            <p className="font-display text-body text-muted-foreground">
              {initial.length === 0
                ? "No homes yet. Add one — paste a Zillow, Realtor.com or NJMLS link, or an MLS # — and Aria matches it to your clients."
                : "Try adjusting your search or filters."}
            </p>
          </div>
        ) : (
          <Card className="divide-y divide-border overflow-hidden">
            {filtered.map((p) => (
              <PropertyRow key={p.id} p={p} />
            ))}
          </Card>
        )}

        <div className="mt-8">
          <IdxComplianceNotice compact />
        </div>
      </div>
      {adding ? <AddPropertySheet onClose={() => setAdding(false)} /> : null}
      <Toaster />
    </div>
  );
}

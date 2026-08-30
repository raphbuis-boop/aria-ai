"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Home as HomeIcon, Search, Sparkles, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { IdxComplianceNotice } from "@/components/IdxComplianceNotice";
import { fmtMoney } from "@/lib/utils";
import { humanizeMatchReasons } from "@/lib/match-language";
import type { PropertyMatch } from "./page";

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
  if (!best) {
    return (
      <p className="font-display text-caption text-muted-foreground/50 mt-2">No client matches yet</p>
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
    </div>
  );
}

function PropertyRow({ p }: { p: Property }) {
  const photo = photoUrlOf(p.photos);
  return (
    <Link href={`/properties/${p.id}`} className="flex gap-4 px-5 py-4 hover:bg-accent/50 transition-colors">
      <div className="size-16 shrink-0 rounded-xl bg-secondary overflow-hidden flex items-center justify-center">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="size-full object-cover" />
        ) : (
          <HomeIcon className="size-5 text-muted-foreground/50" />
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

export function PropertiesClient({ initial }: { initial: Property[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("All");
  const [priceFilter, setPriceFilter] = useState<(typeof PRICE_FILTERS)[number]>("Any price");

  const filtered = useMemo(() => {
    return initial.filter((p) => {
      if (statusFilter !== "All" && p.status !== statusFilter.toLowerCase()) return false;
      if (priceFilter === "Under $750k" && !(p.price != null && p.price < 750_000)) return false;
      if (priceFilter === "$750k–1M" && !(p.price != null && p.price >= 750_000 && p.price <= 1_000_000)) return false;
      if (priceFilter === "$1M+" && !(p.price != null && p.price > 1_000_000)) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!p.address?.toLowerCase().includes(s) && !(p.town ?? "").toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [initial, statusFilter, priceFilter, search]);

  const matchedCount = initial.filter((p) => p.matches.length > 0).length;

  return (
    <div className="min-h-[100dvh] bg-background text-foreground pb-[130px]">
      <div className="mx-auto max-w-2xl px-5 pt-10 sm:px-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="font-heading text-[34px] leading-tight text-foreground">Properties</h1>
          <p className="font-display text-caption text-muted-foreground mt-1">
            {initial.length} listing{initial.length === 1 ? "" : "s"}
            {matchedCount > 0 ? ` · ${matchedCount} matched to clients` : ""}
          </p>
        </div>

        {/* Search */}
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
          <Search className="size-3.5 text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="Search by address or town…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent outline-none font-display text-body text-foreground placeholder:text-muted-foreground/60"
          />
          {search && (
            <button type="button" onClick={() => setSearch("")} aria-label="Clear search">
              <X className="size-3.5 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Status filters */}
        <div className="mb-2 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {STATUS_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
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

        {/* Price filters */}
        <div className="mb-6 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {PRICE_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setPriceFilter(f)}
              className={
                priceFilter === f
                  ? "whitespace-nowrap rounded-full px-3.5 py-2 font-display text-caption font-semibold bg-primary text-primary-foreground transition-colors"
                  : "whitespace-nowrap rounded-full px-3.5 py-2 font-display text-caption font-semibold bg-secondary text-muted-foreground border border-transparent hover:border-input transition-colors"
              }
            >
              {f}
            </button>
          ))}
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center">
            <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full bg-secondary">
              <HomeIcon className="size-4 text-muted-foreground" />
            </div>
            <p className="font-display text-body text-muted-foreground/70">
              {initial.length === 0 ? "No properties yet." : "Try adjusting your search or filters."}
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
    </div>
  );
}

"use client";

import { MatchScoreBadge, type MatchSummary } from "@/components/MatchScoreBadge";
import { fmtMoney } from "@/lib/utils";

export function PropertyCard({
  address,
  town,
  mls_number,
  price,
  beds,
  baths,
  sqft,
  status,
  matchCount,
  topMatches,
  photoUrl,
  listingOfficeName,
  listDate,
  onFindMatches,
  onNotifyAll,
}: {
  address: string | null;
  town: string | null;
  mls_number: string | null;
  price: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  status: string | null;
  matchCount: number;
  topMatches?: MatchSummary[];
  photoUrl?: string | null;
  listingOfficeName?: string | null;
  listDate?: string | null;
  onFindMatches: () => void;
  onNotifyAll: () => void;
}) {
  return (
    <div className="rounded-[14px] border border-border-card bg-bg-card p-4">
      {photoUrl ? (
        <div className="mb-3 h-36 w-full overflow-hidden rounded-[10px] bg-bg-deep">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      ) : null}
      <div className="flex items-start justify-between gap-2">
        <div className="text-[14px] font-medium text-text-primary">{address}</div>
        <span className="rounded-[8px] bg-[rgba(59,130,246,0.15)] px-2 py-0.5 text-[10px] font-medium capitalize text-accent-blue">
          {(status ?? "available").replace("_", " ")}
        </span>
      </div>
      <div className="mt-1 text-[12px] text-text-dim">
        {town} · MLS {mls_number ?? "—"}
      </div>
      <div className="mt-2 text-[13px] text-accent-blue">
        {beds ?? "—"} bd · {baths ?? "—"} ba · {sqft != null ? `${sqft.toLocaleString()} sqft` : "—"}{" "}
        · {fmtMoney(price)}
      </div>
      <div className="mt-1 text-[11px] text-text-dim">
        Listing brokerage: {listingOfficeName ?? "N/A"}
      </div>
      <div className="mt-1 text-[11px] text-text-dim">
        Last updated: {listDate ? new Date(listDate).toLocaleString() : "N/A"}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {topMatches && topMatches.length ? (
          <MatchScoreBadge matches={topMatches} />
        ) : (
          <div className="inline-flex rounded-full bg-[rgba(59,130,246,0.15)] px-2 py-1 text-[11px] font-medium text-accent-blue">
            {matchCount} buyers match
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onFindMatches}
          className="rounded-[8px] border border-border-card bg-bg-card px-3 py-2 text-[13px] font-medium text-accent-blue"
        >
          Find Matches
        </button>
        <button
          type="button"
          onClick={onNotifyAll}
          className="rounded-[8px] bg-accent-blue px-3 py-2 text-[13px] font-medium text-white"
        >
          Notify All Matches
        </button>
      </div>
    </div>
  );
}

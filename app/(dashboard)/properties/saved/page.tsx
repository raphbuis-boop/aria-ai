"use client";

import { BackButton } from "@/components/BackButton";
import { IdxComplianceNotice } from "@/components/IdxComplianceNotice";
import { fmtMoney } from "@/lib/utils";
import { Bookmark } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type SavedRow = {
  mls_number: string;
  address: string | null;
  town: string | null;
  price: number | null;
  photo_url: string | null;
  saved_at: string;
  updated_at?: string | null;
  snapshot?: {
    listDate?: string | null;
    listingOffice?: { name?: string | null } | null;
  } | null;
};

export default function SavedPropertiesPage() {
  const [rows, setRows] = useState<SavedRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/saved-properties");
        const data = (await res.json()) as { saved?: SavedRow[] };
        setRows((data.saved ?? []) as SavedRow[]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="mx-auto max-w-lg px-4 pb-28 pt-6">
      <BackButton href="/listings" label="Property Search" className="mb-4" />
      <div className="flex items-center gap-2">
        <Bookmark className="text-accent-blue" size={22} />
        <h1 className="text-[20px] font-semibold text-text-primary">
          Watchlist
        </h1>
      </div>
      <p className="mt-1 text-[13px] text-text-dim">
        Saved listings — tap to open full detail.
      </p>
      <div className="mt-3">
        <IdxComplianceNotice compact />
      </div>

      {loading ? (
        <p className="mt-8 text-center text-[13px] text-text-dim">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="mt-8 rounded-[14px] border border-border-card bg-bg-card px-4 py-8 text-center text-[13px] text-text-dim">
          No saved listings yet.{" "}
          <Link href="/listings" className="font-medium text-accent-blue">
            Browse listings →
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((r) => (
            <li key={r.mls_number}>
              <Link
                href={`/properties/${encodeURIComponent(r.mls_number)}`}
                className="flex gap-3 rounded-[14px] border border-border-card bg-bg-card p-3 transition hover:border-accent-blue/30"
              >
                <div className="h-20 w-24 flex-shrink-0 overflow-hidden rounded-[10px] bg-bg-deep">
                  {r.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.photo_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[10px] text-text-dim">
                      No photo
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-text-primary">
                    {r.address ?? "Listing"}
                  </p>
                  <p className="text-[11px] text-text-dim">
                    {r.town ?? ""} · Listing #{r.mls_number}
                  </p>
                  {r.price != null ? (
                    <p className="mt-1 text-[13px] font-medium text-accent-blue">
                      {fmtMoney(r.price)}
                    </p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-text-dim">
                    Listing brokerage:{" "}
                    {r.snapshot?.listingOffice?.name ?? "N/A"}
                  </p>
                  <p className="mt-1 text-[11px] text-text-dim">
                    Last updated:{" "}
                    {r.snapshot?.listDate
                      ? new Date(r.snapshot.listDate).toLocaleString()
                      : r.updated_at
                        ? new Date(r.updated_at).toLocaleString()
                        : "N/A"}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useToast } from "@/components/ToastProvider";
import type { MlsListingPayload } from "@/app/api/mls/listings/route";
import { fmtMoney } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

type MatchHit = {
  clientId: string;
  name: string | null;
  phone: string | null;
  score: number;
  reasons: string[];
};

export default function MlsSearchPage() {
  const toast = useToast();
  const router = useRouter();
  const [city, setCity] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minBeds, setMinBeds] = useState("");
  const [listings, setListings] = useState<MlsListingPayload[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [matchMap, setMatchMap] = useState<Record<string, MatchHit[]>>({});
  const [matchLoading, setMatchLoading] = useState<string | null>(null);

  const search = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (city.trim()) params.set("city", city.trim());
    if (minPrice) params.set("minPrice", minPrice);
    if (maxPrice) params.set("maxPrice", maxPrice);
    if (minBeds) params.set("minBeds", minBeds);
    params.set("limit", "20");
    const res = await fetch(`/api/mls/listings?${params}`);
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      toast.toast(data.error ?? "Search failed", "warn");
      setListings([]);
      return;
    }
    setListings(data.listings ?? []);
  }, [city, minPrice, maxPrice, minBeds, toast]);

  async function matchToClients(listing: MlsListingPayload) {
    const key = listing.id;
    setMatchLoading(key);
    const res = await fetch("/api/mls/match-clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listing }),
    });
    const data = await res.json();
    setMatchLoading(null);
    setMatchMap((m) => ({ ...m, [key]: data.matches ?? [] }));
    setExpanded(key);
  }

  async function addToProperties(listing: MlsListingPayload) {
    const res = await fetch("/api/mls/add-property", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listing }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.toast(data.error ?? "Could not save", "warn");
      return;
    }
    toast.toast(
      `Added to your properties. ${data.matched ?? 0} clients matched!`,
      "success",
    );
    router.push("/properties");
  }

  async function aiText(
    listing: MlsListingPayload,
    clientId: string,
    clientName: string | null,
  ) {
    await fetch("/api/ai/draft-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        clientName: clientName ?? "there",
        propertyContext: `${listing.address} in ${listing.city} at ${fmtMoney(listing.price)}`,
        scenario: "MLS listing match",
        skipInsert: false,
      }),
    });
    toast.toast("Draft created — check Inbox", "success");
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-28 pt-6">
      <header>
        <div className="text-[20px] font-medium text-text-primary">
          MLS Search
        </div>
        <div className="text-[13px] text-text-dim">Live NJ Listings</div>
      </header>

      <div className="mt-5 flex flex-wrap gap-2">
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Town..."
          className="min-w-[140px] flex-1 rounded-[8px] border border-border-card bg-bg-card px-3 py-2 text-[13px] text-text-primary placeholder:text-text-dim"
        />
        <input
          type="number"
          value={minPrice}
          onChange={(e) => setMinPrice(e.target.value)}
          placeholder="Min $"
          className="w-[100px] rounded-[8px] border border-border-card bg-bg-card px-3 py-2 text-[13px] text-text-primary placeholder:text-text-dim"
        />
        <input
          type="number"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
          placeholder="Max $"
          className="w-[100px] rounded-[8px] border border-border-card bg-bg-card px-3 py-2 text-[13px] text-text-primary placeholder:text-text-dim"
        />
        <input
          type="number"
          value={minBeds}
          onChange={(e) => setMinBeds(e.target.value)}
          placeholder="Beds"
          className="w-[72px] rounded-[8px] border border-border-card bg-bg-card px-3 py-2 text-[13px] text-text-primary placeholder:text-text-dim"
        />
        <button
          type="button"
          onClick={search}
          disabled={loading}
          className="rounded-[8px] bg-accent-blue px-4 py-2 text-[13px] font-medium text-white"
        >
          {loading ? "…" : "Search"}
        </button>
      </div>

      <div className="mt-6 grid gap-3">
        {listings.map((l) => {
          const photo = l.photos?.[0];
          const open = expanded === l.id;
          return (
            <div
              key={l.id}
              className="rounded-[14px] border border-border-card bg-bg-card p-[14px]"
            >
              <div className="h-36 w-full overflow-hidden rounded-[10px] bg-bg-deep">
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-[11px] text-text-dim">
                    No photo
                  </div>
                )}
              </div>
              <div className="mt-3 text-[13px] font-medium text-text-primary">
                {l.address}
              </div>
              <div className="text-[11px] text-text-dim">
                {l.city} · MLS {l.mlsNumber}
              </div>
              <div className="mt-1 text-[14px] font-medium text-accent-blue">
                {fmtMoney(l.price)}
              </div>
              <div className="mt-3 text-[12px] text-text-muted">
                {l.beds} bd · {l.baths} ba · {l.sqft.toLocaleString()} sqft
              </div>
              {l.daysOnMarket != null ? (
                <div className="mt-2 inline-block rounded-[8px] bg-bg-deep px-2 py-1 text-[11px] text-text-dim">
                  {l.daysOnMarket} days on market
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => matchToClients(l)}
                  disabled={matchLoading === l.id}
                  className="rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[12px] font-medium text-accent-blue"
                >
                  Match to Clients
                </button>
                <button
                  type="button"
                  onClick={() => addToProperties(l)}
                  className="rounded-[8px] bg-accent-blue px-3 py-2 text-[12px] font-medium text-white"
                >
                  Add to Properties
                </button>
              </div>
              {open && matchLoading !== l.id ? (
                <div className="mt-3 space-y-2 border-t border-border-card pt-3">
                  {(matchMap[l.id] ?? []).length === 0 ? (
                    <p className="text-[12px] text-text-dim">
                      No clients matched this listing (score ≥ 40).
                    </p>
                  ) : (
                    (matchMap[l.id] ?? []).map((m) => (
                      <div
                        key={m.clientId}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] bg-bg-deep px-2 py-2 text-[12px]"
                      >
                        <div>
                          <div className="font-medium text-text-primary">
                            {m.name}
                          </div>
                          <div className="text-[11px] text-text-dim">
                            {m.reasons.join(" · ")}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => aiText(l, m.clientId, m.name)}
                          className="rounded-[8px] bg-accent-blue px-2 py-1 text-[11px] text-white"
                        >
                          AI Text
                        </button>
                      </div>
                    ))
                  )}
                </div>
              ) : null}
              {matchLoading === l.id ? (
                <div className="mt-2 text-[12px] text-text-dim">Matching…</div>
              ) : null}
            </div>
          );
        })}
      </div>

      <Link
        href="/properties"
        className="mt-6 inline-block text-[12px] font-medium text-accent-blue"
      >
        View all properties →
      </Link>
    </div>
  );
}

"use client";

import { MatchClientsModal } from "@/components/MatchClientsModal";
import { IdxComplianceNotice } from "@/components/IdxComplianceNotice";
import { NJMLS_IDX_LOGO_PATH } from "@/lib/compliance";
import { useToast } from "@/components/ToastProvider";
import {
  summarizeListingCoverage,
  type MlsListingPayload,
} from "@/lib/simplyrets";
import { fmtMoney } from "@/lib/utils";
import { Bookmark, Loader2, Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const PAGE_SIZE = 20;

const PROPERTY_TYPES: { value: string; label: string }[] = [
  { value: "", label: "Any type" },
  { value: "Residential", label: "Single Family" },
  { value: "Condo", label: "Condo" },
  { value: "Multi-Family", label: "Multi-Family" },
  { value: "Townhouse", label: "Townhouse" },
  { value: "Land", label: "Land" },
];

const STATUS_OPTS: { value: string; label: string }[] = [
  { value: "Active", label: "Active" },
  { value: "Pending", label: "Pending" },
  { value: "Sold", label: "Sold" },
];

const SORT_OPTS: { value: string; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price ↑" },
  { value: "price_desc", label: "Price ↓" },
  { value: "beds_desc", label: "Most bedrooms" },
];

function buildListingsQuery(sp: URLSearchParams): string {
  const q = new URLSearchParams();
  q.set("limit", String(PAGE_SIZE));
  const state = sp.get("state")?.trim();
  if (state) q.set("state", state);
  const city = sp.get("city")?.trim();
  if (city) q.set("city", city);
  const minPrice = sp.get("minPrice")?.trim();
  if (minPrice) q.set("minPrice", minPrice);
  const maxPrice = sp.get("maxPrice")?.trim();
  if (maxPrice) q.set("maxPrice", maxPrice);
  const minBeds = sp.get("minBeds")?.trim();
  if (minBeds) q.set("minBeds", minBeds);
  const minBaths = sp.get("minBaths")?.trim();
  if (minBaths) q.set("minBaths", minBaths);
  const minSqft = sp.get("minSqft")?.trim();
  if (minSqft) q.set("minSqft", minSqft);
  const propertyType = sp.get("propertyType")?.trim();
  if (propertyType) q.set("propertyType", propertyType);
  const status = sp.get("status")?.trim();
  if (status) q.set("status", status);
  const sortKey = sp.get("sort")?.trim();
  if (sortKey) q.set("sortKey", sortKey);
  return q.toString();
}

export function MlsSearchClient({
  variant = "member",
}: {
  /** Public IDX: no CRM actions; listing detail under /property-search/[id]. */
  variant?: "member" | "public";
}) {
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sentinelRef = useRef<HTMLDivElement>(null);

  const [listings, setListings] = useState<MlsListingPayload[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedMls, setSavedMls] = useState<Set<string>>(new Set());
  const [matchListing, setMatchListing] = useState<MlsListingPayload | null>(
    null,
  );

  const [city, setCity] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minBeds, setMinBeds] = useState("");
  const [minBaths, setMinBaths] = useState("");
  const [minSqft, setMinSqft] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [status, setStatus] = useState("Active");
  const [sortKey, setSortKey] = useState("newest");
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    setCity(searchParams.get("city") ?? "");
    setMinPrice(searchParams.get("minPrice") ?? "");
    setMaxPrice(searchParams.get("maxPrice") ?? "");
    setMinBeds(searchParams.get("minBeds") ?? "");
    setMinBaths(searchParams.get("minBaths") ?? "");
    setMinSqft(searchParams.get("minSqft") ?? "");
    setPropertyType(searchParams.get("propertyType") ?? "");
    setStatus(searchParams.get("status") ?? "Active");
    setSortKey(searchParams.get("sort") ?? "newest");
  }, [searchParams]);

  const pushUrlFromForm = useCallback(() => {
    const q = new URLSearchParams();
    if (city.trim()) q.set("city", city.trim());
    if (minPrice.trim()) q.set("minPrice", minPrice.trim());
    if (maxPrice.trim()) q.set("maxPrice", maxPrice.trim());
    if (minBeds.trim()) q.set("minBeds", minBeds.trim());
    if (minBaths.trim()) q.set("minBaths", minBaths.trim());
    if (minSqft.trim()) q.set("minSqft", minSqft.trim());
    if (propertyType.trim()) q.set("propertyType", propertyType.trim());
    if (status.trim()) q.set("status", status.trim());
    if (sortKey.trim()) q.set("sort", sortKey.trim());
    const basePath = variant === "public" ? "/property-search" : "/listings";
    router.replace(`${basePath}?${q.toString()}`, { scroll: false });
  }, [
    city,
    minPrice,
    maxPrice,
    minBeds,
    minBaths,
    minSqft,
    propertyType,
    status,
    sortKey,
    router,
    variant,
  ]);

  const fetchPage = useCallback(
    async (nextOffset: number, append: boolean) => {
      const base = buildListingsQuery(searchParams);
      const url = `/api/mls/listings?${base}&offset=${nextOffset}`;
      const res = await fetch(url);
      const data = (await res.json()) as {
        error?: string;
        listings?: MlsListingPayload[];
        total?: number | null;
        hasMore?: boolean;
        offset?: number;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Search failed");
      }
      const batch = data.listings ?? [];
      setTotal(
        typeof data.total === "number" && Number.isFinite(data.total)
          ? data.total
          : null,
      );
      setHasMore(Boolean(data.hasMore));
      setOffset(nextOffset + batch.length);
      if (append) {
        setListings((prev) => {
          const seen = new Set(prev.map((l) => l.id));
          const merged = [...prev];
          for (const l of batch) {
            if (!seen.has(l.id)) {
              seen.add(l.id);
              merged.push(l);
            }
          }
          return merged;
        });
      } else {
        setListings(batch);
      }
    },
    [searchParams],
  );

  useEffect(() => {
    void (async () => {
      setErrorMessage(null);
      setLoading(true);
      setOffset(0);
      setHasMore(true);
      try {
        await fetchPage(0, false);
      } catch (e) {
        setErrorMessage(e instanceof Error ? e.message : "Could not load.");
        setListings([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [searchParams, fetchPage]);

  useEffect(() => {
    if (variant === "public") return;
    void (async () => {
      try {
        const res = await fetch("/api/saved-properties?idsOnly=1");
        if (!res.ok) return;
        const data = (await res.json()) as { mlsNumbers?: string[] };
        setSavedMls(new Set(data.mlsNumbers ?? []));
      } catch {
        /* ignore */
      }
    })();
  }, [variant]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore || listings.length === 0) return;
    setLoadingMore(true);
    try {
      await fetchPage(offset, true);
    } catch {
      toast.toast("Could not load more", "warn");
    } finally {
      setLoadingMore(false);
    }
  }, [
    loading,
    loadingMore,
    hasMore,
    offset,
    listings.length,
    fetchPage,
    toast,
  ]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "120px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  async function toggleWatchlist(listing: MlsListingPayload) {
    const key = listing.mlsNumber || listing.id;
    if (savedMls.has(key)) {
      const res = await fetch(
        `/api/saved-properties/${encodeURIComponent(key)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        toast.toast("Could not remove", "warn");
        return;
      }
      setSavedMls((s) => {
        const n = new Set(s);
        n.delete(key);
        return n;
      });
      toast.toast("Removed from watchlist", "default");
    } else {
      const res = await fetch("/api/saved-properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing }),
      });
      if (!res.ok) {
        toast.toast("Could not save", "warn");
        return;
      }
      setSavedMls((s) => new Set(s).add(key));
      toast.toast("Saved to watchlist", "success");
    }
  }

  function applySearch() {
    pushUrlFromForm();
  }

  const showingLine = useMemo(() => {
    if (loading && listings.length === 0) return null;
    const n = listings.length;
    if (total != null && Number.isFinite(total)) {
      return `Showing ${n} of ${total} properties`;
    }
    return `Showing ${n} properties`;
  }, [loading, listings.length, total]);

  const coverageLine = useMemo(
    () => summarizeListingCoverage(listings),
    [listings],
  );

  const returnToParam = useMemo(() => {
    const q = searchParams.toString();
    const base = variant === "public" ? "/property-search" : "/listings";
    return encodeURIComponent(q ? `${base}?${q}` : base);
  }, [searchParams, variant]);

  const listingDetailBase =
    variant === "public" ? "/property-search" : "/properties";

  return (
    <div
      className={`mx-auto max-w-lg px-4 pt-6 ${
        variant === "public" ? "pb-16" : "pb-28"
      }`}
    >
      {variant === "member" ? (
        <div className="mb-4 flex items-center justify-between gap-2">
          <Link
            href="/more"
            className="text-[12px] font-medium text-accent-blue"
          >
            ← More
          </Link>
          <Link
            href="/properties/saved"
            className="flex items-center gap-1 text-[12px] font-medium text-text-dim"
          >
            <Bookmark size={14} /> Watchlist
          </Link>
        </div>
      ) : null}
      <header>
        <div className="text-[20px] font-medium text-text-primary">
          Property Search
        </div>
        <div className="text-[13px] text-text-dim">
          Live property listings
        </div>
        {showingLine ? (
          <p className="mt-2 text-[12px] text-text-muted">{showingLine}</p>
        ) : null}
      </header>

      <div className="mt-3">
        <IdxComplianceNotice />
      </div>

      {listings.length > 0 ? (
        <div className="mt-3 rounded-[10px] border border-border-card bg-bg-card px-3 py-2.5 text-[11px] leading-relaxed text-text-muted">
          {coverageLine ||
            "Areas in this result set — add town or filters to narrow."}
        </div>
      ) : null}

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
          placeholder="Min beds"
          className="w-[88px] rounded-[8px] border border-border-card bg-bg-card px-3 py-2 text-[13px] text-text-primary placeholder:text-text-dim"
        />
        <button
          type="button"
          onClick={() => void applySearch()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-[8px] bg-accent-blue px-4 py-2 text-[13px] font-medium text-white disabled:opacity-60"
        >
          <Search size={14} />
          Search
        </button>
      </div>

      <button
        type="button"
        onClick={() => setFiltersOpen((o) => !o)}
        className="mt-2 text-[12px] font-medium text-accent-blue"
      >
        {filtersOpen ? "Hide filters" : "More filters & sort"}
      </button>

      {filtersOpen ? (
        <div className="mt-3 space-y-2 rounded-[12px] border border-border-card bg-bg-card p-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide text-text-dim">
                Min baths
              </label>
              <input
                type="number"
                value={minBaths}
                onChange={(e) => setMinBaths(e.target.value)}
                className="mt-1 w-full rounded-[8px] border border-border-card bg-bg-deep px-2 py-1.5 text-[13px] text-text-primary"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide text-text-dim">
                Min sqft
              </label>
              <input
                type="number"
                value={minSqft}
                onChange={(e) => setMinSqft(e.target.value)}
                className="mt-1 w-full rounded-[8px] border border-border-card bg-bg-deep px-2 py-1.5 text-[13px] text-text-primary"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide text-text-dim">
              Property type
            </label>
            <select
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value)}
              className="mt-1 w-full rounded-[8px] border border-border-card bg-bg-deep px-2 py-2 text-[13px] text-text-primary"
            >
              {PROPERTY_TYPES.map((o) => (
                <option key={o.label} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide text-text-dim">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 w-full rounded-[8px] border border-border-card bg-bg-deep px-2 py-2 text-[13px] text-text-primary"
            >
              {STATUS_OPTS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide text-text-dim">
              Sort by
            </label>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value)}
              className="mt-1 w-full rounded-[8px] border border-border-card bg-bg-deep px-2 py-2 text-[13px] text-text-primary"
            >
              {SORT_OPTS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => void applySearch()}
            className="w-full rounded-[8px] bg-accent-blue py-2 text-[13px] font-medium text-white"
          >
            Apply filters
          </button>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mt-4 rounded-[12px] border border-border-card bg-bg-card px-3 py-3 text-[13px] text-accent-amber">
          {errorMessage}
        </div>
      ) : null}

      {loading && listings.length === 0 ? (
        <div className="mt-8 flex justify-center text-text-dim">
          <Loader2 className="animate-spin" size={22} />
        </div>
      ) : null}

      {!loading &&
      listings.length === 0 &&
      !errorMessage ? (
        <div className="mt-8 rounded-[14px] border border-border-card bg-bg-card px-4 py-8 text-center text-[13px] text-text-dim">
          No listings match your filters.
        </div>
      ) : null}

      {variant === "public" && listings.length > 0 ? (
        <div
          aria-hidden={false}
          className="mt-5 flex items-center gap-3 rounded-[10px] border border-border-card bg-bg-card px-3 py-2"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={NJMLS_IDX_LOGO_PATH}
            alt=""
            className="h-10 w-auto shrink-0"
          />
          <p className="text-[10px] leading-snug text-text-muted">
            NJMLS Internet Data Exchange listings below. Legal disclaimer and fair
            housing notice appear above and in the site footer.
          </p>
        </div>
      ) : null}

      <div className="mt-6 grid gap-3">
        {listings.map((l) => {
          const photo = l.photos?.[0];
          const mlsKey = l.mlsNumber || l.id;
          const saved = savedMls.has(mlsKey);
          return (
            <div
              key={l.id}
              role="button"
              tabIndex={0}
              onClick={() =>
                router.push(
                  `${listingDetailBase}/${encodeURIComponent(l.id)}?return=${returnToParam}`,
                )
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(
                    `${listingDetailBase}/${encodeURIComponent(l.id)}?return=${returnToParam}`,
                  );
                }
              }}
              className="cursor-pointer rounded-[14px] border border-border-card bg-bg-card p-[14px] text-left outline-none ring-accent-blue/40 transition hover:border-accent-blue/30 focus-visible:ring-2"
            >
              <div className="relative h-36 w-full overflow-hidden rounded-[10px] bg-bg-deep">
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
                {variant === "member" && saved ? (
                  <span className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-accent-blue">
                    <Bookmark size={16} fill="currentColor" />
                  </span>
                ) : null}
              </div>
              <div className="mt-3 text-[13px] font-medium text-text-primary">
                {l.address || "—"}
              </div>
              <div className="text-[11px] text-text-dim">
                {l.city} · Listing #{l.mlsNumber}
              </div>
              <div className="mt-1 text-[14px] font-medium text-accent-blue">
                {fmtMoney(l.price)}
              </div>
              <div className="mt-3 text-[12px] text-text-muted">
                {l.beds} bd · {l.baths} ba ·{" "}
                {l.sqft ? l.sqft.toLocaleString() : "—"} sqft
              </div>
              <div className="mt-2 text-[11px] text-text-dim">
                Listing brokerage: {l.listingFirm?.name ?? "N/A"}
              </div>
              <div className="mt-1 text-[11px] text-text-dim">
                Last updated:{" "}
                {l.listDate ? new Date(l.listDate).toLocaleString() : "N/A"}
              </div>
              {l.daysOnMarket != null ? (
                <div className="mt-2 inline-block rounded-[8px] bg-bg-deep px-2 py-1 text-[11px] text-text-dim">
                  {l.daysOnMarket} days on market
                </div>
              ) : null}
              {variant === "member" ? (
                <div
                  className="mt-3 flex flex-wrap gap-2"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => setMatchListing(l)}
                    className="rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[12px] font-medium text-accent-blue"
                  >
                    Match to Clients
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleWatchlist(l)}
                    className={`rounded-[8px] px-3 py-2 text-[12px] font-medium ${
                      saved
                        ? "border border-accent-blue/40 bg-accent-blue/15 text-accent-blue"
                        : "bg-accent-blue text-white"
                    }`}
                  >
                    {saved ? "Saved" : "Watchlist"}
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div ref={sentinelRef} className="h-4 w-full" />
      {loadingMore ? (
        <div className="flex justify-center py-6 text-text-dim">
          <Loader2 className="animate-spin" size={22} />
        </div>
      ) : null}

      {variant === "member" ? (
        <Link
          href="/properties"
          className="mt-6 inline-block text-[12px] font-medium text-accent-blue"
        >
          My tracked properties →
        </Link>
      ) : (
        <p className="mt-6 text-center text-[12px] text-text-dim">
          Have an account?{" "}
          <Link href="/login" className="font-medium text-accent-blue">
            Sign in
          </Link>{" "}
          for client matching and your watchlist.
        </p>
      )}

      {variant === "member" ? (
        <MatchClientsModal
          open={matchListing !== null}
          onClose={() => setMatchListing(null)}
          listing={matchListing}
        />
      ) : null}
    </div>
  );
}

"use client";

import { MatchClientsModal } from "@/components/MatchClientsModal";
import { IdxComplianceNotice } from "@/components/IdxComplianceNotice";
import { useToast } from "@/components/ToastProvider";
import type { MlsListingPayload } from "@/lib/simplyrets";
import type { ParsedSearchFilters } from "@/app/api/ai/search-parse/route";
import { fmtMoney } from "@/lib/utils";
import { Bookmark, Loader2, Search, Sparkles, X } from "lucide-react";
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

const INPUT_STYLE = {
  background: "rgba(255,255,255,0.06)",
  border: "0.5px solid rgba(255,255,255,0.08)",
  color: "#ffffff",
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: 14,
  width: "100%",
  outline: "none",
};

const SELECT_STYLE = {
  ...INPUT_STYLE,
  appearance: "none" as const,
};

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
  const [mlsUnconfigured, setMlsUnconfigured] = useState(false);
  const [savedMls, setSavedMls] = useState<Set<string>>(new Set());
  const [matchListing, setMatchListing] = useState<MlsListingPayload | null>(null);

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

  // ── Natural-language search — parses free text into the same structured
  // filters above, then runs the normal query. Additive: the filter fields
  // stay editable afterward. Keywords the backend can't filter on server-side
  // (SimplyRETS has no free-text param) narrow the current page client-side.
  const [nlQuery, setNlQuery] = useState("");
  const [nlParsing, setNlParsing] = useState(false);
  const [nlKeywords, setNlKeywords] = useState<string[]>([]);

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
  }, [city, minPrice, maxPrice, minBeds, minBaths, minSqft, propertyType, status, sortKey, router, variant]);

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
        const err = new Error(data.error ?? "Search failed") as Error & { status?: number };
        err.status = res.status;
        throw err;
      }
      const batch = data.listings ?? [];
      setTotal(
        typeof data.total === "number" && Number.isFinite(data.total) ? data.total : null,
      );
      setHasMore(Boolean(data.hasMore));
      setOffset(nextOffset + batch.length);
      if (append) {
        setListings((prev) => {
          const seen = new Set(prev.map((l) => l.id));
          const merged = [...prev];
          for (const l of batch) {
            if (!seen.has(l.id)) { seen.add(l.id); merged.push(l); }
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
        setMlsUnconfigured(false);
      } catch (e) {
        const status = (e as { status?: number })?.status;
        if (status === 503) {
          // MLS feed not connected — show the friendly empty state, not an error.
          setMlsUnconfigured(true);
          setErrorMessage(null);
        } else {
          setErrorMessage(e instanceof Error ? e.message : "Could not load.");
        }
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
      } catch { /* ignore */ }
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
  }, [loading, loadingMore, hasMore, offset, listings.length, fetchPage, toast]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) void loadMore(); },
      { rootMargin: "120px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  async function toggleWatchlist(listing: MlsListingPayload) {
    const key = listing.mlsNumber || listing.id;
    if (savedMls.has(key)) {
      const res = await fetch(`/api/saved-properties/${encodeURIComponent(key)}`, { method: "DELETE" });
      if (!res.ok) { toast.toast("Could not remove", "warn"); return; }
      setSavedMls((s) => { const n = new Set(s); n.delete(key); return n; });
      toast.toast("Removed from watchlist", "default");
    } else {
      const res = await fetch("/api/saved-properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing }),
      });
      if (!res.ok) { toast.toast("Could not save", "warn"); return; }
      setSavedMls((s) => new Set(s).add(key));
      toast.toast("Saved to watchlist", "success");
    }
  }

  function applySearch() { pushUrlFromForm(); }

  async function runNlSearch() {
    const q = nlQuery.trim();
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
      const f = data.filters;
      const cityValue = f?.towns[0] || data.keywordFallback || "";

      // Reflect the parse into the structured fields so it's visible/editable,
      // then run the query from these fresh values directly — state setters
      // above haven't flushed yet, so pushUrlFromForm() would still see stale
      // city/minPrice/etc. if called in this same tick.
      setCity(cityValue);
      setMinPrice(f?.minPrice != null ? String(f.minPrice) : "");
      setMaxPrice(f?.maxPrice != null ? String(f.maxPrice) : "");
      setMinBeds(f?.beds != null ? String(f.beds) : "");
      setMinBaths(f?.baths != null ? String(f.baths) : "");
      setPropertyType(f?.propertyType ?? "");
      setNlKeywords(f?.keywords ?? []);

      const params = new URLSearchParams();
      if (cityValue) params.set("city", cityValue);
      if (f?.minPrice != null) params.set("minPrice", String(f.minPrice));
      if (f?.maxPrice != null) params.set("maxPrice", String(f.maxPrice));
      if (f?.beds != null) params.set("minBeds", String(f.beds));
      if (f?.baths != null) params.set("minBaths", String(f.baths));
      if (f?.propertyType) params.set("propertyType", f.propertyType);
      if (status.trim()) params.set("status", status.trim());
      if (sortKey.trim()) params.set("sort", sortKey.trim());

      const basePath = variant === "public" ? "/property-search" : "/listings";
      router.replace(`${basePath}?${params.toString()}`, { scroll: false });
    } catch {
      toast.toast("Could not understand that — try the filters below", "warn");
    } finally {
      setNlParsing(false);
    }
  }

  // Keywords ("pool", "ADU", "fixer"...) from NL search narrow the current
  // page client-side — SimplyRETS has no free-text param to filter on
  // server-side, so this only sees listings already fetched by the
  // structured filters above.
  const displayListings = useMemo(() => {
    if (nlKeywords.length === 0) return listings;
    return listings.filter((l) => {
      const haystack = `${l.description ?? ""} ${l.address ?? ""}`.toLowerCase();
      return nlKeywords.some((k) => haystack.includes(k));
    });
  }, [listings, nlKeywords]);

  const showingLine = useMemo(() => {
    if (loading && listings.length === 0) return null;
    const n = displayListings.length;
    if (nlKeywords.length > 0) return `Showing ${n} matching "${nlKeywords.join(", ")}"`;
    if (total != null && Number.isFinite(total)) return `Showing ${n} of ${total} properties`;
    return `Showing ${n} properties`;
  }, [loading, listings.length, displayListings.length, nlKeywords, total]);

  const returnToParam = useMemo(() => {
    const q = searchParams.toString();
    const base = variant === "public" ? "/property-search" : "/listings";
    return encodeURIComponent(q ? `${base}?${q}` : base);
  }, [searchParams, variant]);

  const listingDetailBase = variant === "public" ? "/property-search" : "/listings";

  return (
    <div
      className="min-h-[100dvh] pb-[130px]"
      style={{
        background: `
          radial-gradient(ellipse 80% 50% at 50% -20%, rgba(59,130,246,0.10), transparent),
          radial-gradient(ellipse 60% 50% at 80% 80%, rgba(167,139,250,0.06), transparent)
        `,
        color: "var(--oc-text-1)",
      }}
    >
      <div className="mx-auto max-w-lg px-5 pt-6">

        {/* ── IDX compliance (member) ── */}
        {variant === "member" && (
          <div className="mb-4">
            <IdxComplianceNotice />
          </div>
        )}

        {/* ── Header ── */}
        <header className="mb-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1
                className="text-[22px] font-semibold leading-tight"
                style={{ color: "#ffffff", letterSpacing: "-0.02em" }}
              >
                Property Search
              </h1>
              <p className="mt-0.5 text-[13px]" style={{ color: "#6B7280" }}>
                Live property listings
              </p>
              {showingLine && (
                <p className="mt-1 text-[12px]" style={{ color: "#6B7280" }}>
                  {showingLine}
                </p>
              )}
            </div>
            {variant === "member" && (
              <Link
                href="/properties/saved"
                className="flex-shrink-0 flex items-center gap-1.5 text-[13px] font-medium px-3 py-1.5 rounded-full"
                style={{
                  background: "rgba(59,130,246,0.1)",
                  color: "#3B82F6",
                  border: "0.5px solid rgba(59,130,246,0.2)",
                  marginTop: 2,
                }}
              >
                <Bookmark size={13} />
                Watchlist
              </Link>
            )}
          </div>
        </header>

        {/* ── MLS not connected ── */}
        {mlsUnconfigured && (
          <div className="rounded-[18px] border border-border bg-card p-6 text-center">
            <Search size={28} className="mx-auto text-muted-foreground" />
            <p className="mt-3 font-display text-[15px] font-semibold text-foreground">
              The MLS feed isn&apos;t connected yet
            </p>
            <p className="mt-1.5 font-display text-[13px] leading-[1.55] text-muted-foreground">
              Once it&apos;s connected, you&apos;ll be able to search live
              listings and match them to your clients here. Your saved
              properties and manual listings still work below.
            </p>
            {variant === "member" && (
              <Link
                href="/properties"
                className="mt-4 inline-block font-display text-[13px] font-semibold text-primary"
              >
                Go to my tracked properties →
              </Link>
            )}
          </div>
        )}

        {/* ── Natural-language search ── */}
        {!mlsUnconfigured && (
        <>
        <div className="mb-3 rounded-xl border border-border bg-card px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="size-3.5 text-primary shrink-0" />
            <input
              value={nlQuery}
              onChange={(e) => setNlQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void runNlSearch();
                }
              }}
              placeholder="Describe it — “3-bed under $900k in Tenafly with a pool”"
              className="flex-1 min-w-0 bg-transparent font-display text-body text-foreground outline-none placeholder:text-muted-foreground/60"
              disabled={nlParsing}
            />
            <button
              type="button"
              onClick={() => void runNlSearch()}
              disabled={nlParsing || !nlQuery.trim()}
              className="shrink-0 rounded-full bg-primary px-3 py-1.5 font-display text-caption font-semibold text-primary-foreground disabled:opacity-50"
            >
              {nlParsing ? "…" : "Ask Aria"}
            </button>
          </div>
          {nlKeywords.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {nlKeywords.map((k) => (
                <span
                  key={k}
                  className="rounded-full bg-secondary px-2 py-0.5 font-display text-[11px] font-medium text-muted-foreground"
                >
                  {k}
                </span>
              ))}
              <button
                type="button"
                onClick={() => setNlKeywords([])}
                className="flex items-center gap-0.5 font-display text-[11px] text-muted-foreground/70 hover:text-muted-foreground"
              >
                <X className="size-3" /> Clear
              </button>
            </div>
          )}
        </div>

        {/* ── Search form ── */}
        <div className="grid grid-cols-2 gap-2 mb-2">
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Town or city"
            className="col-span-2 placeholder-[#4B5563]"
            style={INPUT_STYLE}
          />
          <input
            type="number"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            placeholder="Min $"
            className="placeholder-[#4B5563]"
            style={INPUT_STYLE}
          />
          <input
            type="number"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="Max $"
            className="placeholder-[#4B5563]"
            style={INPUT_STYLE}
          />
          <input
            type="number"
            value={minBeds}
            onChange={(e) => setMinBeds(e.target.value)}
            placeholder="Min beds"
            className="placeholder-[#4B5563]"
            style={INPUT_STYLE}
          />
          <input
            type="number"
            value={minBaths}
            onChange={(e) => setMinBaths(e.target.value)}
            placeholder="Min baths"
            className="placeholder-[#4B5563]"
            style={INPUT_STYLE}
          />
          <select
            value={propertyType}
            onChange={(e) => setPropertyType(e.target.value)}
            aria-label="Property type"
            className="col-span-2"
            style={SELECT_STYLE}
          >
            {PROPERTY_TYPES.map((o) => (
              <option key={o.label} value={o.value} style={{ background: "#111111" }}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void applySearch()}
            disabled={loading}
            className="col-span-2 flex items-center justify-center gap-2 text-[14px] font-semibold text-white active:scale-[0.97] transition-transform duration-100 disabled:opacity-60"
            style={{
              background: "#3B82F6",
              borderRadius: 8,
              padding: "11px",
            }}
          >
            <Search size={14} />
            Search
          </button>
        </div>

        {/* ── More filters toggle ── */}
        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          className="mb-3 text-[13px] font-medium"
          style={{ color: "#3B82F6" }}
        >
          {filtersOpen ? "Hide filters" : "More filters & sort"}
        </button>

        {/* ── Expanded filter panel ── */}
        {filtersOpen && (
          <div
            className="mb-4 space-y-3 p-4"
            style={{
              background: "rgba(20,20,22,0.6)",
              border: "0.5px solid rgba(255,255,255,0.06)",
              borderRadius: 14,
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
            }}
          >
            <div>
              <p
                className="mb-1.5 text-[11px] font-semibold uppercase"
                style={{ color: "#6B7280", letterSpacing: "0.08em" }}
              >
                Min sqft
              </p>
              <input
                type="number"
                value={minSqft}
                onChange={(e) => setMinSqft(e.target.value)}
                className="placeholder-[#4B5563]"
                style={INPUT_STYLE}
              />
            </div>
            <div>
              <p
                className="mb-1.5 text-[11px] font-semibold uppercase"
                style={{ color: "#6B7280", letterSpacing: "0.08em" }}
              >
                Status
              </p>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                style={SELECT_STYLE}
              >
                {STATUS_OPTS.map((o) => (
                  <option key={o.value} value={o.value} style={{ background: "#111111" }}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p
                className="mb-1.5 text-[11px] font-semibold uppercase"
                style={{ color: "#6B7280", letterSpacing: "0.08em" }}
              >
                Sort by
              </p>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
                style={SELECT_STYLE}
              >
                {SORT_OPTS.map((o) => (
                  <option key={o.value} value={o.value} style={{ background: "#111111" }}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => void applySearch()}
              className="w-full text-[14px] font-semibold text-white active:scale-[0.97] transition-transform duration-100"
              style={{ background: "#3B82F6", borderRadius: 8, padding: "11px" }}
            >
              Apply filters
            </button>
          </div>
        )}
        </>
        )}

        {/* ── Error state ── */}
        {errorMessage && (
          <div
            className="mb-4 px-4 py-3 text-[13px]"
            style={{
              background: "rgba(20,20,22,0.6)",
              border: "0.5px solid rgba(255,255,255,0.06)",
              borderRadius: 12,
              color: "#F59E0B",
            }}
          >
            {errorMessage}
          </div>
        )}

        {/* ── Loading spinner ── */}
        {loading && listings.length === 0 && (
          <div className="mt-12 flex justify-center">
            <Loader2 className="animate-spin" size={22} style={{ color: "#6B7280" }} />
          </div>
        )}

        {/* ── Empty state ── */}
        {!mlsUnconfigured && !loading && displayListings.length === 0 && !errorMessage && (
          <div className="mt-12 flex flex-col items-center text-center">
            <p
              className="mb-1 text-[11px] font-semibold uppercase"
              style={{ color: "#6B7280", letterSpacing: "0.08em" }}
            >
              No Results
            </p>
            <p className="text-[13px]" style={{ color: "#9CA3AF" }}>
              {nlKeywords.length > 0
                ? `No listings on this page mention "${nlKeywords.join(", ")}" — try clearing that or widening the filters`
                : "No listings match your filters"}
            </p>
          </div>
        )}

        {/* ── Listing cards ── */}
        <div className="mt-4 grid grid-cols-1 gap-3">
          {displayListings.map((l) => {
            const photo = l.photos?.[0];
            const mlsKey = l.mlsNumber || l.id;
            const saved = savedMls.has(mlsKey);
            return (
              <div
                key={l.id}
                role="button"
                tabIndex={0}
                onClick={() =>
                  router.push(`${listingDetailBase}/${encodeURIComponent(l.id)}?return=${returnToParam}`)
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(`${listingDetailBase}/${encodeURIComponent(l.id)}?return=${returnToParam}`);
                  }
                }}
                className="cursor-pointer text-left outline-none"
                style={{
                  background: "rgba(20,20,22,0.7)",
                  border: "0.5px solid rgba(255,255,255,0.06)",
                  borderRadius: 14,
                  padding: 14,
                  backdropFilter: "blur(20px)",
                  WebkitBackdropFilter: "blur(20px)",
                }}
              >
                {/* Photo */}
                <div
                  className="relative w-full overflow-hidden"
                  style={{ height: 144, borderRadius: 10, background: "rgba(255,255,255,0.04)" }}
                >
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[11px]" style={{ color: "#6B7280" }}>
                      No photo
                    </div>
                  )}
                  {/* NJMLS IDX trademark — required on every listing photo per IDX agreement */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/IDX_logo.JPG"
                    alt="NJMLS IDX"
                    className="absolute bottom-2 right-2 h-auto w-20 max-w-[30%] rounded-[4px] bg-white px-2 py-1 object-contain shadow-sm"
                    draggable={false}
                  />
                  {variant === "member" && saved && (
                    <span
                      className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full"
                      style={{ background: "rgba(0,0,0,0.55)", color: "#3B82F6" }}
                    >
                      <Bookmark size={16} fill="currentColor" />
                    </span>
                  )}
                </div>

                {/* Address */}
                <div className="mt-3 text-[14px] font-semibold" style={{ color: "#ffffff", letterSpacing: "-0.01em" }}>
                  {l.address || "—"}
                </div>

                {/* City + MLS # */}
                <div className="mt-0.5 text-[12px]" style={{ color: "#6B7280" }}>
                  {l.city} · Listing #{l.mlsNumber}
                </div>

                {/* Price */}
                <div className="mt-1.5 text-[15px] font-semibold" style={{ color: "#3B82F6" }}>
                  {fmtMoney(l.price)}
                </div>

                {/* Beds/baths/sqft */}
                <div className="mt-2 text-[12px]" style={{ color: "#9CA3AF" }}>
                  {l.beds} bd · {l.baths} ba · {l.sqft ? l.sqft.toLocaleString() : "—"} sqft
                </div>

                {/* Brokerage */}
                <div className="mt-1 text-[11px]" style={{ color: "#6B7280" }}>
                  {l.listingFirm?.name ?? "N/A"}
                </div>

                {/* Days on market pill */}
                {l.daysOnMarket != null && (
                  <div
                    className="mt-2 inline-block text-[11px]"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      color: "#6B7280",
                      padding: "2px 8px",
                      borderRadius: 6,
                    }}
                  >
                    {l.daysOnMarket} days on market
                  </div>
                )}

                {/* CRM actions (member only) */}
                {variant === "member" && (
                  <div
                    className="mt-3 flex flex-wrap gap-2"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => setMatchListing(l)}
                      className="text-[13px] font-medium text-white active:scale-[0.97] transition-transform duration-100"
                      style={{
                        background: "transparent",
                        border: "0.5px solid rgba(255,255,255,0.15)",
                        borderRadius: 8,
                        padding: "9px 14px",
                      }}
                    >
                      Match to Clients
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleWatchlist(l)}
                      className="text-[13px] font-semibold active:scale-[0.97] transition-transform duration-100"
                      style={
                        saved
                          ? { background: "rgba(59,130,246,0.15)", color: "#3B82F6", borderRadius: 8, padding: "9px 14px" }
                          : { background: "#3B82F6", color: "#ffffff", borderRadius: 8, padding: "9px 14px" }
                      }
                    >
                      {saved ? "Saved" : "Watchlist"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Infinite scroll sentinel ── */}
        <div ref={sentinelRef} className="h-4 w-full" />
        {loadingMore && (
          <div className="flex justify-center py-6">
            <Loader2 className="animate-spin" size={22} style={{ color: "#6B7280" }} />
          </div>
        )}

        {/* ── Footer ── */}
        {variant === "member" ? (
          <Link
            href="/properties"
            className="mt-6 inline-block text-[13px] font-medium"
            style={{ color: "#3B82F6" }}
          >
            My tracked properties →
          </Link>
        ) : (
          <p className="mt-6 text-center text-[12px]" style={{ color: "#6B7280" }}>
            Have an account?{" "}
            <Link href="/login" className="font-medium" style={{ color: "#3B82F6" }}>
              Sign in
            </Link>{" "}
            for client matching and your watchlist.
          </p>
        )}

        {/* ── Match to Clients modal ── */}
        {variant === "member" && (
          <MatchClientsModal
            open={matchListing !== null}
            onClose={() => setMatchListing(null)}
            listing={matchListing}
          />
        )}

      </div>
    </div>
  );
}

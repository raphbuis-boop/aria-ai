"use client";

import { IdxComplianceNotice } from "@/components/IdxComplianceNotice";
import { useToast } from "@/components/ToastProvider";
import { smsUrl, whatsAppUrl } from "@/lib/messaging-links";
import type { MlsListingPayload } from "@/lib/simplyrets";
import { fmtMoney, initials } from "@/lib/utils";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Lock,
  MessageSquare,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type MatchedClient = {
  clientId: string;
  name: string | null;
  phone: string | null;
  score: number;
  reasons: string[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreBadgeStyle(score: number): React.CSSProperties {
  if (score >= 80)
    return { background: "rgba(34,197,94,0.15)", color: "#22c55e" };
  if (score >= 60)
    return { background: "rgba(234,179,8,0.15)", color: "#eab308" };
  return { background: "rgba(255,255,255,0.08)", color: "#9CA3AF" };
}

function scoreLabel(score: number): string {
  if (score >= 80) return "Strong match";
  if (score >= 60) return "Good match";
  return "Possible match";
}

function clientInitials(name: string | null): string {
  return initials(name ?? "?");
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ListingRevenueClient({
  listing,
  returnTo,
}: {
  listing: MlsListingPayload;
  returnTo: string;
}) {
  const router = useRouter();
  const toast = useToast();

  // Photo carousel
  const [photoIdx, setPhotoIdx] = useState(0);

  // Matching clients
  const [matches, setMatches] = useState<MatchedClient[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(true);

  // Watchlist
  const [isSaved, setIsSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // Client action drawer
  const [activeClient, setActiveClient] = useState<MatchedClient | null>(null);

  // Messaging sub-state (inside drawer)
  const [showDraft, setShowDraft] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftEditing, setDraftEditing] = useState(false);
  const draftRef = useRef<HTMLTextAreaElement>(null);

  const photos = listing.photos ?? [];
  const mlsKey = listing.mlsNumber || listing.id;

  // Fetch matching clients
  useEffect(() => {
    void (async () => {
      setMatchesLoading(true);
      try {
        const res = await fetch("/api/mls/match-clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listing }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { matches?: MatchedClient[] };
        setMatches(data.matches ?? []);
      } catch {
        // non-critical
      } finally {
        setMatchesLoading(false);
      }
    })();
  }, [listing]);

  // Fetch saved status
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/saved-properties?idsOnly=1");
        if (!res.ok) return;
        const data = (await res.json()) as { mlsNumbers?: string[] };
        setIsSaved((data.mlsNumbers ?? []).includes(mlsKey));
      } catch {
        // non-critical
      }
    })();
  }, [mlsKey]);

  // Focus textarea when draft editing turns on
  useEffect(() => {
    if (draftEditing && draftRef.current) draftRef.current.focus();
  }, [draftEditing]);

  // ── Save / unsave ──

  const toggleSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (isSaved) {
        const res = await fetch(
          `/api/saved-properties/${encodeURIComponent(mlsKey)}`,
          { method: "DELETE" },
        );
        if (!res.ok) { toast.toast("Could not remove", "warn"); return; }
        setIsSaved(false);
        toast.toast("Removed from watchlist", "default");
      } else {
        const res = await fetch("/api/saved-properties", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listing }),
        });
        if (!res.ok) { toast.toast("Could not save", "warn"); return; }
        setIsSaved(true);
        toast.toast("Saved to watchlist", "success");
      }
    } finally {
      setSaving(false);
    }
  }, [isSaved, saving, mlsKey, listing, toast]);

  // ── Draft message ──

  const openDraft = useCallback(async (client: MatchedClient) => {
    setShowDraft(true);
    setDraftLoading(true);
    setDraftText("");
    setDraftEditing(false);

    const scenario = `New ${listing.beds}bd listing at ${listing.address} — ${fmtMoney(listing.price)}`;
    const context = client.reasons.slice(0, 2).join(", ");

    try {
      const res = await fetch("/api/ai/draft-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: client.name ?? "your client",
          scenario,
          context,
          skipInsert: true,
        }),
      });
      const data = (await res.json()) as { draft?: string };
      setDraftText(data.draft ?? "");
    } catch {
      setDraftText("");
    } finally {
      setDraftLoading(false);
    }
  }, [listing]);

  // ── Open client drawer ──

  const openClient = useCallback((client: MatchedClient) => {
    setActiveClient(client);
    setShowDraft(false);
    setDraftText("");
    setDraftEditing(false);
  }, []);

  const closeDrawer = useCallback(() => {
    setActiveClient(null);
    setShowDraft(false);
    setDraftText("");
    setDraftEditing(false);
  }, []);

  // ── Photo nav ──

  const prevPhoto = () =>
    setPhotoIdx((i) => (i === 0 ? photos.length - 1 : i - 1));
  const nextPhoto = () =>
    setPhotoIdx((i) => (i === photos.length - 1 ? 0 : i + 1));

  // ── Schedule showing deep-link ──

  const scheduleShowing = useCallback(() => {
    const addr = encodeURIComponent(listing.address || "");
    router.push(`/showings?new=1&address=${addr}`);
  }, [listing.address, router]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div
        className="min-h-screen pb-[100px]"
        style={{ background: "#0a0a0b", color: "#ffffff" }}
      >
        {/* ── Top nav bar ── */}
        <div
          className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3"
          style={{
            background: "rgba(10,10,11,0.85)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderBottom: "0.5px solid rgba(255,255,255,0.06)",
          }}
        >
          <button
            type="button"
            onClick={() => router.push(returnTo)}
            className="flex h-9 w-9 items-center justify-center rounded-full active:bg-white/10"
            aria-label="Back"
          >
            <ArrowLeft size={20} style={{ color: "#9CA3AF" }} />
          </button>
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-[15px] font-semibold"
              style={{ color: "#ffffff" }}
            >
              {listing.address || "Listing"}
            </p>
            <p className="text-[12px]" style={{ color: "#6B7280" }}>
              {listing.city}
              {listing.mlsNumber ? ` · #${listing.mlsNumber}` : ""}
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-lg">
          {/* ── Photo hero ── */}
          <div
            className="relative w-full overflow-hidden"
            style={{ height: 240, background: "rgba(255,255,255,0.04)" }}
          >
            {photos.length > 0 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photos[photoIdx]}
                alt={listing.address}
                className="h-full w-full object-cover"
              />
            ) : (
              <div
                className="flex h-full items-center justify-center text-[13px]"
                style={{ color: "#6B7280" }}
              >
                No photos
              </div>
            )}

            {/* IDX logo — required on every listing photo per NJMLS IDX agreement */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/IDX_logo.JPG"
              alt="NJMLS IDX"
              className="absolute bottom-3 right-3 h-auto w-16 rounded-[4px] bg-white px-1.5 py-0.5 object-contain shadow"
              draggable={false}
            />

            {/* Status pill */}
            {listing.status && (
              <span
                className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase"
                style={{
                  background:
                    listing.status.toLowerCase() === "active"
                      ? "rgba(34,197,94,0.85)"
                      : "rgba(107,114,128,0.85)",
                  color: "#ffffff",
                  letterSpacing: "0.05em",
                  backdropFilter: "blur(8px)",
                }}
              >
                {listing.status}
              </span>
            )}

            {/* Photo nav */}
            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={prevPhoto}
                  className="absolute left-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full active:scale-95"
                  style={{ background: "rgba(0,0,0,0.55)" }}
                  aria-label="Previous photo"
                >
                  <ChevronLeft size={18} style={{ color: "#ffffff" }} />
                </button>
                <button
                  type="button"
                  onClick={nextPhoto}
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full active:scale-95"
                  style={{ background: "rgba(0,0,0,0.55)" }}
                  aria-label="Next photo"
                >
                  <ChevronRight size={18} style={{ color: "#ffffff" }} />
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
                  {photos.slice(0, 8).map((_, i) => (
                    <div
                      key={i}
                      className="rounded-full transition-all"
                      style={{
                        width: i === photoIdx ? 16 : 5,
                        height: 5,
                        background:
                          i === photoIdx
                            ? "#ffffff"
                            : "rgba(255,255,255,0.4)",
                      }}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* ── Property headline ── */}
          <div className="px-5 pt-5 pb-4">
            <div className="text-[26px] font-bold leading-tight" style={{ letterSpacing: "-0.02em" }}>
              {fmtMoney(listing.price)}
            </div>
            <div
              className="mt-1 text-[14px] font-medium"
              style={{ color: "#ffffff" }}
            >
              {listing.address}
            </div>
            <div className="mt-0.5 text-[13px]" style={{ color: "#6B7280" }}>
              {listing.city}
              {listing.state ? `, ${listing.state}` : ""}
              {listing.postalCode ? ` ${listing.postalCode}` : ""}
            </div>

            {/* Specs pills */}
            <div className="mt-3 flex flex-wrap gap-2">
              {listing.beds > 0 && (
                <span
                  className="rounded-full px-3 py-1 text-[12px] font-medium"
                  style={{
                    background: "rgba(59,130,246,0.12)",
                    color: "#60A5FA",
                  }}
                >
                  {listing.beds} bed
                </span>
              )}
              {listing.baths > 0 && (
                <span
                  className="rounded-full px-3 py-1 text-[12px] font-medium"
                  style={{
                    background: "rgba(59,130,246,0.12)",
                    color: "#60A5FA",
                  }}
                >
                  {listing.baths} bath
                </span>
              )}
              {listing.sqft > 0 && (
                <span
                  className="rounded-full px-3 py-1 text-[12px] font-medium"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    color: "#9CA3AF",
                  }}
                >
                  {listing.sqft.toLocaleString()} sqft
                </span>
              )}
              {listing.daysOnMarket != null && (
                <span
                  className="rounded-full px-3 py-1 text-[12px] font-medium"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    color: "#9CA3AF",
                  }}
                >
                  {listing.daysOnMarket} days on market
                </span>
              )}
            </div>
          </div>

          {/* ── Matching clients rail ── */}
          <div
            className="mx-5 mb-5 rounded-2xl overflow-hidden"
            style={{
              background: "rgba(167,139,250,0.06)",
              border: "0.5px solid rgba(167,139,250,0.18)",
            }}
          >
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-center gap-2 mb-0.5">
                {/* Aria logo */}
                <svg viewBox="0 0 200 200" width="14" height="14" aria-hidden="true">
                  <defs>
                    <linearGradient id="rc-aria-grad" x1="100" y1="20" x2="100" y2="180" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#A78BFA" />
                      <stop offset="100%" stopColor="#7C3AED" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M100 25 L165 175 L130 175 L120 150 L80 150 L70 175 L35 175 Z M90 125 L110 125 L100 100 Z"
                    fill="url(#rc-aria-grad)"
                  />
                </svg>
                <span
                  className="text-[11px] font-semibold uppercase"
                  style={{ color: "#A78BFA", letterSpacing: "0.06em" }}
                >
                  Client Matches
                </span>
              </div>
              <p className="text-[12px]" style={{ color: "#6B7280" }}>
                {matchesLoading
                  ? "Finding matching clients…"
                  : matches.length > 0
                  ? `${matches.length} client${matches.length !== 1 ? "s" : ""} match this listing`
                  : "No active clients match this listing"}
              </p>
            </div>

            {/* Loading shimmer */}
            {matchesLoading && (
              <div className="flex gap-3 overflow-x-auto px-4 pb-4 no-scrollbar">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="flex-shrink-0 rounded-xl animate-pulse"
                    style={{
                      width: 140,
                      height: 100,
                      background: "rgba(255,255,255,0.06)",
                    }}
                  />
                ))}
              </div>
            )}

            {/* Match cards */}
            {!matchesLoading && matches.length > 0 && (
              <div
                className="flex gap-3 overflow-x-auto px-4 pb-4"
                style={{ scrollbarWidth: "none" }}
              >
                {matches.map((client) => {
                  const badge = scoreBadgeStyle(client.score);
                  return (
                    <button
                      key={client.clientId}
                      type="button"
                      onClick={() => openClient(client)}
                      className="flex-shrink-0 text-left rounded-xl p-3 active:scale-[0.97] transition-transform duration-100"
                      style={{
                        width: 148,
                        background: "rgba(255,255,255,0.05)",
                        border: "0.5px solid rgba(255,255,255,0.10)",
                      }}
                    >
                      {/* Avatar + score */}
                      <div className="flex items-center justify-between mb-2">
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-bold"
                          style={{
                            background: "rgba(167,139,250,0.15)",
                            color: "#A78BFA",
                          }}
                        >
                          {clientInitials(client.name)}
                        </div>
                        <span
                          className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                          style={badge}
                        >
                          {client.score}
                        </span>
                      </div>

                      {/* Name */}
                      <p
                        className="text-[13px] font-semibold leading-tight truncate mb-1"
                        style={{ color: "#ffffff" }}
                      >
                        {client.name ?? "Client"}
                      </p>

                      {/* Reasons */}
                      <p
                        className="text-[11px] leading-snug"
                        style={{ color: "#9CA3AF" }}
                      >
                        {client.reasons.slice(0, 2).join(" · ") || scoreLabel(client.score)}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}

            {/* No matches */}
            {!matchesLoading && matches.length === 0 && (
              <div className="px-4 pb-4">
                <p className="text-[12px]" style={{ color: "#4B5563" }}>
                  Add clients with matching criteria to see them here.
                </p>
              </div>
            )}
          </div>

          {/* ── Property details ── */}
          {listing.description && (
            <div className="px-5 mb-5">
              <p
                className="mb-2 text-[11px] font-semibold uppercase"
                style={{ color: "#6B7280", letterSpacing: "0.08em" }}
              >
                Description
              </p>
              <p
                className="text-[13px] leading-relaxed"
                style={{ color: "#D1D5DB" }}
              >
                {listing.description}
              </p>
            </div>
          )}

          {/* Specs grid */}
          <div className="px-5 mb-5">
            <p
              className="mb-3 text-[11px] font-semibold uppercase"
              style={{ color: "#6B7280", letterSpacing: "0.08em" }}
            >
              Details
            </p>
            <div
              className="grid grid-cols-2 gap-px rounded-2xl overflow-hidden"
              style={{ border: "0.5px solid rgba(255,255,255,0.08)" }}
            >
              {[
                { label: "Price", value: fmtMoney(listing.price) },
                { label: "MLS #", value: listing.mlsNumber || "—" },
                { label: "Beds", value: listing.beds || "—" },
                { label: "Baths", value: listing.baths || "—" },
                listing.sqft > 0 && {
                  label: "Sqft",
                  value: listing.sqft.toLocaleString(),
                },
                listing.yearBuilt && {
                  label: "Year built",
                  value: listing.yearBuilt,
                },
                listing.lotSize && {
                  label: "Lot size",
                  value: `${listing.lotSize.toLocaleString()} sqft`,
                },
                listing.garageSpaces && {
                  label: "Garage",
                  value: `${listing.garageSpaces} spaces`,
                },
                listing.propertyType && {
                  label: "Type",
                  value: listing.propertyType,
                },
                listing.taxAnnualAmount && {
                  label: "Annual tax",
                  value: fmtMoney(listing.taxAnnualAmount),
                },
                listing.hoaFee && {
                  label: "HOA",
                  value: `${fmtMoney(listing.hoaFee)}/${listing.hoaFrequency ?? "mo"}`,
                },
              ]
                .filter(Boolean)
                .map((spec) => {
                  const { label, value } = spec as { label: string; value: string | number };
                  return (
                    <div
                      key={label}
                      className="px-4 py-3"
                      style={{ background: "rgba(255,255,255,0.03)" }}
                    >
                      <p
                        className="text-[11px] mb-0.5"
                        style={{ color: "#6B7280" }}
                      >
                        {label}
                      </p>
                      <p
                        className="text-[13px] font-medium"
                        style={{ color: "#ffffff" }}
                      >
                        {value}
                      </p>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Listing agent */}
          {listing.listingRepresentative?.name && (
            <div className="px-5 mb-5">
              <p
                className="mb-1 text-[11px] font-semibold uppercase"
                style={{ color: "#6B7280", letterSpacing: "0.08em" }}
              >
                Listed by
              </p>
              <p className="text-[13px]" style={{ color: "#9CA3AF" }}>
                {listing.listingRepresentative.name}
                {listing.listingFirm?.name
                  ? ` · ${listing.listingFirm.name}`
                  : ""}
              </p>
            </div>
          )}

          {/* IDX compliance */}
          <div className="px-5 mb-6">
            <IdxComplianceNotice />
          </div>
        </div>
      </div>

      {/* ── Sticky bottom action bar ── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-20 flex items-center gap-2 px-4 py-3"
        style={{
          background: "rgba(10,10,11,0.92)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderTop: "0.5px solid rgba(255,255,255,0.08)",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)",
        }}
      >
        {/* Save to watchlist */}
        <button
          type="button"
          onClick={() => void toggleSave()}
          disabled={saving}
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl active:scale-95 transition-transform duration-100 disabled:opacity-60"
          style={{
            background: isSaved
              ? "rgba(59,130,246,0.15)"
              : "rgba(255,255,255,0.07)",
            border: "0.5px solid rgba(255,255,255,0.12)",
          }}
          aria-label={isSaved ? "Remove from watchlist" : "Save to watchlist"}
        >
          {isSaved ? (
            <BookmarkCheck size={20} style={{ color: "#3B82F6" }} />
          ) : (
            <Bookmark size={20} style={{ color: "#9CA3AF" }} />
          )}
        </button>

        {/* Schedule showing */}
        <button
          type="button"
          onClick={scheduleShowing}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 text-[14px] font-semibold text-white active:opacity-80 transition-opacity duration-100"
          style={{ background: "#3B82F6" }}
        >
          <Calendar size={16} />
          Schedule Showing
        </button>

        {/* Add to My Listings — coming soon */}
        <button
          type="button"
          disabled
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl opacity-35"
          style={{
            background: "rgba(255,255,255,0.07)",
            border: "0.5px solid rgba(255,255,255,0.12)",
          }}
          aria-label="Add to My Listings (coming soon)"
          title="Add to My Listings — coming soon"
        >
          <Lock size={18} style={{ color: "#9CA3AF" }} />
        </button>
      </div>

      {/* ── Client action drawer ── */}
      {activeClient && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
            onClick={closeDrawer}
          />

          {/* Sheet */}
          <div
            className="fixed bottom-0 left-0 right-0 z-50 flex flex-col"
            style={{
              maxHeight: "90vh",
              borderRadius: "20px 20px 0 0",
              background: "rgba(14,14,16,0.98)",
              border: "0.5px solid rgba(255,255,255,0.10)",
              backdropFilter: "blur(40px)",
              WebkitBackdropFilter: "blur(40px)",
            }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div
                className="rounded-full"
                style={{ width: 36, height: 4, background: "rgba(255,255,255,0.18)" }}
              />
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 pb-8 pt-2">
              {/* Client header */}
              <div className="flex items-start gap-3 mb-5">
                <div
                  className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-[16px] font-bold"
                  style={{
                    background: "rgba(167,139,250,0.15)",
                    color: "#A78BFA",
                  }}
                >
                  {clientInitials(activeClient.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="text-[17px] font-semibold"
                    style={{ color: "#ffffff" }}
                  >
                    {activeClient.name ?? "Client"}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className="rounded-full px-2.5 py-0.5 text-[12px] font-semibold"
                      style={scoreBadgeStyle(activeClient.score)}
                    >
                      {activeClient.score} · {scoreLabel(activeClient.score)}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full active:bg-white/10"
                >
                  <X size={18} style={{ color: "#9CA3AF" }} />
                </button>
              </div>

              {/* Match reasons */}
              {activeClient.reasons.length > 0 && (
                <div className="mb-5">
                  <p
                    className="mb-2 text-[11px] font-semibold uppercase"
                    style={{ color: "#6B7280", letterSpacing: "0.08em" }}
                  >
                    Why they match
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {activeClient.reasons.map((r) => (
                      <span
                        key={r}
                        className="rounded-full px-3 py-1 text-[12px] font-medium"
                        style={{
                          background: "rgba(167,139,250,0.10)",
                          color: "#C4B5FD",
                          border: "0.5px solid rgba(167,139,250,0.18)",
                        }}
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              {!showDraft && (
                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={() => void openDraft(activeClient)}
                    className="flex items-center justify-center gap-2 rounded-2xl py-3.5 text-[14px] font-semibold text-white active:opacity-80 transition-opacity"
                    style={{ background: "#3B82F6" }}
                  >
                    <MessageSquare size={16} />
                    Draft Message
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      closeDrawer();
                      scheduleShowing();
                    }}
                    className="flex items-center justify-center gap-2 rounded-2xl py-3.5 text-[14px] font-semibold active:opacity-80 transition-opacity"
                    style={{
                      background: "transparent",
                      border: "0.5px solid rgba(255,255,255,0.15)",
                      color: "#ffffff",
                    }}
                  >
                    <Calendar size={16} />
                    Schedule Showing
                  </button>
                </div>
              )}

              {/* ── Message draft sub-section ── */}
              {showDraft && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p
                      className="text-[13px] font-semibold"
                      style={{ color: "#A78BFA" }}
                    >
                      Draft for {activeClient.name ?? "client"}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setShowDraft(false);
                        setDraftText("");
                        setDraftEditing(false);
                      }}
                      className="text-[12px]"
                      style={{ color: "#6B7280" }}
                    >
                      ← Back
                    </button>
                  </div>

                  {draftLoading ? (
                    <div className="space-y-2 mb-5">
                      <div
                        className="h-4 rounded animate-pulse"
                        style={{ background: "rgba(255,255,255,0.08)", width: "90%" }}
                      />
                      <div
                        className="h-4 rounded animate-pulse"
                        style={{ background: "rgba(255,255,255,0.08)", width: "76%" }}
                      />
                      <div
                        className="h-4 rounded animate-pulse"
                        style={{ background: "rgba(255,255,255,0.08)", width: "83%" }}
                      />
                      <p
                        className="text-[12px] pt-1"
                        style={{ color: "#6B7280" }}
                      >
                        Drafting in your voice…
                      </p>
                    </div>
                  ) : (
                    <textarea
                      ref={draftRef}
                      value={draftText}
                      onChange={(e) => setDraftText(e.target.value)}
                      readOnly={!draftEditing}
                      rows={5}
                      className="w-full resize-none rounded-2xl p-4 text-[14px] leading-relaxed outline-none mb-4"
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        border: "0.5px solid rgba(255,255,255,0.10)",
                        color: "#e0e0e5",
                        minHeight: 120,
                      }}
                    />
                  )}

                  {!draftLoading && (
                    <>
                      <div className="flex gap-2 mb-3">
                        <button
                          type="button"
                          disabled={!draftText.trim() || !activeClient.phone}
                          onClick={() => {
                            if (!activeClient.phone || !draftText.trim()) return;
                            window.location.href = smsUrl(activeClient.phone, draftText);
                          }}
                          className="flex-1 rounded-2xl py-3 text-[14px] font-semibold text-white disabled:opacity-40 active:opacity-80 transition-opacity"
                          style={{ background: "#3B82F6" }}
                        >
                          Messages
                        </button>
                        <button
                          type="button"
                          disabled={!draftText.trim() || !activeClient.phone}
                          onClick={() => {
                            if (!activeClient.phone || !draftText.trim()) return;
                            window.location.href = whatsAppUrl(activeClient.phone, draftText);
                          }}
                          className="flex-1 rounded-2xl py-3 text-[14px] font-semibold disabled:opacity-40 active:opacity-80 transition-opacity"
                          style={{
                            background: "transparent",
                            border: "0.5px solid #25D366",
                            color: "#25D366",
                          }}
                        >
                          WhatsApp
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDraftEditing((v) => !v)}
                        className="w-full rounded-2xl py-3 text-[14px] font-semibold"
                        style={{
                          background: "rgba(255,255,255,0.06)",
                          color: "#9CA3AF",
                        }}
                      >
                        {draftEditing ? "Done editing" : "Edit"}
                      </button>
                      {!activeClient.phone && (
                        <p
                          className="mt-2 text-center text-[12px]"
                          style={{ color: "#6B7280" }}
                        >
                          No phone number on file for this client.
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

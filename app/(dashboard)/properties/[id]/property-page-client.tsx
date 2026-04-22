"use client";

import { BackButton } from "@/components/BackButton";
import { MatchClientsModal } from "@/components/MatchClientsModal";
import { PhotoCarousel } from "@/components/PhotoCarousel";
import { useToast } from "@/components/ToastProvider";
import type { MlsListingPayload } from "@/lib/simplyrets";
import { getSimplyRetsListingApiUrl } from "@/lib/simplyrets";
import { fmtMoney } from "@/lib/utils";
import { Bookmark, CalendarPlus, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function PropertyPageClient({
  mode,
  mlsId,
  internalProperty,
  returnTo,
}: {
  mode: "mls" | "internal";
  mlsId?: string;
  internalProperty?: Record<string, unknown>;
  returnTo: string | null;
}) {
  const toast = useToast();
  const router = useRouter();
  const [listing, setListing] = useState<MlsListingPayload | null>(null);
  const [loading, setLoading] = useState(mode === "mls");
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [matchOpen, setMatchOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [draftPreview, setDraftPreview] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);

  const backHref = returnTo && returnTo.startsWith("/") ? returnTo : "/mls";

  const checkSaved = useCallback(async (key: string) => {
    try {
      const res = await fetch("/api/saved-properties?idsOnly=1");
      if (!res.ok) return;
      const data = (await res.json()) as { mlsNumbers?: string[] };
      setSaved((data.mlsNumbers ?? []).includes(key));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (mode === "internal" && internalProperty) {
      const photosRaw = internalProperty.photos;
      const photos = Array.isArray(photosRaw)
        ? photosRaw.filter((p): p is string => typeof p === "string")
        : [];
      const mlsNum = String(internalProperty.mls_number ?? "");
      setListing({
        id: String(internalProperty.id ?? ""),
        address: String(internalProperty.address ?? ""),
        city: String(internalProperty.town ?? ""),
        price: Number(internalProperty.price ?? 0),
        beds: Number(internalProperty.beds ?? 0),
        baths: Number(internalProperty.baths ?? 0),
        sqft: Number(internalProperty.sqft ?? 0),
        description: String(internalProperty.description ?? ""),
        photos,
        status: String(internalProperty.status ?? ""),
        daysOnMarket: null,
        mlsNumber: mlsNum,
      });
      setLoading(false);
      if (mlsNum) void checkSaved(mlsNum);
      return;
    }

    if (mode !== "mls" || !mlsId) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setNotFound(false);
      setLoadError(null);
      try {
        const res = await fetch(
          `/api/properties/${encodeURIComponent(mlsId)}`,
          { credentials: "include" },
        );
        const data = (await res.json()) as {
          listing?: MlsListingPayload;
          error?: string;
          code?: string;
        };
        if (!res.ok) {
          if (res.status === 404 || data.code === "LISTING_GONE") {
            if (!cancelled) setNotFound(true);
            return;
          }
          const msg =
            data.error ??
            (res.status === 401
              ? "Please sign in again to view this listing."
              : "Could not load this listing.");
          if (!cancelled) setLoadError(msg);
          return;
        }
        if (!cancelled && data.listing) {
          setListing(data.listing);
          const key = data.listing.mlsNumber || data.listing.id;
          void checkSaved(key);
        }
      } catch {
        if (!cancelled) {
          setLoadError(
            "Network error. Check your connection and try again.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, mlsId, internalProperty, checkSaved]);

  async function toggleWatchlist() {
    if (!listing) return;
    const key = listing.mlsNumber || listing.id;
    if (saved) {
      const res = await fetch(
        `/api/saved-properties/${encodeURIComponent(key)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        toast.toast("Could not remove", "warn");
        return;
      }
      setSaved(false);
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
      setSaved(true);
      toast.toast("Saved to watchlist", "success");
    }
  }

  async function draftPropertyBlurb() {
    if (!listing) return;
    setDrafting(true);
    setDraftPreview(null);
    try {
      const res = await fetch("/api/ai/draft-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: "client",
          scenario: "MLS listing overview",
          propertyContext: `${listing.address}, ${listing.city}. ${fmtMoney(listing.price)}. ${listing.beds}bd/${listing.baths}ba. ${listing.sqft ? `${listing.sqft} sqft` : ""}. ${listing.description?.slice(0, 500) ?? ""}`,
          skipInsert: true,
        }),
      });
      const data = (await res.json()) as { draft?: string };
      setDraftPreview(data.draft?.trim() ?? null);
      if (data.draft) toast.toast("Draft ready below", "success");
    } catch {
      toast.toast("Draft failed", "warn");
    } finally {
      setDrafting(false);
    }
  }

  const fullAddress = useMemo(() => {
    if (!listing) return "";
    const parts = [
      listing.address,
      listing.city,
      listing.state,
      listing.postalCode,
    ].filter(Boolean);
    return parts.join(", ");
  }, [listing]);

  const mapSrc = useMemo(() => {
    if (!listing?.lat || !listing?.lng) return null;
    return `https://maps.google.com/maps?q=${listing.lat},${listing.lng}&z=16&output=embed`;
  }, [listing?.lat, listing?.lng]);

  const simplyRetsUrl = listing
    ? getSimplyRetsListingApiUrl(listing.mlsNumber || listing.id)
    : "";

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-text-dim">
        <Loader2 className="animate-spin" size={28} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <BackButton href={backHref} label="Back" className="mb-6" />
        <div className="rounded-[14px] border border-border-card bg-bg-card px-4 py-6 text-center">
          <p className="text-[15px] font-medium text-text-primary">
            Something went wrong
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-text-dim">
            {loadError}
          </p>
        </div>
      </div>
    );
  }

  if (notFound || !listing) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-text-dim">
        <p className="text-[15px] font-medium text-text-primary">
          Listing no longer available
        </p>
        <p className="mt-2 text-[13px] text-text-muted">
          This listing may have sold or been removed from the MLS feed.
        </p>
        <div className="mt-6">
          <BackButton href={backHref} label="Back to search" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-32 pt-6">
      <BackButton href={backHref} label="Back" className="mb-4" />

      {mode === "internal" && listing.mlsNumber ? (
        <Link
          href={`/properties/${encodeURIComponent(listing.mlsNumber)}`}
          className="mb-3 block rounded-[10px] border border-accent-blue/30 bg-accent-blue/10 px-3 py-2 text-center text-[12px] font-semibold text-accent-blue"
        >
          Open live MLS detail (refresh from feed) →
        </Link>
      ) : null}

      <PhotoCarousel photos={listing.photos ?? []} className="mb-4" />

      <h1 className="text-[22px] font-semibold leading-tight text-text-primary">
        {fmtMoney(listing.price)}
      </h1>
      <p className="mt-1 text-[15px] font-medium text-text-primary">
        {listing.address || "—"}
      </p>
      <p className="text-[13px] text-text-dim">
        {listing.city}
        {listing.state ? `, ${listing.state}` : ""}{" "}
        {listing.postalCode ?? ""}
        {listing.mlsNumber ? ` · MLS ${listing.mlsNumber}` : ""}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2 text-[13px]">
        <div className="rounded-[10px] border border-border-card bg-bg-card px-3 py-2">
          <div className="text-[10px] uppercase text-text-dim">Beds</div>
          <div className="font-medium text-text-primary">{listing.beds}</div>
        </div>
        <div className="rounded-[10px] border border-border-card bg-bg-card px-3 py-2">
          <div className="text-[10px] uppercase text-text-dim">Baths</div>
          <div className="font-medium text-text-primary">{listing.baths}</div>
        </div>
        <div className="rounded-[10px] border border-border-card bg-bg-card px-3 py-2">
          <div className="text-[10px] uppercase text-text-dim">Sq ft</div>
          <div className="font-medium text-text-primary">
            {listing.sqft ? listing.sqft.toLocaleString() : "—"}
          </div>
        </div>
        <div className="rounded-[10px] border border-border-card bg-bg-card px-3 py-2">
          <div className="text-[10px] uppercase text-text-dim">Lot</div>
          <div className="font-medium text-text-primary">
            {listing.lotSize != null ? listing.lotSize.toLocaleString() : "—"}
          </div>
        </div>
        <div className="rounded-[10px] border border-border-card bg-bg-card px-3 py-2">
          <div className="text-[10px] uppercase text-text-dim">Year built</div>
          <div className="font-medium text-text-primary">
            {listing.yearBuilt ?? "—"}
          </div>
        </div>
        <div className="rounded-[10px] border border-border-card bg-bg-card px-3 py-2">
          <div className="text-[10px] uppercase text-text-dim">Type</div>
          <div className="font-medium text-text-primary">
            {listing.propertyType ?? listing.propertySubType ?? "—"}
          </div>
        </div>
      </div>

      {listing.daysOnMarket != null ? (
        <p className="mt-3 text-[12px] text-text-muted">
          {listing.daysOnMarket} days on market · Status {listing.status}
        </p>
      ) : (
        <p className="mt-3 text-[12px] text-text-muted">Status {listing.status}</p>
      )}

      {listing.openHouses?.length ? (
        <div className="mt-4 rounded-[12px] border border-border-card bg-bg-card px-3 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-text-dim">
            Open houses
          </p>
          <ul className="mt-2 space-y-1 text-[13px] text-text-primary">
            {listing.openHouses.map((o, i) => (
              <li key={i}>
                {fmtDate(o.startTime)}
                {o.endTime ? ` – ${fmtDate(o.endTime)}` : ""}
                {o.appointmentOnly ? " (appointment)" : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {listing.description ? (
        <div className="mt-5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-text-dim">
            Description
          </p>
          <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-text-muted">
            {listing.description}
          </p>
        </div>
      ) : null}

      {listing.taxAnnualAmount != null || listing.taxYear != null ? (
        <div className="mt-5 rounded-[12px] border border-border-card bg-bg-card px-3 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-text-dim">
            Taxes
          </p>
          <p className="mt-1 text-[13px] text-text-primary">
            {listing.taxAnnualAmount != null
              ? `${fmtMoney(listing.taxAnnualAmount)}/yr`
              : "—"}
            {listing.taxYear != null ? ` (assessed ${listing.taxYear})` : ""}
          </p>
        </div>
      ) : null}

      {listing.listingAgent?.name || listing.listingOffice?.name ? (
        <div className="mt-5 rounded-[12px] border border-border-card bg-bg-card px-3 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-text-dim">
            Listing agent
          </p>
          <p className="mt-1 text-[13px] font-medium text-text-primary">
            {listing.listingAgent?.name ?? "—"}
          </p>
          {listing.listingAgent?.phone ? (
            <a
              href={`tel:${listing.listingAgent.phone}`}
              className="mt-1 block text-[13px] text-accent-blue"
            >
              {listing.listingAgent.phone}
            </a>
          ) : null}
          {listing.listingAgent?.email ? (
            <a
              href={`mailto:${listing.listingAgent.email}`}
              className="mt-1 block text-[13px] text-accent-blue"
            >
              {listing.listingAgent.email}
            </a>
          ) : null}
          {listing.listingOffice?.name ? (
            <p className="mt-2 text-[12px] text-text-dim">
              {listing.listingOffice.name}
              {listing.listingOffice.phone
                ? ` · ${listing.listingOffice.phone}`
                : ""}
            </p>
          ) : null}
        </div>
      ) : null}

      {mapSrc ? (
        <div className="mt-5 overflow-hidden rounded-[12px] border border-border-card">
          <p className="bg-bg-card px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-text-dim">
            Map
          </p>
          <iframe
            title="Map"
            src={mapSrc}
            className="h-56 w-full border-0 bg-bg-deep"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-2">
        {listing.externalUrl ? (
          <a
            href={listing.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] font-medium text-accent-blue"
          >
            External listing link →
          </a>
        ) : null}
        <a
          href={simplyRetsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[12px] font-medium text-text-dim"
        >
          Full MLS API record (SimplyRETS) →
        </a>
      </div>

      {draftPreview ? (
        <div className="mt-4 rounded-[12px] border border-border-card bg-bg-deep px-3 py-3">
          <p className="text-[11px] font-bold uppercase text-text-dim">
            AI draft
          </p>
          <p className="mt-2 text-[13px] text-text-primary">{draftPreview}</p>
        </div>
      ) : null}

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border-card bg-bg-deep/95 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMatchOpen(true)}
            className="flex-1 min-w-[120px] rounded-[10px] bg-accent-blue px-3 py-2.5 text-[12px] font-semibold text-white"
          >
            Match to Clients
          </button>
          <button
            type="button"
            onClick={() => void toggleWatchlist()}
            className={`flex-1 min-w-[100px] rounded-[10px] px-3 py-2.5 text-[12px] font-semibold ${
              saved
                ? "border border-accent-blue/40 bg-accent-blue/15 text-accent-blue"
                : "border border-border-card bg-bg-card text-text-primary"
            }`}
          >
            <Bookmark
              size={14}
              className="mr-1 inline-block align-text-bottom"
              fill={saved ? "currentColor" : "none"}
            />
            Watchlist
          </button>
          <button
            type="button"
            disabled={drafting}
            onClick={() => void draftPropertyBlurb()}
            className="flex-1 min-w-[120px] rounded-[10px] border border-border-card bg-bg-card px-3 py-2.5 text-[12px] font-semibold text-text-primary disabled:opacity-50"
          >
            <Sparkles size={14} className="mr-1 inline-block align-text-bottom" />
            {drafting ? "…" : "AI draft"}
          </button>
          <button
            type="button"
            onClick={() =>
              router.push(
                `/showings?new=1&address=${encodeURIComponent(fullAddress)}`,
              )
            }
            className="flex-1 min-w-[120px] rounded-[10px] border border-border-card bg-bg-card px-3 py-2.5 text-[12px] font-semibold text-text-primary"
          >
            <CalendarPlus size={14} className="mr-1 inline-block align-text-bottom" />
            Showing
          </button>
        </div>
        <div className="mx-auto mt-2 max-w-lg text-center">
          <Link
            href="/properties/saved"
            className="text-[11px] text-text-dim"
          >
            View watchlist
          </Link>
        </div>
      </div>

      <MatchClientsModal
        open={matchOpen}
        onClose={() => setMatchOpen(false)}
        listing={listing}
      />
    </div>
  );
}

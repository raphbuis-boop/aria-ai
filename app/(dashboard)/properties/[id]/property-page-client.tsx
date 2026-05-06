"use client";

import { BackButton } from "@/components/BackButton";
import { IdxComplianceNotice } from "@/components/IdxComplianceNotice";
import { ListingInquiryForm } from "@/components/ListingInquiryForm";
import { MatchClientsModal } from "@/components/MatchClientsModal";
import { PhotoCarousel } from "@/components/PhotoCarousel";
import { useToast } from "@/components/ToastProvider";
import type { MlsListingPayload } from "@/lib/simplyrets";
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
  viewerContext = "agent",
}: {
  mode: "mls" | "internal";
  mlsId?: string;
  internalProperty?: Record<string, unknown>;
  returnTo: string | null;
  /** Public IDX viewers: no CRM tools or watchlist. */
  viewerContext?: "agent" | "public";
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
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [inquiryIntent, setInquiryIntent] = useState<"info" | "showing">("info");

  const backHref =
    returnTo && returnTo.startsWith("/")
      ? returnTo
      : viewerContext === "public"
        ? "/property-search"
        : "/listings";

  const checkSaved = useCallback(async (key: string) => {
    if (viewerContext === "public") return;
    try {
      const res = await fetch("/api/saved-properties?idsOnly=1");
      if (!res.ok) return;
      const data = (await res.json()) as { mlsNumbers?: string[] };
      setSaved((data.mlsNumbers ?? []).includes(key));
    } catch {
      /* ignore */
    }
  }, [viewerContext]);

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

    if (mode !== "mls" || !mlsId?.trim()) return;
    let cancelled = false;
    const idForApi = encodeURIComponent(mlsId.trim());
    void (async () => {
      setLoading(true);
      setNotFound(false);
      setLoadError(null);
      try {
        const res = await fetch(`/api/properties/${idForApi}`, {
          credentials: "include",
          cache: "no-store",
        });
        let data: {
          listing?: MlsListingPayload;
          error?: string;
          code?: string;
        };
        try {
          data = (await res.json()) as typeof data;
        } catch {
          if (!cancelled) {
            setLoadError("Invalid response from listing service.");
          }
          return;
        }
        if (!res.ok) {
          if (res.status === 404 || data.code === "LISTING_GONE") {
            if (!cancelled) setNotFound(true);
            return;
          }
          const msg =
            data.error ?? "Could not load this listing.";
          if (!cancelled) setLoadError(msg);
          return;
        }
        if (!data.listing) {
          if (!cancelled) {
            setLoadError(
              data.error ?? "Listing data was unavailable. Please try again.",
            );
          }
          return;
        }
        if (!cancelled) {
          setListing(data.listing);
          if (viewerContext !== "public") {
            const key = data.listing.mlsNumber || data.listing.id;
            void checkSaved(key);
          }
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
  }, [mode, mlsId, internalProperty, checkSaved, viewerContext]);

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

  if (loading) {
    if (viewerContext === "public") {
      return (
        <div className="mx-auto max-w-lg px-4 pb-16 pt-6">
          <BackButton href={backHref} label="Back" className="mb-4" />
          <IdxComplianceNotice logoSize="prominent" />
          <div className="mt-10 flex justify-center text-text-dim">
            <Loader2 className="animate-spin" size={28} />
          </div>
        </div>
      );
    }
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
        {viewerContext === "public" ? (
          <div className="mb-4">
            <IdxComplianceNotice logoSize="prominent" />
          </div>
        ) : null}
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
        <BackButton href={backHref} label="Back to search" className="mb-6 inline-block" />
        {viewerContext === "public" ? (
          <div className="mb-4 text-left">
            <IdxComplianceNotice logoSize="prominent" />
          </div>
        ) : null}
        <p className="text-[15px] font-medium text-text-primary">
          Listing no longer available
        </p>
        <p className="mt-2 text-[13px] text-text-muted">
          This listing may have sold or been removed from the listing feed.
        </p>
      </div>
    );
  }

  return (
    <div
      className="mx-auto max-w-lg px-4 pt-6 pb-32"
    >
      <BackButton href={backHref} label="Back" className="mb-4" />

      <div className="mb-4">
        <IdxComplianceNotice
          brokerageName={listing.listingFirm?.name ?? null}
          logoSize={viewerContext === "public" ? "prominent" : "default"}
        />
      </div>

      {mode === "internal" && listing.mlsNumber ? (
        <Link
          href={`/properties/${encodeURIComponent(listing.mlsNumber)}`}
          className="mb-3 block rounded-[10px] border border-accent-blue/30 bg-accent-blue/10 px-3 py-2 text-center text-[12px] font-semibold text-accent-blue"
        >
          Open live listing detail (refresh from feed) →
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
        {listing.mlsNumber ? ` · Listing #${listing.mlsNumber}` : ""}
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

      {listing.listingRepresentative?.name || listing.listingFirm?.name ? (
        <div className="mt-5 rounded-[12px] border border-border-card bg-bg-card px-3 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-text-dim">
            Listed with
          </p>
          <p className="mt-1 text-[13px] font-medium text-text-primary">
            {listing.listingRepresentative?.name ?? "—"}
          </p>
          {listing.listingRepresentative?.phone ? (
            <a
              href={`tel:${listing.listingRepresentative.phone}`}
              className="mt-1 block text-[13px] text-accent-blue"
            >
              {listing.listingRepresentative.phone}
            </a>
          ) : null}
          {listing.listingRepresentative?.email ? (
            <a
              href={`mailto:${listing.listingRepresentative.email}`}
              className="mt-1 block text-[13px] text-accent-blue"
            >
              {listing.listingRepresentative.email}
            </a>
          ) : null}
          {listing.listingFirm?.name ? (
            <p className="mt-2 text-[12px] text-text-dim">
              {listing.listingFirm.name}
              {listing.listingFirm.phone
                ? ` · ${listing.listingFirm.phone}`
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

      {listing.externalUrl ? (
        <div className="mt-4">
          <a
            href={listing.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] font-medium text-accent-blue"
          >
            External listing link →
          </a>
        </div>
      ) : null}

      {draftPreview ? (
        <div className="mt-4 rounded-[12px] border border-border-card bg-bg-deep px-3 py-3">
          <p className="text-[11px] font-bold uppercase text-text-dim">
            AI draft
          </p>
          <p className="mt-2 text-[13px] text-text-primary">{draftPreview}</p>
        </div>
      ) : null}

      {viewerContext === "agent" ? (
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
      ) : (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border-card bg-bg-deep/95 px-4 py-3 backdrop-blur-md">
          <div className="mx-auto flex max-w-lg gap-2">
            <button
              type="button"
              onClick={() => { setInquiryIntent("showing"); setInquiryOpen(true); }}
              className="flex-1 rounded-[10px] bg-accent-blue px-3 py-2.5 text-[13px] font-semibold text-white"
            >
              Request Showing
            </button>
            <button
              type="button"
              onClick={() => { setInquiryIntent("info"); setInquiryOpen(true); }}
              className="flex-1 rounded-[10px] border border-border-card bg-bg-card px-3 py-2.5 text-[13px] font-semibold text-text-primary"
            >
              Contact Agent
            </button>
          </div>
        </div>
      )}

      {viewerContext === "agent" ? (
        <MatchClientsModal
          open={matchOpen}
          onClose={() => setMatchOpen(false)}
          listing={listing}
        />
      ) : null}

      {viewerContext === "public" && inquiryOpen ? (
        <ListingInquiryForm
          modal
          initialIntent={inquiryIntent}
          listingId={listing.mlsNumber || listing.id}
          listingAddress={fullAddress}
          mlsNumber={listing.mlsNumber ?? null}
          listingPrice={listing.price}
          onClose={() => setInquiryOpen(false)}
        />
      ) : null}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarPlus, ChevronRight, Home as HomeIcon, Share2, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { IdxComplianceNotice } from "@/components/IdxComplianceNotice";
import { Toaster, toast } from "@/components/ui/sonner";
import { fmtMoney } from "@/lib/utils";
import { humanizeMatchReasons, titleCasePropertyType } from "@/lib/match-language";

type Match = {
  clientId: string;
  clientName: string;
  score: number;
  reasons: string[];
};

const STATUS_LABEL: Record<string, string> = {
  available: "Available",
  pending: "Pending",
  sold: "Sold",
  off_market: "Off market",
  archived: "Archived",
};

function triggerHaptic() {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(10);
  } catch {
    /* never break */
  }
}

function Fact({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="font-display text-caption text-muted-foreground/60 mb-0.5">{label}</p>
      <p className="font-display text-body text-foreground">{value}</p>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-2 py-3 text-center">
      <p className="font-heading text-[19px] leading-none text-foreground">{value}</p>
      <p className="font-display text-[11px] text-muted-foreground/70 mt-1">{label}</p>
    </div>
  );
}

export function InternalPropertyDetail({
  property,
  matches,
  market,
  returnTo,
}: {
  property: Record<string, unknown>;
  matches: Match[];
  market: Record<string, unknown> | null;
  returnTo: string | null;
}) {
  const router = useRouter();

  const address = (property.address as string | null) ?? "Property";
  const town = (property.town as string | null) ?? null;
  const price = (property.price as number | null) ?? null;
  const beds = (property.beds as number | null) ?? null;
  const baths = (property.baths as number | null) ?? null;
  const sqft = (property.sqft as number | null) ?? null;
  const status = (property.status as string | null) ?? null;
  const mlsNumber = (property.mls_number as string | null) ?? null;
  const propertyType = (property.property_type as string | null) ?? null;
  const description = (property.description as string | null) ?? null;
  const photosRaw = property.photos as unknown;
  const allPhotos = Array.isArray(photosRaw) ? photosRaw.filter((p): p is string => typeof p === "string") : [];

  const commission = price != null ? Math.round(price * 0.025) : null;
  const pricePerSqft = price != null && sqft ? Math.round(price / sqft) : null;
  const fullAddress = `${address}${town ? `, ${town}` : ""}`;
  const mktAvg = (market?.avg_sale_price as number | null) ?? null;
  const mktDom = (market?.days_on_market as number | null) ?? null;
  const mktYoY = (market?.price_change_pct as number | null) ?? null;

  const [activePhoto, setActivePhoto] = useState(0);
  const [failedPhotos, setFailedPhotos] = useState<Set<string>>(new Set());
  const photos = allPhotos.filter((p) => !failedPhotos.has(p));
  const markFailed = (p: string) =>
    setFailedPhotos((prev) => (prev.has(p) ? prev : new Set(prev).add(p)));

  const handleShare = async () => {
    triggerHaptic();
    const shareData = {
      title: address,
      text: `${address}${town ? `, ${town}` : ""} — ${fmtMoney(price)}`,
      url: typeof window !== "undefined" ? window.location.href : "",
    };
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareData.url);
        toast.success("Link copied");
      }
    } catch {
      /* user cancelled share sheet — not an error */
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-5 pt-6 pb-32 sm:px-8 sm:pt-10">
        <div className="mb-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => (returnTo ? router.push(returnTo) : router.back())}
            aria-label="Back"
            className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary transition-colors"
          >
            <ArrowLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={handleShare}
            aria-label="Share"
            className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary transition-colors"
          >
            <Share2 className="size-4" />
          </button>
        </div>

        {/* Photo gallery */}
        <div className="mb-6">
          <div className="aspect-[4/3] w-full rounded-2xl bg-secondary overflow-hidden flex items-center justify-center">
            {photos.length > 0 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photos[Math.min(activePhoto, photos.length - 1)]}
                alt={address}
                className="size-full object-cover"
                onError={() => markFailed(photos[Math.min(activePhoto, photos.length - 1)])}
              />
            ) : (
              <HomeIcon className="size-10 text-muted-foreground/40" />
            )}
          </div>
          {photos.length > 1 && (
            <div className="flex gap-2 mt-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {photos.map((p, i) => (
                <button
                  key={p + i}
                  type="button"
                  onClick={() => setActivePhoto(i)}
                  className={`size-16 shrink-0 rounded-xl overflow-hidden border-2 transition-colors ${
                    i === activePhoto ? "border-primary" : "border-transparent"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p} alt="" className="size-full object-cover" onError={() => markFailed(p)} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Header / facts */}
        <header className="mb-5">
          <h1 className="font-heading text-[28px] leading-tight text-foreground mb-1">{address}</h1>
          <p className="font-display text-body text-muted-foreground mb-4">{town ?? "—"}</p>
          <div className="flex items-center gap-3 flex-wrap">
            <p className="font-heading text-[34px] leading-none text-primary">{fmtMoney(price)}</p>
            {status && (
              <span className="rounded-full bg-secondary px-3 py-1 font-display text-caption font-semibold text-foreground">
                {STATUS_LABEL[status] ?? status}
              </span>
            )}
          </div>
          {commission != null && (
            <div className="mt-3 flex items-center gap-2">
              <Sparkles className="size-3.5 text-primary" />
              <p className="font-display text-body text-muted-foreground">
                <span className="font-semibold text-primary">~{fmtMoney(commission)}</span> your commission
                {matches.length > 0 && (
                  <> · fits <span className="font-semibold text-foreground">{matches.length}</span> client{matches.length === 1 ? "" : "s"}</>
                )}
              </p>
            </div>
          )}
        </header>

        {/* Quick stats */}
        <section className="mb-8 grid grid-cols-4 gap-2">
          <StatTile label="Beds" value={beds != null ? String(beds) : "—"} />
          <StatTile label="Baths" value={baths != null ? String(baths) : "—"} />
          <StatTile label="Sq Ft" value={sqft ? sqft.toLocaleString() : "—"} />
          <StatTile label="$/sq ft" value={pricePerSqft ? `$${pricePerSqft.toLocaleString()}` : "—"} />
        </section>

        {/* Aria match-fit */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="size-3.5 text-primary" />
            <p className="font-display text-caption uppercase tracking-[0.08em] text-primary">Aria match</p>
          </div>
          {matches.length === 0 ? (
            <Card className="px-6 py-6">
              <p className="font-display text-body-lg text-muted-foreground">
                No clients match this listing yet — matching runs as client criteria and new listings come in.
              </p>
            </Card>
          ) : (
            <Card className="divide-y divide-border overflow-hidden">
              <div className="px-5 py-4 bg-secondary/50">
                <p className="font-heading text-[17px] text-foreground">
                  Fits {matches.length} client{matches.length === 1 ? "" : "s"} in your book
                </p>
              </div>
              {matches.map((m) => (
                <button
                  key={m.clientId}
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    router.push(`/clients/${m.clientId}`);
                  }}
                  className="w-full text-left px-5 py-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-display text-body-lg font-semibold text-foreground">{m.clientName}</p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="font-display text-body font-semibold text-primary">{m.score}%</span>
                      <ChevronRight className="size-4 text-muted-foreground/50" />
                    </div>
                  </div>
                  {m.reasons.length > 0 && (
                    <p className="font-display text-caption text-muted-foreground mt-1">
                      {humanizeMatchReasons(m.clientName, m.reasons, { town, price, beds, baths, propertyType })}
                    </p>
                  )}
                </button>
              ))}
            </Card>
          )}
        </section>

        {/* Key facts */}
        <section className="mb-8">
          <p className="font-display text-section text-muted-foreground mb-3">Details</p>
          <Card className="px-6 py-5 grid grid-cols-2 gap-x-6 gap-y-4">
            <Fact label="Beds / baths" value={beds != null || baths != null ? `${beds ?? "—"} bed · ${baths ?? "—"} bath` : null} />
            <Fact label="Square feet" value={sqft ? sqft.toLocaleString() : null} />
            <Fact label="Price / sq ft" value={pricePerSqft ? `$${pricePerSqft.toLocaleString()}` : null} />
            <Fact label="Property type" value={titleCasePropertyType(propertyType)} />
            <Fact label="Status" value={status ? (STATUS_LABEL[status] ?? status) : null} />
          </Card>
          {description && (
            <Card className="px-6 py-5 mt-3">
              <p className="font-display text-body text-muted-foreground leading-relaxed">{description}</p>
            </Card>
          )}
          {mlsNumber && (
            <p className="font-display text-[11px] text-muted-foreground/50 mt-3">
              {mlsNumber.replace(/^mls-?/i, "MLS #")}
            </p>
          )}
        </section>

        {/* Market snapshot */}
        {(mktAvg != null || mktDom != null) && (
          <section className="mb-8">
            <p className="font-display text-section text-muted-foreground mb-3">Market{town ? ` — ${town}` : ""}</p>
            <Card className="px-6 py-5 grid grid-cols-3 gap-4">
              <div>
                <p className="font-heading text-[19px] leading-none text-foreground">{mktAvg != null ? fmtMoney(mktAvg) : "—"}</p>
                <p className="font-display text-[11px] text-muted-foreground/70 mt-1">Avg sale</p>
              </div>
              <div>
                <p className="font-heading text-[19px] leading-none text-foreground">{mktDom != null ? mktDom : "—"}</p>
                <p className="font-display text-[11px] text-muted-foreground/70 mt-1">Days on market</p>
              </div>
              <div>
                <p
                  className="font-heading text-[19px] leading-none flex items-center gap-1"
                  style={mktYoY != null && mktYoY < 0 ? { color: "var(--hot)" } : { color: "var(--primary)" }}
                >
                  {mktYoY != null ? (mktYoY < 0 ? <TrendingDown className="size-4" /> : <TrendingUp className="size-4" />) : null}
                  {mktYoY != null ? `${mktYoY > 0 ? "+" : ""}${mktYoY}%` : "—"}
                </p>
                <p className="font-display text-[11px] text-muted-foreground/70 mt-1">Price YoY</p>
              </div>
            </Card>
          </section>
        )}

        {/* Book a showing */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic();
            router.push(`/showings?new=1&address=${encodeURIComponent(fullAddress)}`);
          }}
          className="mb-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 font-display text-body-lg font-semibold text-primary-foreground transition-transform active:scale-[0.98]"
        >
          <CalendarPlus className="size-4" />
          Book a showing
        </button>

        <IdxComplianceNotice compact />
      </div>

      <Toaster />
    </div>
  );
}

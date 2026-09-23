"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarPlus, Check, Home as HomeIcon, Send, Share2, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/Section";
import { SendPropertySheet, type SendTarget } from "@/components/aria/SendPropertySheet";
import { createClient } from "@/lib/supabase/client";
import { ARIA_RECOMMENDED_REASON, AGENT_SENT_REASON } from "@/lib/sms/recommend-reasons";
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
  textableClients,
  market,
  returnTo,
}: {
  property: Record<string, unknown>;
  matches: Match[];
  textableClients: SendTarget[];
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

  const [sendTo, setSendTo] = useState<SendTarget | null>(null);
  const [picking, setPicking] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(status);
  const textable = new Set(textableClients.map((c) => c.id));

  async function changeStatus(next: string) {
    const prev = currentStatus;
    setCurrentStatus(next);
    const { error } = await createClient().from("properties").update({ status: next }).eq("id", String(property.id));
    if (error) {
      setCurrentStatus(prev);
      toast.error(error.message);
    } else {
      toast.success(next === "available" ? "Aria can recommend this home" : "Aria won't recommend this home");
      router.refresh();
    }
  }
  const pricePerSqft = price != null && sqft ? Math.round(price / sqft) : null;
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
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-heading text-[34px] leading-none text-primary">{fmtMoney(price)}</p>
            <select
              value={currentStatus ?? ""}
              onChange={(e) => void changeStatus(e.target.value)}
              aria-label="Listing status"
              className="rounded-full border border-border bg-secondary px-3 py-1 font-display text-caption font-semibold text-foreground outline-none"
            >
              {currentStatus && !STATUS_LABEL[currentStatus] ? <option value={currentStatus}>{currentStatus}</option> : null}
              {Object.entries(STATUS_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <p className="mt-2 font-display text-caption text-muted-foreground">
            {currentStatus === "available"
              ? "Available — Aria can recommend it to matching leads over text."
              : "Not available — Aria won't recommend it."}
          </p>
        </header>

        {/* Quick stats */}
        <section className="mb-8 grid grid-cols-4 gap-2">
          <StatTile label="Beds" value={beds != null ? String(beds) : "—"} />
          <StatTile label="Baths" value={baths != null ? String(baths) : "—"} />
          <StatTile label="Sq Ft" value={sqft ? sqft.toLocaleString() : "—"} />
          <StatTile label="$/sq ft" value={pricePerSqft ? `$${pricePerSqft.toLocaleString()}` : "—"} />
        </section>

        {/* Client matches */}
        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-display text-section uppercase text-muted-foreground">Client matches</h2>
            {textableClients.length ? (
              <button type="button" onClick={() => setPicking((v) => !v)} className="font-display text-caption font-semibold text-primary">
                {picking ? "Cancel" : "Send to a client →"}
              </button>
            ) : null}
          </div>
          {picking ? (
            <Card className="mb-3 max-h-72 divide-y divide-border overflow-y-auto">
              {textableClients.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setPicking(false);
                    setSendTo(c);
                  }}
                  className="flex w-full items-center justify-between px-5 py-3 text-left font-display text-body text-foreground hover:bg-secondary/50"
                >
                  {c.name}
                  <Send className="size-3.5 text-muted-foreground" />
                </button>
              ))}
            </Card>
          ) : null}
          {matches.length === 0 ? (
            <Card className="px-6 py-6">
              <p className="font-display text-body text-muted-foreground">
                No clients match this home yet. Matching runs as client preferences and listings change.
              </p>
            </Card>
          ) : (
            <Card className="divide-y divide-border overflow-hidden">
              {matches.map((m) => {
                const sent = m.reasons.includes(ARIA_RECOMMENDED_REASON) ? "aria" : m.reasons.includes(AGENT_SENT_REASON) ? "agent" : null;
                return (
                  <div key={m.clientId} className="flex items-center gap-3 px-5 py-4">
                    <Link href={`/clients/${m.clientId}`} className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 font-display text-body-lg font-semibold text-foreground">
                        <span className="truncate">{m.clientName}</span>
                        <span className="shrink-0 font-display text-body text-primary">{m.score}%</span>
                      </p>
                      {sent ? (
                        <Pill tone="primary" className="mt-1">
                          {sent === "aria" ? <Sparkles className="size-3" /> : <Check className="size-3" />}
                          {sent === "aria" ? "Sent by Aria" : "Sent"}
                        </Pill>
                      ) : m.reasons.length > 0 ? (
                        <p className="mt-1 font-display text-caption text-muted-foreground">
                          {humanizeMatchReasons(m.clientName, m.reasons, { town, price, beds, baths, propertyType })}
                        </p>
                      ) : null}
                    </Link>
                    {textable.has(m.clientId) ? (
                      <Button
                        size="sm"
                        variant={sent ? "outline" : "default"}
                        onClick={() => setSendTo({ id: m.clientId, name: m.clientName })}
                        className="h-9 shrink-0 rounded-full px-3"
                      >
                        <Send className="size-3.5" /> {sent ? "Resend" : "Send"}
                      </Button>
                    ) : null}
                  </div>
                );
              })}
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
            router.push(`/showings?new=1&address=${encodeURIComponent(town && !address.includes(town) ? `${address}, ${town}` : address)}`);
          }}
          className="mb-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 font-display text-body-lg font-semibold text-primary-foreground transition-transform active:scale-[0.98]"
        >
          <CalendarPlus className="size-4" />
          Book a showing
        </button>

        <IdxComplianceNotice compact />
      </div>

      <SendPropertySheet
        property={sendTo ? { id: String(property.id), address, town, price, beds, baths } : null}
        target={sendTo}
        onClose={() => setSendTo(null)}
      />
      <Toaster />
    </div>
  );
}

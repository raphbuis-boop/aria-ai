"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  FileText,
  Home as HomeIcon,
  Mail,
  MessageSquare,
  Phone,
  Sparkles,
} from "lucide-react";
import type { TodayItem } from "@/lib/today-items";
import { heatFromScore } from "@/lib/today-items";
import { statusLabel, type ClientBrief } from "@/lib/client-brief";
import { DraftSheet } from "@/components/DraftSheet";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Toaster, toast } from "@/components/ui/sonner";
import { fmtMoney, relTime } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────

type Activity = {
  id: string;
  type: string | null;
  direction: string | null;
  body: string | null;
  ai_draft: boolean;
  approved: boolean;
  sent: boolean;
  created_at: string;
};

type MatchedProperty = {
  id: string;
  address: string | null;
  price: number | null;
  beds: number | null;
  baths: number | null;
  town: string | null;
  status: string | null;
  score: number;
};

type ClientDetailProps = {
  client: Record<string, unknown>;
  activities: Activity[];
  draftCount: number;
  lastDraftBody: string | null;
  recentMatchCount: number;
  matchedProperties: MatchedProperty[];
  brief: ClientBrief;
};

// ── Helpers ───────────────────────────────────────────────────────────────

function firstNameOf(name: string): string {
  return name.split(" ")[0];
}

function triggerHaptic() {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(10);
  } catch {
    /* never break */
  }
}

const HEAT_DOT_COLOR: Record<"hot" | "warm", { fill: string; ring: string; label: string }> = {
  hot: { fill: "var(--hot)", ring: "rgba(184, 75, 51, 0.15)", label: "Hot" },
  warm: { fill: "var(--warm)", ring: "rgba(184, 132, 46, 0.15)", label: "Warm" },
};

const TYPE_META: Record<string, { icon: typeof MessageSquare; label: string }> = {
  text: { icon: MessageSquare, label: "Text" },
  call: { icon: Phone, label: "Call" },
  email: { icon: Mail, label: "Email" },
  showing: { icon: HomeIcon, label: "Showing" },
  note: { icon: FileText, label: "Note" },
  offer: { icon: FileText, label: "Offer" },
};

function typeMeta(type: string | null) {
  return TYPE_META[type ?? ""] ?? { icon: FileText, label: "Activity" };
}

// ── Header ────────────────────────────────────────────────────────────────

function ClientHeader({
  name,
  status,
  leadHeat,
  brief,
}: {
  name: string;
  status: string | null;
  leadHeat: "hot" | "warm" | "cold";
  brief: ClientBrief;
}) {
  const heat = leadHeat !== "cold" ? HEAT_DOT_COLOR[leadHeat] : null;

  return (
    <header className="mb-8">
      <h1 className="font-heading text-[34px] leading-tight text-foreground mb-3">{name}</h1>

      <div className="flex items-center gap-2 flex-wrap mb-6">
        <span className="rounded-full bg-secondary px-3 py-1 font-display text-caption font-semibold text-foreground">
          {statusLabel(status)}
        </span>
        {heat && (
          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-display text-caption font-semibold" style={{ color: heat.fill }}>
            <span className="size-2 rounded-full" style={{ background: heat.fill, boxShadow: `0 0 0 3px ${heat.ring}` }} />
            {heat.label} lead
          </span>
        )}
      </div>

      {brief.dealValue ? (
        <div>
          <p className="font-display text-caption uppercase tracking-[0.08em] text-muted-foreground mb-1">
            {brief.dealValueLabel}
          </p>
          <p className="font-heading text-[40px] leading-none text-primary">{fmtMoney(brief.dealValue)}</p>
          {brief.commissionEst && (
            <p className="font-display text-body text-muted-foreground mt-1.5">
              ~{fmtMoney(brief.commissionEst)} projected commission
            </p>
          )}
        </div>
      ) : (
        <p className="font-display text-body text-muted-foreground/70">No deal value on file yet.</p>
      )}
    </header>
  );
}

// ── Timeline row ──────────────────────────────────────────────────────────

function TimelineRow({ a }: { a: Activity }) {
  const { icon: Icon, label } = typeMeta(a.type);
  const isDraftPending = a.ai_draft && !a.approved && !a.sent;

  return (
    <div className="flex gap-3.5 px-5 py-4">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary">
        <Icon className="size-3.5 text-muted-foreground" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="font-display text-body font-semibold text-foreground">
            {label}
            {isDraftPending && (
              <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 font-display text-[11px] font-semibold text-primary">
                Draft pending
              </span>
            )}
          </p>
          <span className="font-display text-caption text-muted-foreground/60 shrink-0 whitespace-nowrap">
            {relTime(a.created_at)}
          </span>
        </div>
        {a.body && (
          <p className="font-display text-body text-muted-foreground mt-1 leading-relaxed">{a.body}</p>
        )}
      </div>
    </div>
  );
}

// ── Key facts ─────────────────────────────────────────────────────────────

function Fact({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="font-display text-caption text-muted-foreground/60 mb-0.5">{label}</p>
      <p className="font-display text-body text-foreground">{value}</p>
    </div>
  );
}

function fmtBudget(min: unknown, max: unknown): string | null {
  const lo = typeof min === "number" ? min : null;
  const hi = typeof max === "number" ? max : null;
  if (!lo && !hi) return null;
  if (lo && hi) return `${fmtMoney(lo)} – ${fmtMoney(hi)}`;
  if (hi) return `Up to ${fmtMoney(hi)}`;
  return `${fmtMoney(lo)}+`;
}

// ── Root ──────────────────────────────────────────────────────────────────

export function ClientDetail({ client, activities, brief }: ClientDetailProps) {
  const router = useRouter();
  const [activeDraftItem, setActiveDraftItem] = useState<TodayItem | null>(null);
  const [prefetchedDraft, setPrefetchedDraft] = useState<string | undefined>(undefined);

  const id = String(client.id);
  const name = String(client.name);
  const phone = (client.phone as string | null) ?? null;
  const town = (client.town as string | null) ?? null;
  const status = (client.status as string | null) ?? null;
  const leadScore = (client.lead_score as number | null) ?? null;
  const leadHeat = heatFromScore(leadScore);

  // Compatible with DraftSheet, which only reads id/clientId/clientName/clientPhone/reason/context.
  const draftItem = useMemo<TodayItem>(
    () => ({
      id: `client-${id}`,
      clientId: id,
      clientName: name,
      clientPhone: phone,
      clientTown: town,
      clientBudgetMax: (client.budget_max as number | null) ?? null,
      clientStatus: status,
      reason: brief.briefing,
      context: town,
      actionLabel: brief.primaryActionLabel,
      actionType: "text",
      navigateTo: null,
      urgencyRank: 1,
      leadScore,
      leadHeat,
      activitySignal: null,
      commissionEst: brief.commissionEst,
    }),
    [id, name, phone, town, status, leadScore, leadHeat, client.budget_max, brief],
  );

  // Pre-fetch the AI draft once on mount so the sheet opens instantly.
  useEffect(() => {
    if (brief.primaryActionType !== "text" || !phone) return;
    fetch("/api/ai/draft-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientName: name,
        scenario: brief.briefing,
        context: town ?? "",
        clientId: id,
        skipInsert: true,
      }),
    })
      .then((r) => r.json())
      .then((data: { draft?: string }) => setPrefetchedDraft(data.draft ?? ""))
      .catch(() => setPrefetchedDraft(""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // stable on mount — server-rendered brief

  const handlePrimaryAction = useCallback(() => {
    triggerHaptic();
    if (brief.primaryActionType === "call" && phone) {
      window.location.href = `tel:${phone.replace(/\D/g, "")}`;
      return;
    }
    setActiveDraftItem(draftItem);
  }, [brief.primaryActionType, phone, draftItem]);

  const handleSent = useCallback(() => {
    setActiveDraftItem(null);
    toast.success("Message sent");
  }, []);

  const budget = fmtBudget(client.budget_min, client.budget_max);
  const towns = Array.isArray(client.preferred_towns) ? (client.preferred_towns as string[]).join(", ") : town;
  const beds = client.beds_wanted != null ? String(client.beds_wanted) : null;
  const baths = client.baths_wanted != null ? String(client.baths_wanted) : null;
  const bedsBaths = beds || baths ? `${beds ?? "—"} bed · ${baths ?? "—"} bath` : null;
  const source = (client.source as string | null) ?? null;

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-5 pt-6 pb-32 sm:px-8 sm:pt-10">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="mb-6 flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary transition-colors"
        >
          <ArrowLeft className="size-4" />
        </button>

        <ClientHeader name={name} status={status} leadHeat={leadHeat} brief={brief} />

        {/* Aria briefing */}
        <Card className="mb-6 px-6 py-6">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="size-3.5 text-primary" />
            <p className="font-display text-caption uppercase tracking-[0.08em] text-primary">Aria briefing</p>
          </div>
          <p className="font-heading text-[19px] leading-snug text-foreground">{brief.briefing}</p>
        </Card>

        {/* Primary action — the money action */}
        <Button
          onClick={handlePrimaryAction}
          className="w-full h-12 rounded-xl mb-12 text-body-lg font-semibold"
        >
          {brief.primaryActionLabel}
        </Button>

        {/* Timeline */}
        <section className="mb-12">
          <p className="font-display text-section text-muted-foreground mb-3">Timeline</p>
          {activities.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border px-6 py-8 text-center">
              <p className="font-display text-body text-muted-foreground/70">
                Nothing logged yet for {firstNameOf(name)}.
              </p>
            </div>
          ) : (
            <Card className="divide-y divide-border overflow-hidden">
              {activities.map((a) => (
                <TimelineRow key={a.id} a={a} />
              ))}
            </Card>
          )}
        </section>

        {/* Key facts — secondary, reference only */}
        <section>
          <p className="font-display text-section text-muted-foreground mb-3">Details</p>
          <Card className="px-6 py-5 grid grid-cols-2 gap-x-6 gap-y-4">
            <Fact label="Budget" value={budget} />
            <Fact label="Preferred towns" value={towns} />
            <Fact label="Beds / baths" value={bedsBaths} />
            <Fact label="Source" value={source} />
          </Card>
        </section>
      </div>

      <DraftSheet
        item={activeDraftItem}
        prefetchedDraft={activeDraftItem ? prefetchedDraft : undefined}
        onClose={() => setActiveDraftItem(null)}
        onSent={handleSent}
      />
      <Toaster />
    </div>
  );
}

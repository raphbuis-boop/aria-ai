"use client";

import { AIDraftModal } from "@/components/AIDraftModal";
import { useToast } from "@/components/ToastProvider";
import { differenceInCalendarDays } from "date-fns";
import { ShieldAlert, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

export type ClientRow = {
  id: string;
  name: string;
  town: string | null;
  status: string | null;
  lead_score: number | null;
  budget_min: number | null;
  budget_max: number | null;
  phone: string | null;
  client_role?: string | null;
};

type TxRow = {
  id: string;
  client_id: string;
  address: string | null;
  closing_date: string | null;
  status: string | null;
};

type BbaAlert = {
  clientId: string;
  clientName: string;
  address: string | null;
  showingDate: string | null;
};

type Initial = {
  clients: ClientRow[];
  transactions: TxRow[];
  newMatches: number;
  bbaAlerts: BbaAlert[];
};

function isHot(c: ClientRow) {
  return c.status === "showing" || c.status === "hot" || (c.lead_score ?? 0) >= 8;
}

function pipelineTotal(clients: { budget_max: number | null }[]) {
  const total = clients.reduce((s, c) => s + (c.budget_max ?? 0), 0);
  if (total >= 1_000_000)
    return `$${(total / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (total >= 1_000) return `$${Math.round(total / 1_000)}k`;
  return `$${total}`;
}

// ─── Stat strip — horizontal, no boxes, no borders ───────────────────────────
function StatStrip({ items }: { items: { label: string; value: string | number; color: string }[] }) {
  return (
    <div
      className="mb-6 flex overflow-hidden"
      style={{ borderRadius: 18, background: "#1c1c1e" }}
    >
      {items.map((item, i) => (
        <div
          key={item.label}
          className="flex-1 py-4 text-center"
          style={{ borderRight: i < items.length - 1 ? "0.5px solid rgba(255,255,255,0.06)" : "none" }}
        >
          <p
            className="text-[22px] font-semibold leading-none tracking-tight"
            style={{ color: "#f0f0f5" }}
          >
            {item.value}
          </p>
          <p className="mt-1.5 text-[10px]" style={{ color: "#636366" }}>
            {item.label}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────
function Badge({ children, tone }: { children: React.ReactNode; tone: "red" | "amber" | "green" | "blue" }) {
  const styles = {
    red: { background: "rgba(192,58,58,0.1)", color: "#d96060", border: "0.5px solid rgba(192,58,58,0.18)" },
    amber: { background: "rgba(196,131,26,0.1)", color: "#c4831a", border: "0.5px solid rgba(196,131,26,0.18)" },
    green: { background: "rgba(24,160,102,0.1)", color: "#18a066", border: "0.5px solid rgba(24,160,102,0.18)" },
    blue: { background: "rgba(76,122,255,0.1)", color: "#7b9fff", border: "0.5px solid rgba(76,122,255,0.18)" },
  }[tone];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-2 py-[3px] text-[10px] font-semibold"
      style={styles}
    >
      {children}
    </span>
  );
}

// ─── Action button ────────────────────────────────────────────────────────────
function ActionBtn({ children, tone, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone: "green" | "blue" | "amber" }) {
  const styles = {
    green: { background: "rgba(255,255,255,0.07)", color: "#aeaeb2" },
    blue: { background: "rgba(255,255,255,0.07)", color: "#aeaeb2" },
    amber: { background: "rgba(255,255,255,0.07)", color: "#aeaeb2" },
  }[tone];
  return (
    <button
      type="button"
      className="flex-1 rounded-[10px] px-3 py-2 text-center text-[12px] font-semibold press"
      style={styles}
      {...props}
    >
      {children}
    </button>
  );
}

export function DashboardClient({
  user,
  initial,
}: {
  user: { email: string | null; fullName: string | null } | null;
  initial: Initial;
}) {
  const router = useRouter();
  const toast = useToast();
  const [snoozed, setSnoozed] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [seeding, setSeeding] = useState(false);
  const [draftFor, setDraftFor] = useState<ClientRow | null>(null);

  const clients = initial.clients;
  const transactions = initial.transactions;

  const visible = useMemo(
    () => clients.filter((c) => !dismissed.has(c.id)),
    [clients, dismissed],
  );
  const hotLeads = useMemo(
    () => visible.filter((c) => isHot(c) && !snoozed.has(c.id) && c.status !== "closed"),
    [visible, snoozed],
  );
  const followUp = useMemo(
    () => visible.filter((c) => !snoozed.has(c.id) && c.status !== "closed" && !isHot(c) && (c.lead_score ?? 0) >= 5),
    [visible, snoozed],
  );
  const activeClients = useMemo(
    () => visible.filter((c) => c.status !== "closed"),
    [visible],
  );
  const underContractClients = useMemo(
    () => visible.filter((c) => c.status === "under_contract"),
    [visible],
  );
  const underContractCount = Math.max(
    underContractClients.length,
    transactions.filter((t) => ["under_contract", "active"].includes(String(t.status ?? "active"))).length,
  );

  const nearestClosing = useMemo(() => {
    const now = Date.now();
    const withDates = transactions
      .filter((t) => t.closing_date)
      .map((t) => ({ t, days: differenceInCalendarDays(new Date(String(t.closing_date)), now) }))
      .filter((x) => x.days >= 0 && x.days <= 30)
      .sort((a, b) => a.days - b.days);
    return withDates[0] ?? null;
  }, [transactions]);

  const briefingParts: string[] = [];
  if (initial.newMatches > 0)
    briefingParts.push(`${initial.newMatches} new match${initial.newMatches === 1 ? "" : "es"}`);
  if (hotLeads.length > 0)
    briefingParts.push(`${hotLeads.length} hot lead${hotLeads.length === 1 ? "" : "s"}`);
  if (nearestClosing)
    briefingParts.push(nearestClosing.days === 0 ? "closing today" : `closing in ${nearestClosing.days}d`);
  const briefing = briefingParts.length ? briefingParts.join(" · ") : null;

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const firstName = user?.fullName?.split(" ")[0] ?? user?.email?.split("@")[0] ?? "there";
  const initial0 = firstName[0]?.toUpperCase() || "A";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const topHot = hotLeads[0];
  const closingClient =
    underContractClients.find((c) => transactions.some((t) => t.client_id === c.id && t.closing_date)) ??
    underContractClients[0] ??
    null;
  const followUpClient = followUp[0] ?? null;

  async function loadDemo() {
    if (seeding) return;
    setSeeding(true);
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      const data = await res.json();
      if (!res.ok) toast.toast(String(data.error ?? "Seed failed"), "warn");
      else if (data.skipped) toast.toast("Demo data already loaded", "default");
      else toast.toast(`Loaded ${data.clients ?? 5} demo clients`, "success");
      router.refresh();
    } catch {
      toast.toast("Could not reach seed endpoint", "warn");
    } finally {
      setSeeding(false);
    }
  }

  const snooze = useCallback((id: string) => {
    setSnoozed((s) => new Set(s).add(id));
    toast.toast("Snoozed 1h", "success");
  }, [toast]);

  const dismiss = useCallback((id: string) => {
    setDismissed((s) => new Set(s).add(id));
    toast.toast("Dismissed", "default");
  }, [toast]);

  return (
    <div className="min-h-[100dvh] pb-[130px]" style={{ color: "var(--oc-text-1)" }}>
      <div className="px-5 pt-6">

        {/* ── Header row ── */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-[11px] mb-1" style={{ color: "#636366" }}>
              {today}
            </p>
            <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.025em]">
              {greeting}, {firstName}.
            </h1>
          </div>
          <div
            className="mt-0.5 flex h-[36px] w-[36px] flex-shrink-0 items-center justify-center rounded-full text-[13px] font-semibold"
            style={{
              background: "rgba(255,255,255,0.08)",
              color: "#aeaeb2",
            }}
          >
            {initial0}
          </div>
        </div>

        {/* ── Intelligence briefing ── */}
        {(briefing || clients.length === 0) && (
          <div
            className="mb-5 flex items-start gap-3 px-4 py-3.5"
            style={{ borderRadius: 14, background: "#1c1c1e" }}
          >
            <span className="mt-1 h-[5px] w-[5px] flex-shrink-0 rounded-full" style={{ background: "#0a7cff" }} />
            <p className="text-[13px] leading-relaxed" style={{ color: "#8e8e93" }}>
              {briefing ?? "No clients yet. Load demo data or add your first client."}
            </p>
          </div>
        )}


        {/* ── Stats ── */}
        <StatStrip items={[
          { label: "Pipeline", value: pipelineTotal(visible), color: "" },
          { label: "Hot", value: hotLeads.length, color: "" },
          { label: "Active", value: activeClients.length, color: "" },
          { label: "Closing", value: underContractCount, color: "" },
        ]} />

        {/* ── Action stack ── */}

        {/* BBA alert */}
        {initial.bbaAlerts.length > 0 && (
          <Link
            href={`/clients/${initial.bbaAlerts[0].clientId}`}
            className="mb-3 block p-4 press"
            style={{ borderRadius: 18, background: "#1c1c1e" }}
          >
            <div className="mb-2 flex items-center justify-between">
              <Badge tone="red"><ShieldAlert size={10} /> BBA required</Badge>
              <span className="text-[11px]" style={{ color: "#d96060" }}>
                {initial.bbaAlerts.length} showing{initial.bbaAlerts.length > 1 ? "s" : ""}
              </span>
            </div>
            <p className="text-[15px] font-semibold mb-0.5">{initial.bbaAlerts[0].clientName}</p>
            <p className="text-[12px] mb-3 leading-relaxed" style={{ color: "#6a4050" }}>
              {initial.bbaAlerts[0].address ?? "Upcoming showing"}
              {initial.bbaAlerts[0].showingDate
                ? " · " + new Date(initial.bbaAlerts[0].showingDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                : ""}
            </p>
            <span
              className="inline-block rounded-[10px] px-3 py-2 text-[12px] font-semibold text-white"
              style={{ background: "rgba(192,58,58,0.75)" }}
            >
              Send signing link
            </span>
          </Link>
        )}

        {/* Hot lead */}
        {topHot && (
          <div
            className="mb-3 p-4"
            style={{ borderRadius: 18, background: "#1c1c1e" }}
          >
            <div className="mb-2 flex items-center justify-between">
              <Badge tone="red">Hot lead</Badge>
            </div>
            <Link href={`/clients/${topHot.id}`}>
              <p className="text-[16px] font-semibold mb-0.5">
                {topHot.name}{topHot.town ? <span className="font-normal" style={{ color: "#636366" }}> · {topHot.town}</span> : ""}
              </p>
            </Link>
            <p className="mb-3 text-[12px]" style={{ color: "#636366" }}>
              {topHot.status?.replace(/_/g, " ") ?? "—"} · Score {topHot.lead_score ?? 0}/10
            </p>
            <div className="flex gap-2">
              <a
                href={topHot.phone ? `tel:${topHot.phone}` : "#"}
                className="flex-1 rounded-[10px] px-3 py-2 text-center text-[12px] font-semibold press"
                style={{ background: "rgba(255,255,255,0.07)", color: "#aeaeb2" }}
              >
                Call
              </a>
              <ActionBtn tone="blue" onClick={() => setDraftFor(topHot)}>AI text</ActionBtn>
              <ActionBtn tone="amber" onClick={() => snooze(topHot.id)}>Snooze</ActionBtn>
            </div>
            <button
              type="button"
              onClick={() => dismiss(topHot.id)}
              className="mt-2.5 w-full text-center text-[11px]"
              style={{ color: "#333a58" }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Closing */}
        {closingClient && (
          <Link
            href="/transactions"
            className="mb-3 block p-4 press"
            style={{ borderRadius: 18, background: "#1c1c1e" }}
          >
            <div className="mb-2 flex items-center justify-between">
              <Badge tone="green">Closing</Badge>
              {nearestClosing && (
                <span className="text-[11px]" style={{ color: "#18a066" }}>
                  {nearestClosing.days === 0 ? "today" : `in ${nearestClosing.days}d`}
                </span>
              )}
            </div>
            <p className="text-[16px] font-semibold mb-0.5">{closingClient.name}</p>
            <p className="text-[12px]" style={{ color: "#636366" }}>
              {closingClient.town ? `${closingClient.town} · ` : ""}Under contract
            </p>
          </Link>
        )}

        {/* Follow-up */}
        {followUpClient && (
          <Link
            href={`/clients/${followUpClient.id}`}
            className="mb-3 block p-4 press"
            style={{ borderRadius: 18, background: "#1c1c1e" }}
          >
            <div className="mb-2 flex items-center justify-between">
              <Badge tone="amber">Follow-up</Badge>
            </div>
            <p className="text-[16px] font-semibold mb-0.5">
              {followUpClient.name}
            </p>
            <p className="text-[12px]" style={{ color: "#636366" }}>
              {followUpClient.town ?? ""}{followUpClient.status ? ` · ${followUpClient.status.replace(/_/g, " ")}` : ""}
            </p>
          </Link>
        )}

        {/* Empty state */}
        {clients.length === 0 && (
          <div className="mb-3 p-6 text-center" style={{ borderRadius: 18, background: "#1c1c1e" }}>
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full" style={{ background: "rgba(255,255,255,0.07)" }}>
              <Users size={20} style={{ color: "#8e8e93" }} />
            </div>
            <p className="mb-1 text-[15px] font-semibold">No clients yet</p>
            <p className="mb-4 text-[12px]" style={{ color: "#636366" }}>Load demo data or add your first client.</p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={loadDemo}
                disabled={seeding}
                className="w-full rounded-full py-3 text-[14px] font-semibold text-white disabled:opacity-50"
                style={{ background: "#0a7cff" }}
              >
                {seeding ? "Loading…" : "Load demo data"}
              </button>
              <Link
                href="/clients?new=1"
                className="w-full rounded-full py-3 text-[14px] font-semibold"
                style={{ color: "#636366" }}
              >
                + Add first client
              </Link>
            </div>
          </div>
        )}

        {/* ── Aria + Quick actions ── */}
        <div className="mt-2 ios-group">
          <Link href="/voice" className="ios-row">
            <span
              className="mr-3 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full"
              style={{ background: "rgba(255,255,255,0.08)" }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#aeaeb2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="3" width="6" height="11" rx="3" />
                <path d="M5 10a7 7 0 0014 0" />
                <line x1="12" y1="19" x2="12" y2="22" />
                <line x1="8" y1="22" x2="16" y2="22" />
              </svg>
            </span>
            <div className="flex-1">
              <p className="text-[14px] font-medium" style={{ color: "#f0f0f5" }}>Voice</p>
              <p className="text-[11px]" style={{ color: "#636366" }}>Talk to Aria hands-free</p>
            </div>
            <span className="text-[14px]" style={{ color: "#48484a" }}>›</span>
          </Link>
          <Link href="/ai" className="ios-row">
            <span
              className="mr-3 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full"
              style={{ background: "rgba(255,255,255,0.08)" }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#aeaeb2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </span>
            <div className="flex-1">
              <p className="text-[14px] font-medium" style={{ color: "#f0f0f5" }}>Ask Aria</p>
              <p className="text-[11px]" style={{ color: "#636366" }}>Text chat</p>
            </div>
            <span className="text-[14px]" style={{ color: "#48484a" }}>›</span>
          </Link>
          {[
            { href: "/clients?new=1", label: "New Client", sub: "Add a lead" },
            { href: "/showings?new=1", label: "Log Showing", sub: "Schedule a tour" },
            { href: "/listings", label: "MLS Search", sub: "Browse NJ listings" },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="ios-row">
              <div className="flex-1">
                <p className="text-[14px] font-medium" style={{ color: "#f0f0f5" }}>{l.label}</p>
                <p className="text-[11px]" style={{ color: "#636366" }}>{l.sub}</p>
              </div>
              <span className="text-[14px]" style={{ color: "#48484a" }}>›</span>
            </Link>
          ))}
        </div>
      </div>

      {draftFor ? (
        <AIDraftModal
          client={{
            id: draftFor.id,
            name: draftFor.name,
            phone: draftFor.phone,
            town: draftFor.town,
            budget_max: draftFor.budget_max,
            status: draftFor.status,
          }}
          onClose={() => setDraftFor(null)}
        />
      ) : null}
    </div>
  );
}

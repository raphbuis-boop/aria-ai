"use client";

import { AIDraftModal } from "@/components/AIDraftModal";
import { useToast } from "@/components/ToastProvider";
import { differenceInCalendarDays } from "date-fns";
import { Building2, Search, ShieldAlert, Zap, TrendingUp, Users, CircleDot } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

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

function pipelineTotal(clients: { budget_max: number | null }[]) {
  const total = clients.reduce((s, c) => s + (c.budget_max ?? 0), 0);
  if (total >= 1_000_000)
    return `$${(total / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (total >= 1_000) return `$${Math.round(total / 1_000)}k`;
  return `$${total}`;
}

// ─── Stat card ───────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  color: "blue" | "amber" | "green" | "white";
  icon: React.ElementType;
}) {
  const val = {
    blue: "text-[#4f7bff]",
    amber: "text-[#ffb832]",
    green: "text-[#50dc78]",
    white: "text-[#f0eee8]",
  }[color];
  const bg = {
    blue: "bg-[#4f7bff]/10",
    amber: "bg-[#ffb832]/10",
    green: "bg-[#50dc78]/10",
    white: "bg-white/6",
  }[color];

  return (
    <div className="rounded-[18px] border-[0.5px] border-[#1c1c2a] bg-[#0e0e18] p-4">
      <div className={`mb-3 flex h-8 w-8 items-center justify-center rounded-[10px] ${bg} ${val}`}>
        <Icon size={15} strokeWidth={2.2} />
      </div>
      <p className={`text-[24px] font-semibold leading-none tracking-tight ${val}`}>
        {value}
      </p>
      <p className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.9px] text-[#44445a]">
        {label}
      </p>
    </div>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────
function Badge({ children, tone }: { children: React.ReactNode; tone: "red" | "amber" | "green" | "blue" }) {
  const styles = {
    red: "bg-[#ff5050]/12 text-[#ff6060] border-[#ff5050]/20",
    amber: "bg-[#ffb832]/12 text-[#ffb832] border-[#ffb832]/20",
    green: "bg-[#50dc78]/12 text-[#50dc78] border-[#50dc78]/20",
    blue: "bg-[#4f7bff]/12 text-[#6f9bff] border-[#4f7bff]/20",
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border-[0.5px] px-2 py-[3px] text-[10px] font-bold uppercase tracking-[0.6px] ${styles}`}>
      {children}
    </span>
  );
}

// ─── Action button ────────────────────────────────────────────────────────────
function ActionBtn({ children, tone, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone: "green" | "blue" | "amber" }) {
  const styles = {
    green: "bg-[#50dc78]/10 text-[#50dc78] border-[#50dc78]/18 hover:bg-[#50dc78]/16",
    blue: "bg-[#4f7bff]/10 text-[#6f9bff] border-[#4f7bff]/18 hover:bg-[#4f7bff]/16",
    amber: "bg-[#ffb832]/10 text-[#ffb832] border-[#ffb832]/18 hover:bg-[#ffb832]/16",
  }[tone];
  return (
    <button
      type="button"
      className={`flex-1 rounded-[9px] border-[0.5px] px-3 py-[7px] text-center text-[12px] font-semibold transition ${styles}`}
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
  const visible = clients.filter((c) => !dismissed.has(c.id));

  const isHot = (c: ClientRow) =>
    c.status === "showing" || c.status === "hot" || (c.lead_score ?? 0) >= 8;

  const hotLeads = visible.filter((c) => isHot(c) && !snoozed.has(c.id) && c.status !== "closed");
  const followUp = visible.filter(
    (c) => !snoozed.has(c.id) && c.status !== "closed" && !isHot(c) && (c.lead_score ?? 0) >= 5,
  );
  const activeClients = visible.filter((c) => c.status !== "closed");
  const underContractClients = visible.filter((c) => c.status === "under_contract");
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

  function snooze(id: string) {
    setSnoozed((s) => new Set(s).add(id));
    toast.toast("Snoozed 1h", "success");
  }

  function dismiss(id: string) {
    setDismissed((s) => new Set(s).add(id));
    toast.toast("Dismissed", "default");
  }

  return (
    <div className="min-h-screen bg-[#080810] text-[#f0eee8] pb-28">
      <div className="px-5 pt-5">

        {/* ── Header row ── */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[1.1px] text-[#4f7bff] mb-1">
              {today}
            </p>
            <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em]">
              {greeting}, {firstName}.
            </h1>
          </div>
          <div className="mt-1 h-[38px] w-[38px] flex-shrink-0 rounded-full bg-[#4f7bff]/15 flex items-center justify-center text-[14px] font-bold text-[#6f9bff] border-[0.5px] border-[#4f7bff]/25">
            {initial0}
          </div>
        </div>

        {/* ── Briefing ── */}
        <div className="mb-4 rounded-[18px] border-[0.5px] border-[#1c1c2a] bg-[#0e0e18] px-4 py-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="h-[6px] w-[6px] rounded-full bg-[#4f7bff] animate-pulse flex-shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-[1.1px] text-[#4f7bff]">
              Overnight update
            </span>
          </div>
          <p className="text-[13.5px] leading-[1.6] text-[#8888a0]">
            {briefing ?? (
              clients.length === 0
                ? "No clients yet. Load demo data or add your first client."
                : "You're all caught up."
            )}
          </p>
        </div>

        {/* ── Quick actions ── */}
        <div className="mb-5 grid grid-cols-2 gap-2">
          <Link
            href="/listings"
            className="flex items-center gap-3 rounded-[16px] border-[0.5px] border-[#1c1c2a] bg-[#0e0e18] px-4 py-3.5 transition active:border-[#4f7bff]/40"
          >
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] bg-[#4f7bff]/12 text-[#4f7bff]">
              <Search size={16} strokeWidth={2.2} />
            </span>
            <div>
              <p className="text-[13px] font-semibold leading-tight">Browse MLS</p>
              <p className="mt-0.5 text-[11px] text-[#44445a]">Live NJ listings</p>
            </div>
          </Link>
          <Link
            href="/properties"
            className="flex items-center gap-3 rounded-[16px] border-[0.5px] border-[#1c1c2a] bg-[#0e0e18] px-4 py-3.5 transition active:border-[#4f7bff]/40"
          >
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] bg-[#4f7bff]/12 text-[#4f7bff]">
              <Building2 size={16} strokeWidth={2.2} />
            </span>
            <div>
              <p className="text-[13px] font-semibold leading-tight">Properties</p>
              <p className="mt-0.5 text-[11px] text-[#44445a]">Saved + matches</p>
            </div>
          </Link>
        </div>

        {/* ── Stats ── */}
        <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[1.2px] text-[#44445a]">
          Stats
        </p>
        <div className="mb-5 grid grid-cols-2 gap-2">
          <StatCard label="Pipeline" value={pipelineTotal(visible)} color="blue" icon={TrendingUp} />
          <StatCard label="Hot leads" value={hotLeads.length} color="amber" icon={Zap} />
          <StatCard label="Active" value={activeClients.length} color="white" icon={Users} />
          <StatCard label="Closing" value={underContractCount} color="green" icon={CircleDot} />
        </div>

        {/* ── Action stack ── */}
        <div className="flex items-center justify-between mb-2.5">
          <p className="text-[10px] font-bold uppercase tracking-[1.2px] text-[#44445a]">
            Action stack
          </p>
          {(topHot || closingClient || followUpClient || initial.bbaAlerts.length > 0) && (
            <span className="rounded-full bg-[#4f7bff]/10 px-2.5 py-[3px] text-[10px] font-semibold text-[#6f9bff]">
              {[topHot, closingClient, followUpClient, initial.bbaAlerts[0]].filter(Boolean).length} item
              {[topHot, closingClient, followUpClient, initial.bbaAlerts[0]].filter(Boolean).length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* BBA alert */}
        {initial.bbaAlerts.length > 0 && (
          <Link
            href={`/clients/${initial.bbaAlerts[0].clientId}`}
            className="mb-2.5 block rounded-[18px] border-[0.5px] border-[#3a1a1a] bg-[#120a0a] p-4"
          >
            <div className="mb-2.5 flex items-center justify-between">
              <Badge tone="red"><ShieldAlert size={10} /> BBA required</Badge>
              <span className="text-[11px] text-[#ff8a8a]">
                {initial.bbaAlerts.length} showing{initial.bbaAlerts.length > 1 ? "s" : ""}
              </span>
            </div>
            <p className="text-[15px] font-semibold mb-0.5">{initial.bbaAlerts[0].clientName}</p>
            <p className="text-[12px] text-[#88607a] mb-3 leading-relaxed">
              {initial.bbaAlerts[0].address ?? "Upcoming showing"}
              {initial.bbaAlerts[0].showingDate
                ? " · " + new Date(initial.bbaAlerts[0].showingDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                : ""}
              {" "}— NJ/NAR rules require a signed BBA before the tour.
            </p>
            <span className="inline-block rounded-[9px] bg-[#ff5050]/90 px-3 py-[7px] text-[12px] font-semibold text-white">
              Send signing link →
            </span>
          </Link>
        )}

        {/* Hot lead */}
        {topHot && (
          <div className="mb-2.5 rounded-[18px] border-[0.5px] border-[#1c1c2a] bg-[#0e0e18] p-4">
            <div className="mb-2.5 flex items-center justify-between">
              <Badge tone="red">Hot lead</Badge>
              <span className="text-[11px] text-[#44445a]">now</span>
            </div>
            <Link href={`/clients/${topHot.id}`}>
              <p className="text-[15px] font-semibold mb-0.5">
                {topHot.name}{topHot.town ? ` · ${topHot.town}` : ""}
              </p>
            </Link>
            <p className="mb-2 text-[12px] text-[#44445a]">
              {topHot.status?.replace(/_/g, " ") ?? "—"}
            </p>
            <div className="mb-3 flex items-center gap-2">
              <div className="flex gap-[3px]">
                {Array.from({ length: 10 }).map((_, j) => (
                  <div
                    key={j}
                    className={`h-1.5 w-1.5 rounded-full ${j < (topHot.lead_score ?? 0) ? "bg-[#4f7bff]" : "bg-[#1c1c2a]"}`}
                  />
                ))}
              </div>
              <span className="text-[11px] text-[#44445a]">Score {topHot.lead_score ?? 0}/10</span>
            </div>
            <div className="flex gap-2">
              <a
                href={topHot.phone ? `tel:${topHot.phone}` : "#"}
                className="flex-1 rounded-[9px] border-[0.5px] border-[#50dc78]/18 bg-[#50dc78]/10 px-3 py-[7px] text-center text-[12px] font-semibold text-[#50dc78] transition hover:bg-[#50dc78]/16"
              >
                Call
              </a>
              <ActionBtn tone="blue" onClick={() => setDraftFor(topHot)}>AI text</ActionBtn>
              <ActionBtn tone="amber" onClick={() => snooze(topHot.id)}>Snooze</ActionBtn>
            </div>
            <button
              type="button"
              onClick={() => dismiss(topHot.id)}
              className="mt-2 w-full text-center text-[11px] text-[#44445a] transition hover:text-[#888898]"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Closing */}
        {closingClient && (
          <Link
            href="/transactions"
            className="mb-2.5 block rounded-[18px] border-[0.5px] border-[#1a2a1c] bg-[#0a120c] p-4"
          >
            <div className="mb-2.5 flex items-center justify-between">
              <Badge tone="green">Closing</Badge>
              {nearestClosing && (
                <span className="text-[11px] text-[#50dc78]">
                  {nearestClosing.days === 0 ? "today" : `in ${nearestClosing.days}d`}
                </span>
              )}
            </div>
            <p className="text-[15px] font-semibold mb-0.5">{closingClient.name}</p>
            {closingClient.town && (
              <p className="mb-0.5 text-[12px] text-[#44445a]">{closingClient.town}</p>
            )}
            <p className="mb-3 text-[12px] text-[#50dc78]">Under contract · milestones due</p>
            <span className="inline-block rounded-[9px] border-[0.5px] border-[#1c1c2a] px-3 py-[7px] text-[12px] font-semibold text-[#888898]">
              View deal →
            </span>
          </Link>
        )}

        {/* Follow-up */}
        {followUpClient && (
          <Link
            href={`/clients/${followUpClient.id}`}
            className="mb-2.5 block rounded-[18px] border-[0.5px] border-[#1c1c2a] bg-[#0e0e18] p-4"
          >
            <div className="mb-2.5 flex items-center justify-between">
              <Badge tone="amber">Follow-up</Badge>
            </div>
            <p className="text-[15px] font-semibold mb-0.5">
              {followUpClient.name}{followUpClient.town ? ` · ${followUpClient.town}` : ""}
            </p>
            <p className="mb-3 text-[12px] text-[#44445a]">
              {followUpClient.status?.replace(/_/g, " ") ?? "Check in"}
            </p>
            <span className="inline-block rounded-[9px] border-[0.5px] border-[#4f7bff]/20 bg-[#4f7bff]/10 px-3 py-[7px] text-[12px] font-semibold text-[#6f9bff]">
              Open client →
            </span>
          </Link>
        )}

        {/* Empty state */}
        {clients.length === 0 && (
          <div className="mb-2.5 rounded-[18px] border-[0.5px] border-[#1c1c2a] bg-[#0e0e18] p-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#4f7bff]/10">
              <Users size={22} className="text-[#4f7bff]" />
            </div>
            <p className="mb-1 text-[14px] font-semibold">No clients yet</p>
            <p className="mb-4 text-[12px] text-[#44445a]">Load demo data or add your first client.</p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={loadDemo}
                disabled={seeding}
                className="w-full rounded-[12px] bg-[#4f7bff] py-2.5 text-[13px] font-semibold text-white disabled:opacity-60 transition hover:bg-[#3d6ae8]"
              >
                {seeding ? "Loading…" : "Load demo data"}
              </button>
              <Link
                href="/clients?new=1"
                className="w-full rounded-[12px] border-[0.5px] border-[#1c1c2a] py-2.5 text-[13px] font-semibold text-[#888898] transition hover:text-[#f0eee8]"
              >
                + Add first client
              </Link>
            </div>
          </div>
        )}

        {/* ── Ask Aria ── */}
        <p className="mb-2.5 mt-5 text-[10px] font-bold uppercase tracking-[1.2px] text-[#44445a]">
          Ask Aria
        </p>
        <Link
          href="/ai"
          className="mb-4 flex items-center gap-3 rounded-[14px] border-[0.5px] border-[#1c1c2a] bg-[#0e0e18] px-4 py-[13px] transition hover:border-[#4f7bff]/30"
        >
          <span className="h-2 w-2 flex-shrink-0 rounded-full bg-[#4f7bff]" />
          <span className="text-[13px] text-[#44445a]">Ask anything about your pipeline…</span>
        </Link>

        {/* ── Quick links ── */}
        <div className="flex flex-wrap gap-2 pb-2">
          {[
            { href: "/clients?new=1", label: "+ New Client" },
            { href: "/showings?new=1", label: "Log Showing" },
            { href: "/listings", label: "MLS Search" },
            { href: "/pipeline", label: "Pipeline" },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-full border-[0.5px] border-[#1c1c2a] bg-[#0e0e18] px-3.5 py-[7px] text-[12px] font-medium text-[#555568] transition hover:border-[#4f7bff]/30 hover:text-[#8888a0]"
            >
              {l.label}
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

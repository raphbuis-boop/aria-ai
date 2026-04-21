"use client";

import { AIDraftModal } from "@/components/AIDraftModal";
import { useToast } from "@/components/ToastProvider";
import { differenceInCalendarDays } from "date-fns";
import { ShieldAlert } from "lucide-react";
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
    c.status === "showing" ||
    c.status === "hot" ||
    (c.lead_score ?? 0) >= 8;

  const hotLeads = visible.filter(
    (c) => isHot(c) && !snoozed.has(c.id) && c.status !== "closed",
  );
  const followUp = visible.filter(
    (c) =>
      !snoozed.has(c.id) &&
      c.status !== "closed" &&
      !isHot(c) &&
      (c.lead_score ?? 0) >= 5,
  );
  const activeClients = visible.filter((c) => c.status !== "closed");
  const underContractClients = visible.filter(
    (c) => c.status === "under_contract",
  );
  const underContractCount = Math.max(
    underContractClients.length,
    transactions.filter((t) =>
      ["under_contract", "active"].includes(String(t.status ?? "active")),
    ).length,
  );

  const nearestClosing = useMemo(() => {
    const now = Date.now();
    const withDates = transactions
      .filter((t) => t.closing_date)
      .map((t) => ({
        t,
        days: differenceInCalendarDays(new Date(String(t.closing_date)), now),
      }))
      .filter((x) => x.days >= 0 && x.days <= 30)
      .sort((a, b) => a.days - b.days);
    return withDates[0] ?? null;
  }, [transactions]);

  // Briefing line assembled from real data.
  const briefingParts: string[] = [];
  if (initial.newMatches > 0) {
    briefingParts.push(
      `${initial.newMatches} new property match${initial.newMatches === 1 ? "" : "es"} overnight`,
    );
  }
  if (hotLeads.length > 0) {
    briefingParts.push(
      `${hotLeads.length} hot lead${hotLeads.length === 1 ? "" : "s"} need follow-up`,
    );
  }
  if (nearestClosing) {
    briefingParts.push(
      nearestClosing.days === 0
        ? "closing today"
        : `1 closing in ${nearestClosing.days} day${nearestClosing.days === 1 ? "" : "s"}`,
    );
  }
  const briefing = briefingParts.length ? briefingParts.join(" · ") : null;

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const firstName =
    user?.fullName?.split(" ")[0] ?? user?.email?.split("@")[0] ?? "there";
  const initial0 = firstName[0]?.toUpperCase() || "A";
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // Top three priorities for the Action Stack.
  const topHot = hotLeads[0];
  const closingClient =
    underContractClients.find((c) =>
      transactions.some((t) => t.client_id === c.id && t.closing_date),
    ) ??
    underContractClients[0] ??
    null;
  const followUpClient = followUp[0] ?? null;

  async function loadDemo() {
    if (seeding) return;
    setSeeding(true);
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.toast(String(data.error ?? "Seed failed"), "warn");
      } else if (data.skipped) {
        toast.toast("Demo data already loaded", "default");
      } else {
        toast.toast(`Loaded ${data.clients ?? 5} demo clients`, "success");
      }
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
    <div className="min-h-screen bg-[#0a0a0f] text-[#f0eee8] pb-28">
      <div className="px-5 pt-6">
        <p className="text-[11px] font-semibold uppercase tracking-[1px] text-[#4f7bff] mb-1">
          {today}
        </p>
        <div className="flex items-center justify-between">
          <h1 className="text-[26px] font-semibold leading-tight text-[#f0eee8]">
            {greeting}, {firstName}
          </h1>
          <div className="w-9 h-9 rounded-full bg-[#4f7bff]/20 flex items-center justify-center text-[13px] font-bold text-[#6f9bff] flex-shrink-0">
            {initial0}
          </div>
        </div>
      </div>

      <div className="px-5 mt-[18px]">
        <div className="bg-gradient-to-br from-[#0e1428] to-[#111230] border-[0.5px] border-[#1e2a4e] rounded-[20px] p-[18px]">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4f7bff] animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-[1px] text-[#4f7bff]">
              While you were away
            </span>
          </div>
          <p className="text-sm text-[#a0a0c0] leading-[1.6]">
            {briefing ??
              (clients.length === 0
                ? "No clients yet. Load demo data or add your first client to get started."
                : "No new updates overnight.")}
          </p>
        </div>

        <div className="flex items-center justify-between mt-5 mb-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[1.2px] text-[#444460]">
            Action Stack
          </p>
          <button
            type="button"
            className="bg-[#12121e] border-[0.5px] border-[#1e1e2e] rounded-[20px] px-3 py-1 text-[11px] font-semibold text-[#444460]"
          >
            Focus mode
          </button>
        </div>

        {initial.bbaAlerts.length > 0 && (
          <Link
            href={`/clients/${initial.bbaAlerts[0].clientId}`}
            className="block bg-gradient-to-br from-[#1a0f0f] to-[#1e1014] border-[0.5px] border-[#3a1a1a] rounded-[20px] p-[18px] mb-2.5"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-[#ff5050]/15 text-[#ff6060] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.5px]">
                <ShieldAlert size={11} /> BBA required
              </span>
              <span className="text-[11px] text-[#ff8a8a]">
                {initial.bbaAlerts.length} showing
                {initial.bbaAlerts.length > 1 ? "s" : ""}
              </span>
            </div>
            <p className="text-base font-semibold text-[#f0eee8] mb-0.5">
              {initial.bbaAlerts[0].clientName} has no signed BBA
            </p>
            <p className="text-xs text-[#a08890] mb-3 leading-relaxed">
              {initial.bbaAlerts[0].address ?? "Upcoming showing"}
              {initial.bbaAlerts[0].showingDate
                ? " · " +
                  new Date(
                    initial.bbaAlerts[0].showingDate,
                  ).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                : ""}
              . NJ / NAR rules require a signed Buyer Broker Agreement before
              the tour.
            </p>
            <span className="inline-block bg-gradient-to-br from-[#ff6060] to-[#ff4848] text-white rounded-[9px] px-3 py-[7px] text-xs font-semibold">
              Send signing link →
            </span>
          </Link>
        )}

        {topHot && (
          <div className="bg-[#0f0f1e] border-[0.5px] border-[#2a1a1a] rounded-[20px] p-[18px] mb-2.5">
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center rounded-md bg-[#ff5050]/15 text-[#ff6060] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.5px]">
                Hot Lead
              </span>
              <span className="text-[11px] text-[#444460]">now</span>
            </div>
            <Link href={`/clients/${topHot.id}`}>
              <p className="text-base font-semibold text-[#f0eee8] mb-0.5">
                {topHot.name}
                {topHot.town ? ` · ${topHot.town}` : ""}
              </p>
            </Link>
            <p className="text-xs text-[#666680] mb-1">
              {topHot.status?.replace(/_/g, " ") ?? "—"}
            </p>
            <div className="flex items-center gap-2 mb-[14px]">
              <div className="flex gap-[3px]">
                {Array.from({ length: 10 }).map((_, j) => (
                  <div
                    key={j}
                    className={`w-1.5 h-1.5 rounded-full ${j < (topHot.lead_score ?? 0) ? "bg-[#4f7bff]" : "bg-[#1e1e2e]"}`}
                  />
                ))}
              </div>
              <span className="text-[11px] text-[#666680]">
                Lead score {topHot.lead_score ?? 0}
              </span>
            </div>
            <div className="flex gap-2">
              <a
                href={topHot.phone ? `tel:${topHot.phone}` : "#"}
                className="flex-1 text-center bg-[#50dc78]/12 text-[#50dc78] border-[0.5px] border-[#50dc78]/20 rounded-[9px] px-3 py-[7px] text-xs font-semibold"
              >
                Call now
              </a>
              <button
                type="button"
                onClick={() => setDraftFor(topHot)}
                className="flex-1 text-center bg-[#4f7bff]/12 text-[#6f9bff] border-[0.5px] border-[#4f7bff]/20 rounded-[9px] px-3 py-[7px] text-xs font-semibold"
              >
                AI text
              </button>
              <button
                type="button"
                onClick={() => snooze(topHot.id)}
                className="flex-1 bg-[#ffb832]/10 text-[#ffb832] border-[0.5px] border-[#ffb832]/20 rounded-[9px] px-3 py-[7px] text-xs font-semibold"
              >
                Snooze 1h
              </button>
            </div>
            <button
              type="button"
              onClick={() => dismiss(topHot.id)}
              className="mt-2 w-full text-center text-[11px] text-[#555570]"
            >
              Dismiss
            </button>
          </div>
        )}

        {closingClient && (
          <Link
            href="/transactions"
            className="block bg-[#0f0f1e] border-[0.5px] border-[#1a2a1a] rounded-[20px] p-[18px] mb-2.5"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center rounded-md bg-[#50dc78]/10 text-[#50dc78] border-[0.5px] border-[#50dc78]/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.8px]">
                Closing
              </span>
              {nearestClosing ? (
                <span className="text-[11px] text-[#50dc78]">
                  {nearestClosing.days === 0
                    ? "today"
                    : `in ${nearestClosing.days} day${nearestClosing.days === 1 ? "" : "s"}`}
                </span>
              ) : null}
            </div>
            <p className="text-[15px] font-semibold text-[#f0eee8] mb-0.5">
              {closingClient.name} — under contract
            </p>
            {closingClient.town ? (
              <p className="text-xs text-[#666680] mb-0.5">
                {closingClient.town}
              </p>
            ) : null}
            <p className="text-xs text-[#50dc78] mb-3">
              Milestone check-ins due
            </p>
            <span className="inline-block bg-transparent border-[0.5px] border-[#2a2a3e] text-[#888] rounded-[12px] px-4 py-2.5 text-[13px] font-semibold">
              View deal →
            </span>
          </Link>
        )}

        {followUpClient && (
          <Link
            href={`/clients/${followUpClient.id}`}
            className="block bg-[#0f0f1e] border-[0.5px] border-[#1e1e2e] rounded-[20px] p-[18px] mb-2.5"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center rounded-md bg-[#ffb832]/10 text-[#ffb832] border-[0.5px] border-[#ffb832]/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.8px]">
                Follow-up
              </span>
            </div>
            <p className="text-[15px] font-semibold text-[#f0eee8] mb-0.5">
              {followUpClient.name}
              {followUpClient.town ? ` · ${followUpClient.town}` : ""}
            </p>
            <p className="text-xs text-[#666680] mb-3">
              {followUpClient.status?.replace(/_/g, " ") ?? "Check in"}
            </p>
            <span className="inline-block bg-[#4f7bff]/12 text-[#6f9bff] border-[0.5px] border-[#4f7bff]/20 rounded-[9px] px-3 py-[7px] text-xs font-semibold">
              Open client →
            </span>
          </Link>
        )}

        {clients.length === 0 && (
          <div className="bg-[#0f0f1e] border-[0.5px] border-[#1c1c2e] rounded-[20px] p-6 text-center mb-2.5">
            <p className="text-3xl mb-3">👥</p>
            <p className="text-[#888898] text-sm mb-4">
              No clients yet — load a demo set or add your own.
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={loadDemo}
                disabled={seeding}
                className="w-full rounded-[12px] bg-gradient-to-br from-[#4f7bff] to-[#7c5cfc] py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {seeding ? "Loading demo data…" : "Load demo data"}
              </button>
              <Link
                href="/clients?new=1"
                className="w-full rounded-[12px] border-[0.5px] border-[#2a2a3e] py-2.5 text-sm font-semibold text-[#9090a8]"
              >
                + Add your first client
              </Link>
            </div>
          </div>
        )}

        <p className="text-[10px] font-semibold uppercase tracking-[1.2px] text-[#444460] mt-5 mb-2.5">
          Stats
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-[#0d0d1c] border-[0.5px] border-[#1a1a2c] rounded-[18px] p-4">
            <p className="text-[11px] text-[#444460] uppercase tracking-[0.8px] mb-1.5 font-medium">
              Pipeline
            </p>
            <p className="text-2xl font-semibold text-[#4f7bff] leading-none">
              {pipelineTotal(visible)}
            </p>
          </div>
          <div className="bg-[#0d0d1c] border-[0.5px] border-[#1a1a2c] rounded-[18px] p-4">
            <p className="text-[11px] text-[#444460] uppercase tracking-[0.8px] mb-1.5 font-medium">
              Hot leads
            </p>
            <p className="text-2xl font-semibold text-[#ffb832] leading-none">
              {hotLeads.length}
            </p>
          </div>
          <div className="bg-[#0d0d1c] border-[0.5px] border-[#1a1a2c] rounded-[18px] p-4">
            <p className="text-[11px] text-[#444460] uppercase tracking-[0.8px] mb-1.5 font-medium">
              Active clients
            </p>
            <p className="text-2xl font-semibold text-[#f0eee8] leading-none">
              {activeClients.length}
            </p>
          </div>
          <div className="bg-[#0d0d1c] border-[0.5px] border-[#1a1a2c] rounded-[18px] p-4">
            <p className="text-[11px] text-[#444460] uppercase tracking-[0.8px] mb-1.5 font-medium">
              Closings
            </p>
            <p className="text-2xl font-semibold text-[#50dc78] leading-none">
              {underContractCount}
            </p>
          </div>
        </div>

        <p className="text-[10px] font-semibold uppercase tracking-[1.2px] text-[#444460] mt-5 mb-2.5">
          Ask Aria
        </p>
        <Link
          href="/ai"
          className="flex items-center gap-2.5 bg-[#12121e] border-[0.5px] border-[#2a2a3e] rounded-[14px] px-4 py-[13px]"
        >
          <span className="w-2 h-2 rounded-full bg-[#4f7bff] flex-shrink-0" />
          <span className="text-sm text-[#555570]">Ask Aria anything...</span>
        </Link>

        <div className="flex flex-wrap gap-[7px] mt-4 pb-2">
          <Link
            href="/clients?new=1"
            className="bg-[#12121e] border-[0.5px] border-[#1e1e2e] text-[#666680] rounded-[20px] px-[14px] py-[7px] text-xs font-medium"
          >
            + New Client
          </Link>
          <Link
            href="/showings?new=1"
            className="bg-[#12121e] border-[0.5px] border-[#1e1e2e] text-[#666680] rounded-[20px] px-[14px] py-[7px] text-xs font-medium"
          >
            Log Showing
          </Link>
          <Link
            href="/mls"
            className="bg-[#12121e] border-[0.5px] border-[#1e1e2e] text-[#666680] rounded-[20px] px-[14px] py-[7px] text-xs font-medium"
          >
            Properties
          </Link>
          <Link
            href="/pipeline"
            className="bg-[#12121e] border-[0.5px] border-[#1e1e2e] text-[#666680] rounded-[20px] px-[14px] py-[7px] text-xs font-medium"
          >
            Pipeline
          </Link>
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

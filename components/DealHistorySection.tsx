"use client";

import { CollapsibleSection } from "@/components/CollapsibleSection";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/ToastProvider";
import { fmtMoney } from "@/lib/utils";
import {
  CheckCircle2,
  ChevronDown,
  Handshake,
  Hourglass,
  Pencil,
  Plus,
  ShieldAlert,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Status =
  | "offer_made"
  | "offer_accepted"
  | "under_contract"
  | "closed"
  | "fell_through"
  | "cancelled";

type FellThroughReason =
  | "financing"
  | "inspection"
  | "cold_feet"
  | "appraisal"
  | "title"
  | "other";

export type DealRow = {
  id: string;
  source?: "deal" | "transaction";
  transaction_id?: string | null;
  property_address: string;
  status: Status;
  offer_amount: number | null;
  offer_date: string | null;
  accepted_date: string | null;
  closed_date: string | null;
  outcome: string | null;
  outcome_notes: string | null;
  fell_through_reason: FellThroughReason | null;
  created_at: string;
  updated_at: string;
};

const STATUS_LABEL: Record<Status, string> = {
  offer_made: "Offer Made",
  offer_accepted: "Offer Accepted",
  under_contract: "Under Contract",
  closed: "Closed",
  fell_through: "Fell Through",
  cancelled: "Cancelled",
};

const REASON_LABEL: Record<FellThroughReason, string> = {
  financing: "Financing",
  inspection: "Inspection",
  cold_feet: "Cold feet",
  appraisal: "Appraisal",
  title: "Title",
  other: "Other",
};

const STATUS_STYLES: Record<Status, { bg: string; text: string; icon: typeof CheckCircle2 }> = {
  offer_made: {
    bg: "bg-[#4f7bff]/15",
    text: "text-[#6f9bff]",
    icon: Handshake,
  },
  offer_accepted: {
    bg: "bg-[#f59e0b]/15",
    text: "text-[#f5b248]",
    icon: Handshake,
  },
  under_contract: {
    bg: "bg-[#8b5cf6]/15",
    text: "text-[#b48cff]",
    icon: Hourglass,
  },
  closed: {
    bg: "bg-[#50dc78]/15",
    text: "text-[#50dc78]",
    icon: CheckCircle2,
  },
  fell_through: {
    bg: "bg-[#ff5050]/15",
    text: "text-[#ff6060]",
    icon: ShieldAlert,
  },
  cancelled: {
    bg: "bg-[#555570]/20",
    text: "text-[#9090a8]",
    icon: XCircle,
  },
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

// Most recent timeline date for sorting.
function sortKey(d: DealRow): number {
  const candidates = [d.closed_date, d.accepted_date, d.offer_date, d.created_at]
    .filter(Boolean) as string[];
  if (!candidates.length) return 0;
  return new Date(candidates[0]).getTime();
}

export function DealHistorySection({ clientId }: { clientId: string }) {
  const toast = useToast();
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<DealRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<DealRow | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/client-deals?clientId=${encodeURIComponent(clientId)}`,
          { cache: "no-store" },
        );
        const json = await res.json();
        if (!cancelled && res.ok) {
          setDeals((json.deals ?? []) as DealRow[]);
        }
      } catch {
        /* toast on user-facing actions only */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const sorted = useMemo(
    () => [...deals].sort((a, b) => sortKey(b) - sortKey(a)),
    [deals],
  );

  const summary = useMemo(() => {
    if (!deals.length) return null;
    const closed = deals.filter((d) => d.status === "closed").length;
    const fellThrough = deals.filter((d) => d.status === "fell_through").length;
    const parts = [`${deals.length} deal${deals.length === 1 ? "" : "s"}`];
    if (closed) parts.push(`${closed} closed`);
    if (fellThrough) parts.push(`${fellThrough} fell through`);
    return parts.join(" · ");
  }, [deals]);

  function upsertLocal(updated: DealRow) {
    setDeals((prev) => {
      const i = prev.findIndex((p) => p.id === updated.id);
      if (i < 0) return [updated, ...prev];
      const copy = [...prev];
      copy[i] = updated;
      return copy;
    });
  }

  async function remove(deal: DealRow) {
    if (deal.source === "transaction") {
      toast.toast("That deal lives in Transactions — delete it there", "warn");
      setConfirmDelete(null);
      return;
    }
    const res = await fetch(`/api/client-deals/${deal.id}`, { method: "DELETE" });
    if (res.ok) {
      setDeals((prev) => prev.filter((d) => d.id !== deal.id));
      toast.toast("Deal removed", "success");
    } else {
      const json = await res.json().catch(() => ({}));
      toast.toast(String(json.error ?? "Could not delete"), "warn");
    }
    setConfirmDelete(null);
  }

  return (
    <>
      <CollapsibleSection
        title="Deal History"
        summary={summary}
        right={
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1 rounded-[10px] border-[0.5px] border-[#2a2a3e] bg-[#12121e] px-2.5 py-1 text-[11px] font-semibold text-[#9090a8] active:border-[#4f7bff]"
          >
            <Plus size={12} /> Log Deal
          </button>
        }
      >
        {loading ? (
          <div className="rounded-2xl border border-[#1e1e2e] bg-[#12121e] p-4 text-center text-[12px] text-[#555570]">
            Loading deals…
          </div>
        ) : sorted.length === 0 ? (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex w-full flex-col items-center gap-1.5 rounded-2xl border border-dashed border-[#2a2a3e] bg-[#12121e] px-4 py-6 text-[12.5px] text-[#666680] hover:border-[#4f7bff]/40 hover:text-[#9090a8]"
          >
            <Handshake size={18} />
            <span>No deals logged yet — tap to add the first one</span>
          </button>
        ) : (
          <ol className="space-y-2">
            {sorted.map((deal) => {
              const s = STATUS_STYLES[deal.status];
              const Icon = s.icon;
              const isOpen = expanded === deal.id;
              const isTx = deal.source === "transaction";
              return (
                <li
                  key={deal.id}
                  className="rounded-2xl border border-[#1e1e2e] bg-[#12121e] p-3"
                >
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : deal.id)}
                    className="flex w-full items-start gap-3 text-left"
                    aria-expanded={isOpen}
                  >
                    <span
                      className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px] ${s.bg} ${s.text}`}
                    >
                      <Icon size={14} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider ${s.bg} ${s.text}`}
                        >
                          {STATUS_LABEL[deal.status]}
                        </span>
                        {deal.offer_amount != null ? (
                          <span className="text-[11px] font-semibold text-[#d0d0e0]">
                            {fmtMoney(deal.offer_amount)}
                          </span>
                        ) : null}
                        {isTx ? (
                          <span className="text-[9.5px] font-bold uppercase tracking-wider text-[#555570]">
                            From Transactions
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate text-[13px] font-semibold text-[#d0d0e0]">
                        {deal.property_address}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#555570]">
                        {deal.offer_date ? (
                          <>Offer {formatDate(deal.offer_date)}</>
                        ) : deal.accepted_date ? (
                          <>Accepted {formatDate(deal.accepted_date)}</>
                        ) : deal.closed_date ? (
                          <>Closed {formatDate(deal.closed_date)}</>
                        ) : (
                          <>Created {formatDate(deal.created_at)}</>
                        )}
                      </p>
                    </div>
                    <ChevronDown
                      size={14}
                      strokeWidth={2.5}
                      className={`mt-1 text-[#555570] transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  {isOpen ? (
                    <div className="mt-3 space-y-2 rounded-xl border border-[#1e1e2e] bg-[#0a0a15] p-3 text-[12px] text-[#9090a8]">
                      <div className="grid grid-cols-3 gap-2">
                        <DateStat label="Offer" value={formatDate(deal.offer_date)} />
                        <DateStat label="Accepted" value={formatDate(deal.accepted_date)} />
                        <DateStat label="Closed" value={formatDate(deal.closed_date)} />
                      </div>
                      {deal.fell_through_reason ? (
                        <p>
                          <span className="text-[#ff6060]">Fell through:</span>{" "}
                          {REASON_LABEL[deal.fell_through_reason]}
                        </p>
                      ) : null}
                      {deal.outcome ? (
                        <p>
                          <span className="text-[#666680]">Outcome:</span>{" "}
                          <span className="text-[#d0d0e0]">{deal.outcome}</span>
                        </p>
                      ) : null}
                      {deal.outcome_notes ? (
                        <p className="whitespace-pre-wrap text-[12px] text-[#b6b6c8]">
                          {deal.outcome_notes}
                        </p>
                      ) : null}
                      {!isTx ? (
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            onClick={() => setEditing(deal)}
                            className="inline-flex items-center gap-1 rounded-[8px] border border-[#1e1e2e] bg-[#12121e] px-2 py-1 text-[11px] text-[#9090a8] active:border-[#4f7bff]"
                          >
                            <Pencil size={11} /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(deal)}
                            className="inline-flex items-center gap-1 rounded-[8px] border border-[#1e1e2e] bg-[#12121e] px-2 py-1 text-[11px] text-[#ff6060] active:border-[#ff6060]/50"
                          >
                            <Trash2 size={11} /> Delete
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </CollapsibleSection>

      {creating ? (
        <DealModal
          clientId={clientId}
          onClose={() => setCreating(false)}
          onSaved={(d) => {
            upsertLocal(d);
            setCreating(false);
            toast.toast("Deal logged", "success");
          }}
        />
      ) : null}

      {editing ? (
        <DealModal
          clientId={clientId}
          deal={editing}
          onClose={() => setEditing(null)}
          onSaved={(d) => {
            upsertLocal(d);
            setEditing(null);
            toast.toast("Deal updated", "success");
          }}
        />
      ) : null}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete deal?"
        message={
          confirmDelete
            ? `Remove the deal for "${confirmDelete.property_address}"? This can't be undone.`
            : ""
        }
        confirmLabel="Delete"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => (confirmDelete ? remove(confirmDelete) : Promise.resolve())}
      />
    </>
  );
}

function DateStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-black/30 px-2 py-1.5">
      <p className="text-[9.5px] font-bold uppercase tracking-widest text-[#444460]">
        {label}
      </p>
      <p className="mt-0.5 text-[11.5px] font-semibold text-[#d0d0e0]">
        {value}
      </p>
    </div>
  );
}

function DealModal({
  clientId,
  deal,
  onClose,
  onSaved,
}: {
  clientId: string;
  deal?: DealRow;
  onClose: () => void;
  onSaved: (deal: DealRow) => void;
}) {
  const toast = useToast();
  const isEdit = !!deal;

  const [form, setForm] = useState({
    property_address: deal?.property_address ?? "",
    status: (deal?.status ?? "offer_made") as Status,
    offer_amount:
      deal?.offer_amount != null ? String(deal.offer_amount) : "",
    offer_date: deal?.offer_date ?? "",
    accepted_date: deal?.accepted_date ?? "",
    closed_date: deal?.closed_date ?? "",
    outcome: deal?.outcome ?? "",
    outcome_notes: deal?.outcome_notes ?? "",
    fell_through_reason: (deal?.fell_through_reason ?? "") as FellThroughReason | "",
  });
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!form.property_address.trim()) {
      toast.toast("Property address required", "warn");
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        client_id: clientId,
        property_address: form.property_address.trim(),
        status: form.status,
        offer_amount: form.offer_amount || null,
        offer_date: form.offer_date || null,
        accepted_date: form.accepted_date || null,
        closed_date: form.closed_date || null,
        outcome: form.outcome.trim() || null,
        outcome_notes: form.outcome_notes.trim() || null,
        fell_through_reason:
          form.status === "fell_through" ? form.fell_through_reason || null : null,
      };
      const url = isEdit ? `/api/client-deals/${deal!.id}` : "/api/client-deals";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.toast(String(json.error ?? "Could not save"), "warn");
        return;
      }
      if (json.deal) onSaved(json.deal as DealRow);
    } catch {
      toast.toast("Network error", "warn");
    } finally {
      setSubmitting(false);
    }
  }

  const statusOptions: Status[] = [
    "offer_made",
    "offer_accepted",
    "under_contract",
    "closed",
    "fell_through",
    "cancelled",
  ];

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 px-4 pb-6 pt-20 sm:items-center">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-[18px] border border-[#1e1e2e] bg-[#0e0e18]">
        <div className="flex items-center justify-between border-b border-[#1e1e2e] p-4">
          <h3 className="text-[15px] font-semibold text-[#f0eee8]">
            {isEdit ? "Edit deal" : "Log deal"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full border-[0.5px] border-[#1e1e2e] text-[#9090a8]"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <Field label="Property address">
            <input
              value={form.property_address}
              onChange={(e) => setForm({ ...form, property_address: e.target.value })}
              placeholder="123 Oak Street, Westfield NJ"
              className="w-full rounded-[10px] border border-[#1e1e2e] bg-[#0a0a15] px-3 py-2 text-[13px] text-[#d0d0e0] outline-none placeholder:text-[#444460] focus:border-[#4f7bff]/40"
            />
          </Field>

          <Field label="Status">
            <select
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value as Status })
              }
              className="w-full rounded-[10px] border border-[#1e1e2e] bg-[#0a0a15] px-3 py-2 text-[13px] text-[#d0d0e0] outline-none focus:border-[#4f7bff]/40"
            >
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Offer amount ($)">
            <input
              inputMode="decimal"
              value={form.offer_amount}
              onChange={(e) =>
                setForm({ ...form, offer_amount: e.target.value })
              }
              placeholder="750000"
              className="w-full rounded-[10px] border border-[#1e1e2e] bg-[#0a0a15] px-3 py-2 text-[13px] text-[#d0d0e0] outline-none placeholder:text-[#444460] focus:border-[#4f7bff]/40"
            />
          </Field>

          <div className="grid grid-cols-3 gap-2">
            <Field label="Offer date">
              <input
                type="date"
                value={form.offer_date}
                onChange={(e) =>
                  setForm({ ...form, offer_date: e.target.value })
                }
                className="w-full rounded-[10px] border border-[#1e1e2e] bg-[#0a0a15] px-2.5 py-2 text-[12px] text-[#d0d0e0] outline-none"
              />
            </Field>
            <Field label="Accepted">
              <input
                type="date"
                value={form.accepted_date}
                onChange={(e) =>
                  setForm({ ...form, accepted_date: e.target.value })
                }
                className="w-full rounded-[10px] border border-[#1e1e2e] bg-[#0a0a15] px-2.5 py-2 text-[12px] text-[#d0d0e0] outline-none"
              />
            </Field>
            <Field label="Closed">
              <input
                type="date"
                value={form.closed_date}
                onChange={(e) =>
                  setForm({ ...form, closed_date: e.target.value })
                }
                className="w-full rounded-[10px] border border-[#1e1e2e] bg-[#0a0a15] px-2.5 py-2 text-[12px] text-[#d0d0e0] outline-none"
              />
            </Field>
          </div>

          {form.status === "fell_through" ? (
            <Field label="Why did it fall through?">
              <select
                value={form.fell_through_reason}
                onChange={(e) =>
                  setForm({
                    ...form,
                    fell_through_reason: e.target.value as FellThroughReason | "",
                  })
                }
                className="w-full rounded-[10px] border border-[#1e1e2e] bg-[#0a0a15] px-3 py-2 text-[13px] text-[#d0d0e0] outline-none focus:border-[#4f7bff]/40"
              >
                <option value="">Select reason…</option>
                {(
                  Object.keys(REASON_LABEL) as FellThroughReason[]
                ).map((r) => (
                  <option key={r} value={r}>
                    {REASON_LABEL[r]}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}

          <Field label="Outcome (short)">
            <input
              value={form.outcome}
              onChange={(e) => setForm({ ...form, outcome: e.target.value })}
              placeholder="e.g. Accepted, closed 45 days"
              className="w-full rounded-[10px] border border-[#1e1e2e] bg-[#0a0a15] px-3 py-2 text-[13px] text-[#d0d0e0] outline-none placeholder:text-[#444460] focus:border-[#4f7bff]/40"
            />
          </Field>

          <Field label="Notes">
            <textarea
              value={form.outcome_notes}
              onChange={(e) =>
                setForm({ ...form, outcome_notes: e.target.value })
              }
              rows={3}
              placeholder="What happened with this deal…"
              className="w-full resize-none rounded-[10px] border border-[#1e1e2e] bg-[#0a0a15] px-3 py-2 text-[13px] text-[#d0d0e0] outline-none placeholder:text-[#444460] focus:border-[#4f7bff]/40"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-[#1e1e2e] p-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[10px] border-[0.5px] border-[#2a2a3e] bg-[#12121e] py-2.5 text-[13px] font-semibold text-[#9090a8]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="rounded-[10px] bg-gradient-to-br from-[#4f7bff] to-[#7c5cfc] py-2.5 text-[13px] font-semibold text-white disabled:opacity-60"
          >
            {submitting ? "Saving…" : isEdit ? "Save changes" : "Save deal"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#444460]">
        {label}
      </span>
      {children}
    </label>
  );
}

export default DealHistorySection;

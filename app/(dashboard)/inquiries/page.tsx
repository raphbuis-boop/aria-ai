"use client";

import { useToast } from "@/components/ToastProvider";
import { fmtMoney, relTime } from "@/lib/utils";
import { Loader2, Mail, MessageSquare, Phone, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Inquiry = {
  id: string;
  created_at: string;
  intent: "info" | "showing";
  visitor_name: string;
  visitor_email: string;
  visitor_phone: string | null;
  message: string | null;
  listing_id: string;
  listing_address: string | null;
  listing_price: number | null;
  mls_number: string | null;
  status: "new" | "contacted" | "converted" | "archived";
  source: string;
};

type FilterTab = "all" | "new" | "contacted" | "converted" | "archived";

const TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "converted", label: "Converted" },
  { key: "archived", label: "Archived" },
];

const STATUS_LABELS: Record<Inquiry["status"], string> = {
  new: "New",
  contacted: "Contacted",
  converted: "Converted",
  archived: "Archived",
};

const STATUS_COLORS: Record<Inquiry["status"], string> = {
  new: "bg-accent-blue/15 text-accent-blue",
  contacted: "bg-amber-500/15 text-amber-400",
  converted: "bg-emerald-500/15 text-emerald-400",
  archived: "bg-[#2a2a3e] text-text-dim",
};

function InquiryDetailPanel({
  inquiry,
  onClose,
  onStatusChange,
}: {
  inquiry: Inquiry;
  onClose: () => void;
  onStatusChange: (id: string, status: Inquiry["status"]) => void;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  async function changeStatus(status: Inquiry["status"]) {
    setSaving(true);
    try {
      const res = await fetch(`/api/listing-inquiries/${inquiry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        toast.toast("Could not update status", "warn");
        return;
      }
      onStatusChange(inquiry.id, status);
      toast.toast(`Marked as ${STATUS_LABELS[status]}`, "success");
    } catch {
      toast.toast("Network error", "warn");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 backdrop-blur-[2px] md:items-center">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg rounded-t-[24px] border-[0.5px] border-b-0 border-[#1e1e2e] bg-[#0f0f1a] px-5 pb-10 pt-4 md:max-h-[85vh] md:overflow-y-auto md:rounded-[20px] md:border-b-[0.5px]">
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-[#2a2a3e] md:hidden" />

        {/* header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[16px] font-semibold text-text-primary">
              {inquiry.visitor_name}
            </p>
            <p className="mt-0.5 text-[12px] text-text-dim">
              {inquiry.intent === "showing" ? "Showing request" : "Info request"}{" "}
              · {relTime(inquiry.created_at)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#1a1a2e] text-text-dim"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        {/* contact */}
        <div className="mb-4 space-y-2 rounded-[12px] border border-border-card bg-bg-card px-3 py-3">
          <a
            href={`mailto:${inquiry.visitor_email}`}
            className="flex items-center gap-2 text-[13px] text-accent-blue"
          >
            <Mail size={14} className="flex-shrink-0" />
            {inquiry.visitor_email}
          </a>
          {inquiry.visitor_phone ? (
            <a
              href={`tel:${inquiry.visitor_phone}`}
              className="flex items-center gap-2 text-[13px] text-accent-blue"
            >
              <Phone size={14} className="flex-shrink-0" />
              {inquiry.visitor_phone}
            </a>
          ) : null}
        </div>

        {/* listing */}
        <div className="mb-4 rounded-[12px] border border-border-card bg-bg-card px-3 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-text-dim">
            Listing
          </p>
          <p className="mt-1 text-[13px] font-medium text-text-primary">
            {inquiry.listing_address ?? inquiry.listing_id}
          </p>
          <div className="mt-1 flex flex-wrap gap-x-3 text-[12px] text-text-dim">
            {inquiry.listing_price ? (
              <span>{fmtMoney(inquiry.listing_price)}</span>
            ) : null}
            {inquiry.mls_number ? <span>#{inquiry.mls_number}</span> : null}
          </div>
        </div>

        {/* message */}
        {inquiry.message ? (
          <div className="mb-4 rounded-[12px] border border-border-card bg-bg-card px-3 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-text-dim">
              Message
            </p>
            <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-text-primary">
              {inquiry.message}
            </p>
          </div>
        ) : null}

        {/* status */}
        <div className="mb-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-text-dim">
            Status
          </p>
          <div className="flex flex-wrap gap-2">
            {(["new", "contacted", "converted", "archived"] as const).map(
              (s) => (
                <button
                  key={s}
                  type="button"
                  disabled={saving || inquiry.status === s}
                  onClick={() => void changeStatus(s)}
                  className={`rounded-[8px] px-3 py-1.5 text-[12px] font-semibold transition ${
                    inquiry.status === s
                      ? STATUS_COLORS[s]
                      : "border border-border-card bg-bg-deep text-text-dim hover:text-text-primary"
                  } disabled:cursor-not-allowed`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ),
            )}
          </div>
        </div>

        {/* convert to client */}
        <button
          type="button"
          onClick={() => toast.toast("Convert to Client coming in Session 2", "default")}
          className="w-full rounded-[10px] border border-dashed border-border-card bg-bg-deep py-2.5 text-[13px] font-semibold text-text-dim"
        >
          + Convert to Client
        </button>
      </div>
    </div>
  );
}

export default function InquiriesPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FilterTab>("all");
  const [selected, setSelected] = useState<Inquiry | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/listing-inquiries");
      if (!res.ok) return;
      const data = (await res.json()) as { inquiries: Inquiry[] };
      setInquiries(data.inquiries ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function handleStatusChange(id: string, status: Inquiry["status"]) {
    setInquiries((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status } : i)),
    );
    setSelected((prev) => (prev?.id === id ? { ...prev, status } : prev));
  }

  const filtered =
    tab === "all" ? inquiries : inquiries.filter((i) => i.status === tab);

  const newCount = inquiries.filter((i) => i.status === "new").length;

  return (
    <div className="mx-auto max-w-lg px-4 pb-32 pt-6">
      {/* header */}
      <div className="mb-5 flex items-center gap-3">
        <h1 className="text-[22px] font-semibold text-text-primary">
          Inquiries
        </h1>
        {newCount > 0 && (
          <span className="rounded-[6px] bg-accent-blue/15 px-2 py-0.5 text-[11px] font-bold text-accent-blue">
            {newCount} new
          </span>
        )}
      </div>

      {/* filter tabs */}
      <div className="mb-4 flex gap-1 overflow-x-auto pb-1">
        {TABS.map(({ key, label }) => {
          const count =
            key === "all"
              ? inquiries.length
              : inquiries.filter((i) => i.status === key).length;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex-shrink-0 rounded-[8px] px-3 py-1.5 text-[12px] font-semibold transition ${
                tab === key
                  ? "bg-[#1e1e38] text-white"
                  : "text-text-dim hover:text-text-primary"
              }`}
            >
              {label}
              {count > 0 ? (
                <span className="ml-1.5 text-[11px] opacity-60">{count}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-text-dim" size={24} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-[14px] bg-bg-card text-text-dim">
            <MessageSquare size={22} />
          </div>
          <p className="text-[15px] font-medium text-text-primary">
            {tab === "all" ? "No inquiries yet" : `No ${tab} inquiries`}
          </p>
          <p className="mt-1 max-w-[260px] text-[13px] text-text-dim">
            {tab === "all"
              ? "When buyers fill out the contact form on your public property pages, they'll show up here."
              : `Move inquiries to "${tab}" by opening one and updating its status.`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((inq) => (
            <button
              key={inq.id}
              type="button"
              onClick={() => setSelected(inq)}
              className="w-full rounded-[14px] border border-border-card bg-bg-card px-4 py-3 text-left transition hover:border-[#2a2a4e]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[14px] font-semibold text-text-primary">
                      {inq.visitor_name}
                    </p>
                    {inq.status === "new" && (
                      <span className="flex-shrink-0 rounded-[4px] bg-accent-blue px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                        New
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-text-dim">
                    {inq.visitor_email}
                    {inq.visitor_phone ? ` · ${inq.visitor_phone}` : ""}
                  </p>
                  {inq.listing_address ? (
                    <p className="mt-1 truncate text-[12px] text-text-muted">
                      {inq.intent === "showing" ? "Showing · " : "Info · "}
                      {inq.listing_address}
                    </p>
                  ) : null}
                  {inq.message ? (
                    <p className="mt-1 line-clamp-1 text-[12px] text-text-dim">
                      &quot;{inq.message}&quot;
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                  <span className={`rounded-[6px] px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[inq.status]}`}>
                    {STATUS_LABELS[inq.status]}
                  </span>
                  <span className="text-[11px] text-text-dim">
                    {relTime(inq.created_at)}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected ? (
        <InquiryDetailPanel
          inquiry={selected}
          onClose={() => setSelected(null)}
          onStatusChange={handleStatusChange}
        />
      ) : null}
    </div>
  );
}

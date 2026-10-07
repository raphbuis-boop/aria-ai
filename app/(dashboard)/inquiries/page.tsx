"use client";

import { useToast } from "@/components/ToastProvider";
import { fmtMoney, relTime } from "@/lib/utils";
import { Mail, MessageSquare, Phone, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { SkeletonRegion, SkeletonRows } from "@/components/Skeleton";

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
  new: "bg-primary/15 text-primary",
  contacted: "bg-warning/15 text-warning",
  converted: "bg-success/15 text-success",
  archived: "bg-input text-muted-foreground",
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
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-scrim backdrop-blur-[2px] md:items-center" role="dialog" aria-modal="true" aria-label="Inquiry">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg rounded-t-[24px] border-[0.5px] border-b-0 border-border bg-card px-5 pb-10 pt-4 md:max-h-[85vh] md:overflow-y-auto md:rounded-[20px] md:border-b-[0.5px]">
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-input md:hidden" />

        {/* header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[16px] font-semibold text-foreground">
              {inquiry.visitor_name}
            </p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              {inquiry.intent === "showing" ? "Showing request" : "Info request"}{" "}
              · {relTime(inquiry.created_at)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-border text-muted-foreground"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        {/* contact */}
        <div className="mb-4 space-y-2 rounded-[12px] border border-border bg-card px-3 py-3">
          <a
            href={`mailto:${inquiry.visitor_email}`}
            className="flex items-center gap-2 text-[13px] text-primary"
          >
            <Mail size={14} className="flex-shrink-0" />
            {inquiry.visitor_email}
          </a>
          {inquiry.visitor_phone ? (
            <a
              href={`tel:${inquiry.visitor_phone}`}
              className="flex items-center gap-2 text-[13px] text-primary"
            >
              <Phone size={14} className="flex-shrink-0" />
              {inquiry.visitor_phone}
            </a>
          ) : null}
        </div>

        {/* listing */}
        <div className="mb-4 rounded-[12px] border border-border bg-card px-3 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Listing
          </p>
          <p className="mt-1 text-[13px] font-medium text-foreground">
            {inquiry.listing_address ?? inquiry.listing_id}
          </p>
          <div className="mt-1 flex flex-wrap gap-x-3 text-[12px] text-muted-foreground">
            {inquiry.listing_price ? (
              <span>{fmtMoney(inquiry.listing_price)}</span>
            ) : null}
            {inquiry.mls_number ? <span>#{inquiry.mls_number}</span> : null}
          </div>
        </div>

        {/* message */}
        {inquiry.message ? (
          <div className="mb-4 rounded-[12px] border border-border bg-card px-3 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Message
            </p>
            <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">
              {inquiry.message}
            </p>
          </div>
        ) : null}

        {/* status */}
        <div className="mb-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
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
                      : "border border-border bg-secondary text-muted-foreground hover:text-foreground"
                  } disabled:cursor-not-allowed`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ),
            )}
          </div>
        </div>

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
        <h1 className="font-heading text-[34px] leading-tight text-foreground">
          Inquiries
        </h1>
        {newCount > 0 && (
          <span className="rounded-[6px] bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-primary">
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
              aria-pressed={tab === key}
              className={`flex-shrink-0 rounded-[8px] px-3 py-1.5 text-[12px] font-semibold transition ${
                tab === key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
              {count > 0 ? (
                <span className="ml-1.5 text-[11px]">{count}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* list */}
      {loading ? (
        <SkeletonRegion label="Loading inquiries…">
          <SkeletonRows count={4} />
        </SkeletonRegion>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-[14px] bg-card text-muted-foreground">
            <MessageSquare size={22} />
          </div>
          <p className="text-[15px] font-medium text-foreground">
            {tab === "all" ? "No inquiries yet" : `No ${tab} inquiries`}
          </p>
          <p className="mt-1 max-w-[260px] text-[13px] text-muted-foreground">
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
              className="w-full rounded-[14px] border border-border bg-card px-4 py-3 text-left transition hover:border-input"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[14px] font-semibold text-foreground">
                      {inq.visitor_name}
                    </p>
                    {inq.status === "new" && (
                      <span className="flex-shrink-0 rounded-[4px] bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary-foreground">
                        New
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                    {inq.visitor_email}
                    {inq.visitor_phone ? ` · ${inq.visitor_phone}` : ""}
                  </p>
                  {inq.listing_address ? (
                    <p className="mt-1 truncate text-[12px] text-muted-foreground">
                      {inq.intent === "showing" ? "Showing · " : "Info · "}
                      {inq.listing_address}
                    </p>
                  ) : null}
                  {inq.message ? (
                    <p className="mt-1 line-clamp-1 text-[12px] text-muted-foreground">
                      &quot;{inq.message}&quot;
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                  <span className={`rounded-[6px] px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[inq.status]}`}>
                    {STATUS_LABELS[inq.status]}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
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

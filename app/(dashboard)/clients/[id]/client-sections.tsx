"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Check,
  Copy,
  Download,
  FileSignature,
  FileText,
  Home as HomeIcon,
  Mail,
  MessageSquare,
  Paperclip,
  Pencil,
  Phone,
  Send,
  Sparkles,
  Upload,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { EmptyNote, Pill, Section } from "@/components/Section";
import { IdxComplianceNotice } from "@/components/IdxComplianceNotice";
import { createClient } from "@/lib/supabase/client";
import { CLIENT_STATUSES } from "@/lib/client-brief";
import { fmtMoney, fmtDateTime, formatPhoneE164, relTime } from "@/lib/utils";
import type { SendableProperty } from "@/components/aria/SendPropertySheet";

// ── Preferences ────────────────────────────────────────────────────────────

export type Preferences = {
  name: string;
  status: string | null;
  client_role: string | null;
  budget_min: number | null;
  budget_max: number | null;
  preferred_towns: string[] | null;
  town: string | null;
  beds_wanted: number | null;
  baths_wanted: number | null;
  timeline: string | null;
  notes: string | null;
  phone: string | null;
  email: string | null;
};

const FIELD =
  "w-full rounded-xl border border-transparent bg-secondary px-3.5 py-2.5 font-display text-body text-foreground outline-none focus:border-input";

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <p className="font-display text-caption text-muted-foreground">{label}</p>
      <p className={`mt-0.5 break-words font-display text-body ${value ? "text-foreground" : "text-muted-foreground/60"}`}>
        {value ?? "—"}
      </p>
    </div>
  );
}

function numOrNull(v: string): number | null {
  const n = Number(v.replace(/[$,\s]/g, ""));
  return v.trim() && Number.isFinite(n) ? n : null;
}

/** What Aria (and the agent) know about the client's search. Aria's SMS
 * extraction writes these same columns, so they update as the lead texts. */
export function PreferencesCard({ clientId, prefs }: { clientId: string; prefs: Preferences }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const towns = prefs.preferred_towns?.length ? prefs.preferred_towns : prefs.town ? [prefs.town] : [];
  const [form, setForm] = useState({
    name: prefs.name,
    phone: prefs.phone ?? "",
    email: prefs.email ?? "",
    status: prefs.status ?? "new",
    client_role: prefs.client_role ?? "buyer",
    budget_min: prefs.budget_min?.toString() ?? "",
    budget_max: prefs.budget_max?.toString() ?? "",
    towns: towns.join(", "),
    beds: prefs.beds_wanted?.toString() ?? "",
    baths: prefs.baths_wanted?.toString() ?? "",
    timeline: prefs.timeline ?? "",
    notes: prefs.notes ?? "",
  });

  async function save() {
    const phone = form.phone.trim() ? formatPhoneE164(form.phone) : null;
    if (form.phone.trim() && !phone) {
      toast.error("That phone number doesn't look right");
      return;
    }
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    const townList = form.towns.split(",").map((t) => t.trim()).filter(Boolean);
    const { error } = await createClient()
      .from("clients")
      .update({
        name: form.name.trim(),
        phone,
        email: form.email.trim() || null,
        status: form.status,
        client_role: form.client_role,
        budget_min: numOrNull(form.budget_min),
        budget_max: numOrNull(form.budget_max),
        preferred_towns: townList.length ? townList : null,
        town: townList[0] ?? null,
        beds_wanted: numOrNull(form.beds),
        baths_wanted: numOrNull(form.baths),
        timeline: form.timeline.trim() || null,
        notes: form.notes.trim() || null,
      })
      .eq("id", clientId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Saved");
    setEditing(false);
    router.refresh();
  }

  const budget =
    prefs.budget_min && prefs.budget_max
      ? `${fmtMoney(prefs.budget_min)} – ${fmtMoney(prefs.budget_max)}`
      : prefs.budget_max
        ? `Up to ${fmtMoney(prefs.budget_max)}`
        : prefs.budget_min
          ? `${fmtMoney(prefs.budget_min)}+`
          : null;

  return (
    <section className="mb-10">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-section uppercase text-muted-foreground">Looking for</h2>
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 font-display text-caption font-semibold text-primary"
          >
            <Pencil className="size-3" /> Edit
          </button>
        ) : null}
      </div>
      <Card className="px-5 py-5">
        {!editing ? (
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <Fact label="Budget" value={budget} />
            <Fact label="Towns" value={towns.length ? towns.join(", ") : null} />
            <Fact
              label="Beds / baths"
              value={prefs.beds_wanted || prefs.baths_wanted ? `${prefs.beds_wanted ?? "—"} bd · ${prefs.baths_wanted ?? "—"} ba` : null}
            />
            <Fact label="Timeline" value={prefs.timeline} />
            <div className="col-span-2">
              <Fact label="Notes" value={prefs.notes} />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <input className={FIELD} placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-label="Full name" />
            <div className="grid grid-cols-2 gap-2">
              <input className={FIELD} inputMode="tel" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} aria-label="Phone" />
              <input className={FIELD} inputMode="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} aria-label="Email" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block font-display text-caption text-muted-foreground">Stage</span>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={FIELD}>
                  {CLIENT_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block font-display text-caption text-muted-foreground">Role</span>
                <select value={form.client_role} onChange={(e) => setForm({ ...form, client_role: e.target.value })} className={FIELD}>
                  <option value="buyer">Buyer</option>
                  <option value="seller">Seller</option>
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input className={FIELD} inputMode="numeric" placeholder="Budget min" value={form.budget_min} onChange={(e) => setForm({ ...form, budget_min: e.target.value })} aria-label="Budget min" />
              <input className={FIELD} inputMode="numeric" placeholder="Budget max" value={form.budget_max} onChange={(e) => setForm({ ...form, budget_max: e.target.value })} aria-label="Budget max" />
            </div>
            <input className={FIELD} placeholder="Towns, comma separated" value={form.towns} onChange={(e) => setForm({ ...form, towns: e.target.value })} aria-label="Towns" />
            <div className="grid grid-cols-3 gap-2">
              <input className={FIELD} inputMode="numeric" placeholder="Beds" value={form.beds} onChange={(e) => setForm({ ...form, beds: e.target.value })} aria-label="Beds" />
              <input className={FIELD} inputMode="decimal" placeholder="Baths" value={form.baths} onChange={(e) => setForm({ ...form, baths: e.target.value })} aria-label="Baths" />
              <input className={FIELD} placeholder="Timeline" value={form.timeline} onChange={(e) => setForm({ ...form, timeline: e.target.value })} aria-label="Timeline" />
            </div>
            <textarea className={`${FIELD} resize-none`} rows={3} placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} aria-label="Notes" />
            <div className="flex gap-2">
              <Button onClick={save} disabled={saving} className="flex-1 rounded-xl">
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button variant="outline" onClick={() => setEditing(false)} className="rounded-xl">
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Card>
    </section>
  );
}

// ── Recommended homes ──────────────────────────────────────────────────────

export type MatchedHome = SendableProperty & {
  status: string | null;
  photo: string | null;
  score: number;
  sent: "aria" | "agent" | null;
};

export function HomesCard({
  homes,
  canSend,
  onSend,
}: {
  homes: MatchedHome[];
  canSend: boolean;
  onSend: (home: MatchedHome) => void;
}) {
  return (
    <Section label="Homes for them" action={{ href: "/properties", label: "All properties →" }}>
      {homes.length === 0 ? (
        <EmptyNote>No matching homes in your properties yet. Aria recommends homes here as the search takes shape.</EmptyNote>
      ) : (
        <>
          <Card className="divide-y divide-border overflow-hidden">
            {homes.map((h) => (
              <div key={h.id} className="flex items-center gap-3.5 px-4 py-3.5">
                <Link href={`/properties/${h.id}`} className="flex min-w-0 flex-1 items-center gap-3.5">
                  <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-secondary">
                    {h.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={h.photo} alt="" className="size-full object-cover" />
                    ) : (
                      <HomeIcon className="size-4 text-muted-foreground" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-body font-semibold text-foreground">
                      {h.address ?? "Address unavailable"}
                    </span>
                    <span className="block truncate font-display text-caption text-muted-foreground">
                      {[fmtMoney(h.price), h.beds != null ? `${h.beds} bd` : null, h.baths != null ? `${h.baths} ba` : null, `${h.score}% fit`]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    {h.sent ? (
                      <Pill tone="primary" className="mt-1">
                        {h.sent === "aria" ? (
                          <>
                            <Sparkles className="size-3" /> Sent by Aria
                          </>
                        ) : (
                          <>
                            <Check className="size-3" /> Sent
                          </>
                        )}
                      </Pill>
                    ) : null}
                  </span>
                </Link>
                {canSend ? (
                  <Button size="sm" variant={h.sent ? "outline" : "default"} onClick={() => onSend(h)} className="h-9 shrink-0 rounded-full px-3">
                    <Send className="size-3.5" /> {h.sent ? "Resend" : "Send"}
                  </Button>
                ) : null}
              </div>
            ))}
          </Card>
          <div className="mt-3">
            <IdxComplianceNotice compact />
          </div>
        </>
      )}
    </Section>
  );
}

// ── Showings ───────────────────────────────────────────────────────────────

export type ShowingItem = {
  id: string;
  address: string | null;
  showing_date: string | null;
  status: string | null;
  requested_time_text: string | null;
  notes: string | null;
  created_at: string;
};

const SHOWING_TONE: Record<string, { label: string; tone: "primary" | "warm" | "neutral" | "hot" }> = {
  requested: { label: "Needs approval", tone: "warm" },
  scheduled: { label: "Booked", tone: "primary" },
  completed: { label: "Done", tone: "neutral" },
  declined: { label: "Declined", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export function ShowingsCard({ showings }: { showings: ShowingItem[] }) {
  const rest = showings.filter((s) => s.status !== "requested");
  if (!rest.length) return null;
  return (
    <Section label="Showings">
      <Card className="divide-y divide-border overflow-hidden">
        {rest.map((s) => {
          const t = SHOWING_TONE[s.status ?? ""] ?? { label: s.status ?? "—", tone: "neutral" as const };
          return (
            <div key={s.id} className="flex items-center gap-3.5 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-body font-semibold text-foreground">{s.address ?? "Address TBD"}</p>
                <p className="font-display text-caption text-muted-foreground">
                  {s.showing_date ? fmtDateTime(s.showing_date) : s.requested_time_text ?? "No time set"}
                </p>
              </div>
              <Pill tone={t.tone}>{t.label}</Pill>
            </div>
          );
        })}
      </Card>
    </Section>
  );
}

// ── BBA + documents ────────────────────────────────────────────────────────

export type SignedBba = {
  signed_at: string;
  commission_pct: number;
  term_start: string;
  term_end: string;
  search_area: string | null;
  signed_pdf_url: string | null;
} | null;

type Doc = { id: string; category: string; file_name: string; uploaded_at: string; signed_url: string | null };

const DOC_CATEGORIES = [
  ["purchase_offer", "Offer"],
  ["counter_offer", "Counter offer"],
  ["inspection_report", "Inspection"],
  ["disclosure", "Disclosure"],
  ["appraisal", "Appraisal"],
  ["mortgage_docs", "Mortgage"],
  ["closing_docs", "Closing"],
  ["bba", "BBA"],
  ["other", "Other"],
] as const;

export function BbaAndDocsCard({
  clientId,
  firstName,
  bba,
  canText,
}: {
  clientId: string;
  firstName: string;
  bba: SignedBba;
  canText: boolean;
}) {
  const router = useRouter();
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [category, setCategory] = useState<string>("other");
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const signingUrl = typeof window === "undefined" ? `/bba/sign/${clientId}` : `${window.location.origin}/bba/sign/${clientId}`;

  const loadDocs = useCallback(async () => {
    try {
      const res = await fetch(`/api/client-documents?clientId=${clientId}`, { cache: "no-store" });
      const json = await res.json();
      setDocs(res.ok ? (json.documents ?? []) : []);
    } catch {
      setDocs([]);
    }
  }, [clientId]);

  useEffect(() => {
    void loadDocs();
  }, [loadDocs]);

  async function upload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("clientId", clientId);
      fd.append("category", category);
      fd.append("file", file);
      const res = await fetch("/api/client-documents", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      toast.success("Uploaded");
      void loadDocs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function textLink() {
    setSending(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/aria`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          body: `Hi ${firstName} — before we tour, NJ requires a quick Buyer Broker Agreement. It takes 30 seconds on your phone: ${signingUrl}`,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Couldn't send");
      toast.success("Signing link texted");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send");
    } finally {
      setSending(false);
    }
  }

  return (
    <Section label="Agreement & documents">
      <Card className="divide-y divide-border overflow-hidden">
        <div className="flex items-start gap-3 px-5 py-4">
          <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${bba ? "bg-primary/10" : "bg-secondary"}`}>
            {bba ? <Check className="size-3.5 text-primary" /> : <FileSignature className="size-3.5 text-muted-foreground" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-body font-semibold text-foreground">
              Buyer Broker Agreement · {bba ? `signed ${new Date(bba.signed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : "not signed"}
            </p>
            {bba ? (
              <>
                <p className="font-display text-caption text-muted-foreground">
                  {bba.commission_pct}% · {bba.term_start} → {bba.term_end}
                  {bba.search_area ? ` · ${bba.search_area}` : ""}
                </p>
                {bba.signed_pdf_url ? (
                  <a href={bba.signed_pdf_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 font-display text-caption font-semibold text-primary">
                    <Download className="size-3.5" /> Signed PDF
                  </a>
                ) : null}
              </>
            ) : (
              <>
                <p className="font-display text-caption text-muted-foreground">
                  Aria texts the signing link automatically when you approve a showing.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {canText ? (
                    <Button size="sm" onClick={textLink} disabled={sending} className="rounded-full">
                      <MessageSquare className="size-3.5" /> {sending ? "Sending…" : "Text signing link"}
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => {
                      void navigator.clipboard?.writeText(signingUrl).then(
                        () => toast.success("Link copied"),
                        () => toast.error("Couldn't copy"),
                      );
                    }}
                  >
                    <Copy className="size-3.5" /> Copy link
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>

        {docs === null ? (
          <p className="px-5 py-4 font-display text-caption text-muted-foreground">Loading documents…</p>
        ) : (
          docs.map((d) => (
            <a
              key={d.id}
              href={d.signed_url ?? "#"}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 px-5 py-3.5 hover:bg-secondary/50"
            >
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-body text-foreground">{d.file_name}</span>
                <span className="block font-display text-caption text-muted-foreground">
                  {DOC_CATEGORIES.find(([v]) => v === d.category)?.[1] ?? d.category} · {relTime(d.uploaded_at)}
                </span>
              </span>
            </a>
          ))
        )}

        <div className="flex items-center gap-2 px-5 py-3.5">
          <Paperclip className="size-4 shrink-0 text-muted-foreground" />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Document type"
            className="min-w-0 flex-1 bg-transparent font-display text-body text-foreground outline-none"
          >
            {DOC_CATEGORIES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border px-3 py-1.5 font-display text-caption font-semibold text-foreground ${uploading ? "opacity-50" : ""}`}>
            <Upload className="size-3.5" /> {uploading ? "Uploading…" : "Upload"}
            <input
              type="file"
              className="sr-only"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void upload(f);
              }}
            />
          </label>
        </div>
      </Card>
    </Section>
  );
}

// ── Timeline (everything that isn't a text) ────────────────────────────────

export type TimelineActivity = {
  id: string;
  type: string | null;
  direction: string | null;
  body: string | null;
  created_at: string;
};

const TYPE_META: Record<string, { icon: typeof MessageSquare; label: string }> = {
  call: { icon: Phone, label: "Call" },
  email: { icon: Mail, label: "Email" },
  showing: { icon: HomeIcon, label: "Showing" },
  note: { icon: FileText, label: "Note" },
  offer: { icon: FileText, label: "Offer" },
  whatsapp: { icon: MessageSquare, label: "WhatsApp" },
};

export function TimelineCard({ items }: { items: TimelineActivity[] }) {
  return (
    <Section label="Timeline">
      {items.length === 0 ? (
        <EmptyNote>Nothing logged yet.</EmptyNote>
      ) : (
        <Card className="divide-y divide-border overflow-hidden">
          {items.map((a) => {
            const meta = TYPE_META[a.type ?? ""] ?? { icon: FileText, label: "Activity" };
            const Icon = meta.icon;
            return (
              <div key={a.id} className="flex gap-3.5 px-5 py-3.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <Icon className="size-3.5 text-muted-foreground" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-display text-body font-semibold text-foreground">{meta.label}</p>
                    <span className="shrink-0 font-display text-caption text-muted-foreground">{relTime(a.created_at)}</span>
                  </div>
                  {a.body ? <p className="mt-0.5 font-display text-body text-muted-foreground">{a.body}</p> : null}
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </Section>
  );
}

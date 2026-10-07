"use client";

import { NJ_TOWN_OPTIONS } from "@/lib/nj-towns";
import { createClient } from "@/lib/supabase/client";
import { fmtMoney, formatPhoneE164, humanizeSource, relTime } from "@/lib/utils";
import { heatFromScore, computeLeadScore } from "@/lib/today-items";
import type { TodayActivity, TodayTransaction, TodayClient } from "@/lib/today-items";
import { statusShortLabel } from "@/lib/client-brief";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Toaster, toast } from "@/components/ui/sonner";
import { Search, Sparkles, Users, X } from "lucide-react";
import { Avatar, Pill } from "@/components/Section";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const FILTERS = ["All", "New", "Aria texting", "Hot", "Showing", "Under contract", "Closed"] as const;

// Shared input style — ivory design system.
const INPUT =
  "w-full rounded-xl px-4 py-3 outline-none font-display text-body text-foreground placeholder:text-muted-foreground bg-secondary border border-input focus:border-ring";

type Row = {
  id: string;
  name: string;
  town: string | null;
  preferred_towns?: string[] | null;
  status: string | null;
  lead_score: number | null;
  budget_min: number | null;
  budget_max: number | null;
  phone?: string | null;
  email?: string | null;
  client_role?: string | null;
  source?: string | null;
  lead_source?: string | null;
  aria_paused?: boolean | null;
  sms_opted_out?: boolean | null;
  created_at?: string | null;
  dealValue: number | null;
  dealValueIsReal: boolean;
  commissionEst: number | null;
  lastText: { body: string | null; inbound: boolean } | null;
  lastContactAt: string | null;
  ariaThread: boolean;
};

function budgetLabel(min: number | null, max: number | null): string | null {
  if (min && max) return `${fmtMoney(min)}–${fmtMoney(max)}`;
  if (max) return `≤ ${fmtMoney(max)}`;
  if (min) return `${fmtMoney(min)}+`;
  return null;
}

function ariaState(c: Row): "texting" | "paused" | "opted_out" | null {
  if (c.sms_opted_out) return "opted_out";
  if (!c.ariaThread) return null;
  return c.aria_paused ? "paused" : "texting";
}

function ClientRow({ client }: { client: Row }) {
  const heat = heatFromScore(client.lead_score);
  const aria = ariaState(client);
  const towns = client.preferred_towns?.length ? client.preferred_towns.join(", ") : client.town;
  const meta = [
    humanizeSource(client.lead_source ?? client.source ?? null),
    towns,
    budgetLabel(client.budget_min, client.budget_max),
  ].filter(Boolean);

  return (
    <Link href={`/clients/${client.id}`} className="flex items-start gap-3.5 px-5 py-4 hover:bg-secondary/50">
      <Avatar name={client.name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="flex min-w-0 items-center gap-2">
            <span className="truncate font-display text-body-lg font-semibold text-foreground">{client.name}</span>
            {heat !== "cold" ? (
              <span className={`size-2 shrink-0 rounded-full ${heat === "hot" ? "bg-hot" : "bg-warm"}`} aria-label={`${heat} lead`} />
            ) : null}
          </p>
          <span className="shrink-0 font-display text-caption text-muted-foreground">
            {client.lastContactAt ? relTime(client.lastContactAt) : "No contact"}
          </span>
        </div>
        {meta.length ? (
          <p className="mt-0.5 truncate font-display text-caption text-muted-foreground">{meta.join(" · ")}</p>
        ) : null}
        {client.lastText?.body ? (
          <p className={`mt-1 line-clamp-1 font-display text-body ${client.lastText.inbound ? "text-foreground" : "text-muted-foreground"}`}>
            {client.lastText.inbound ? "" : "↳ "}
            {client.lastText.body}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Pill>{statusShortLabel(client.status)}</Pill>
          {aria === "texting" ? (
            <Pill tone="primary">
              <Sparkles className="size-3" /> Aria active
            </Pill>
          ) : aria === "paused" ? (
            <Pill>Aria paused</Pill>
          ) : aria === "opted_out" ? (
            <Pill tone="hot">Opted out</Pill>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

export function ClientsPageClient({
  initial,
  activities,
  transactions,
}: {
  initial: Row[];
  activities: TodayActivity[];
  transactions: TodayTransaction[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Same behavior + timing model as Home and Client-detail — a client's heat
  // dot, "Hot"/"Follow Up" filter, and hot count all agree with the rest of
  // the app instead of trusting the hand-typed clients.lead_score column.
  const rows = useMemo(
    () =>
      initial.map((c) => {
        const todayClient: TodayClient = {
          id: c.id,
          name: c.name,
          town: c.town,
          status: c.status,
          lead_score: c.lead_score,
          budget_min: c.budget_min,
          budget_max: c.budget_max,
          phone: c.phone ?? null,
          birthday: null,
          home_purchase_date: null,
        };
        const { score } = computeLeadScore(todayClient, activities, transactions);
        return { ...c, lead_score: score };
      }),
    [initial, activities, transactions],
  );

  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setOpen(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("new");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams]);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    budget_min: "",
    budget_max: "",
    towns: [] as string[],
    beds: "",
    baths: "",
    client_role: "buyer" as "buyer" | "seller",
    notes: "",
  });

  const filtered = useMemo(() => {
    const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const s = search.trim().toLowerCase();
    return rows
      .filter((c) => {
        if (filter === "New" && !((c.created_at ?? "") >= weekAgo || c.status === "new")) return false;
        if (filter === "Aria texting" && ariaState(c) !== "texting") return false;
        if (filter === "Hot" && (c.lead_score ?? 0) < 7) return false;
        if (filter === "Showing" && c.status !== "showing") return false;
        if (filter === "Under contract" && c.status !== "under_contract") return false;
        if (filter === "Closed" && c.status !== "closed") return false;
        if (s && ![c.name, c.town, c.phone, c.email].some((v) => (v ?? "").toLowerCase().includes(s))) return false;
        return true;
      })
      .sort((a, b) => (b.lastContactAt ?? b.created_at ?? "").localeCompare(a.lastContactAt ?? a.created_at ?? ""));
  }, [rows, filter, search]);

  function toggleTown(t: string) {
    setForm((f) => ({
      ...f,
      towns: f.towns.includes(t) ? f.towns.filter((x) => x !== t) : [...f.towns, t],
    }));
  }

  async function saveClient() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    if (!form.name.trim()) { toast.warning("Name is required"); return; }
    const phoneE164 = form.phone.trim() ? formatPhoneE164(form.phone) : null;
    const townJoined = form.towns.length > 0 ? form.towns.join(", ") : null;

    const payload: Record<string, unknown> = {
      agent_id: user.id,
      name: form.name.trim(),
      phone: phoneE164,
      email: form.email.trim() || null,
      town: townJoined,
      budget_min: form.budget_min ? Number(form.budget_min) : null,
      budget_max: form.budget_max ? Number(form.budget_max) : null,
      beds_wanted: form.beds ? Number(form.beds) : null,
      baths_wanted: form.baths ? Number(form.baths) : null,
      notes: form.notes.trim() || null,
      source: "manual",
      status: "new",
      client_role: form.client_role,
    };

    const { data: created, error } = await supabase
      .from("clients").insert(payload).select("id").single();
    if (error) { toast.warning(error.message); return; }

    setOpen(false);
    setForm({ name: "", phone: "", email: "", budget_min: "", budget_max: "", towns: [], beds: "", baths: "", client_role: "buyer", notes: "" });
    toast.success("Client created");
    router.push(`/clients/${created.id}`);
    router.refresh();
  }

  const hotCount = rows.filter((c) => (c.lead_score ?? 0) >= 7).length;

  return (
    <div className="min-h-[100dvh] bg-background text-foreground pb-[130px]">
      <div className="mx-auto max-w-2xl px-5 pt-10 sm:px-8">
        {/* Header */}
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="font-heading text-[34px] leading-tight text-foreground">Clients</h1>
            <p className="font-display text-caption text-muted-foreground mt-1">
              {rows.length} total{hotCount > 0 ? ` · ${hotCount} hot` : ""}
            </p>
          </div>
          <Button onClick={() => setOpen(true)} className="rounded-full h-9 px-4 text-caption font-semibold">
            + Add
          </Button>
        </div>

        {/* Search */}
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
          <Search className="size-3.5 text-muted-foreground shrink-0" />
          <input aria-label="Search name, town, phone, email"
            type="text"
            placeholder="Search name, town, phone, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-focus-parent
            className="flex-1 bg-transparent outline-none font-display text-body text-foreground placeholder:text-muted-foreground"
          />
          {search && (
            <button type="button" onClick={() => setSearch("")} aria-label="Clear search">
              <X className="size-3.5 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="mb-6 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={
                filter === f
                  ? "whitespace-nowrap rounded-full px-3.5 py-2 font-display text-caption font-semibold bg-primary text-primary-foreground transition-colors"
                  : "whitespace-nowrap rounded-full px-3.5 py-2 font-display text-caption font-semibold bg-secondary text-muted-foreground border border-transparent hover:border-input transition-colors"
              }
            >
              {f}
            </button>
          ))}
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center">
            <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full bg-secondary">
              <Users className="size-4 text-muted-foreground" />
            </div>
            <p className="font-display text-body text-muted-foreground">
              {rows.length === 0 ? "No clients yet — tap Add to get started" : "Try adjusting your search or filters"}
            </p>
            {rows.length === 0 && (
              <Button onClick={() => setOpen(true)} className="mt-6 rounded-full h-10 px-5 text-body font-semibold">
                + Add your first client
              </Button>
            )}
          </div>
        ) : (
          <Card className="divide-y divide-border overflow-hidden">
            {filtered.map((client) => (
              <ClientRow key={client.id} client={client} />
            ))}
          </Card>
        )}
      </div>

      {/* Add client sheet */}
      {open ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-scrim backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label="Add client">
          <button type="button" aria-label="Close" tabIndex={-1}
        className="absolute inset-0" onClick={() => setOpen(false)} />
          <div className="relative z-10 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-card border border-border border-b-0 px-5 pb-10 pt-4">
            <div className="mx-auto mb-5 h-1 w-9 rounded-full bg-border" />

            <p className="font-heading text-[22px] text-foreground mb-0.5">New client</p>
            <p className="font-display text-caption text-muted-foreground mb-5">Saved to your clients table.</p>

            <div className="space-y-3">
              <input aria-label="Full name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Full name *"
                className={INPUT}
              />

              <div className="grid grid-cols-2 gap-2">
                <input aria-label="Phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="Phone"
                  inputMode="tel"
                  className={INPUT}
                />
                <input aria-label="Email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="Email"
                  inputMode="email"
                  className={INPUT}
                />
              </div>

              <div className="flex gap-2">
                {(["buyer", "seller"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setForm({ ...form, client_role: r })}
                    className={
                      form.client_role === r
                        ? "flex-1 rounded-xl py-2.5 font-display text-body font-semibold capitalize bg-primary text-primary-foreground transition-colors"
                        : "flex-1 rounded-xl py-2.5 font-display text-body font-semibold capitalize bg-secondary text-muted-foreground transition-colors"
                    }
                  >
                    {r}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input aria-label="Budget min"
                  value={form.budget_min}
                  onChange={(e) => setForm({ ...form, budget_min: e.target.value })}
                  placeholder="Budget min"
                  inputMode="numeric"
                  className={INPUT}
                />
                <input aria-label="Budget max"
                  value={form.budget_max}
                  onChange={(e) => setForm({ ...form, budget_max: e.target.value })}
                  placeholder="Budget max"
                  inputMode="numeric"
                  className={INPUT}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input aria-label="Beds"
                  value={form.beds}
                  onChange={(e) => setForm({ ...form, beds: e.target.value })}
                  placeholder="Beds"
                  inputMode="numeric"
                  className={INPUT}
                />
                <input aria-label="Baths"
                  value={form.baths}
                  onChange={(e) => setForm({ ...form, baths: e.target.value })}
                  placeholder="Baths"
                  inputMode="decimal"
                  className={INPUT}
                />
              </div>

              <div>
                <p className="font-display text-caption uppercase tracking-[0.06em] text-muted-foreground mb-2">
                  Preferred towns
                </p>
                <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto rounded-xl bg-secondary p-2.5">
                  {NJ_TOWN_OPTIONS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleTown(t)}
                      className={
                        form.towns.includes(t)
                          ? "rounded-full px-2.5 py-1 font-display text-[11px] font-medium bg-primary text-primary-foreground transition-colors"
                          : "rounded-full px-2.5 py-1 font-display text-[11px] font-medium bg-card text-muted-foreground transition-colors"
                      }
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <textarea aria-label="Notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Notes — timeline, motivation, anything useful"
                rows={3}
                className="w-full resize-none rounded-xl border border-input bg-secondary p-4 outline-none font-display text-body text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <Button onClick={saveClient} className="w-full h-12 rounded-xl mt-5 text-body-lg font-semibold">
              Save client
            </Button>
          </div>
        </div>
      ) : null}

      <Toaster />
    </div>
  );
}

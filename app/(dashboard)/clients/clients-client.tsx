"use client";

import { NJ_TOWN_OPTIONS } from "@/lib/nj-towns";
import { createClient } from "@/lib/supabase/client";
import { fmtMoney, formatPhoneE164 } from "@/lib/utils";
import { useToast } from "@/components/ToastProvider";
import { ChevronRight, Search, Users } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const STATUS_FILTERS = [
  "All",
  "Hot",
  "Follow Up",
  "Showing",
  "Under Contract",
  "Closed",
] as const;

// Locked avatar palette — hash-based, all from design system
const AVATAR_PALETTE = [
  { bg: "rgba(59,130,246,0.15)", text: "#3B82F6" },   // blue
  { bg: "rgba(167,139,250,0.15)", text: "#A78BFA" },  // purple
  { bg: "rgba(6,182,212,0.15)", text: "#06B6D4" },    // cyan
  { bg: "rgba(16,185,129,0.15)", text: "#10B981" },   // green
  { bg: "rgba(245,158,11,0.15)", text: "#F59E0B" },   // amber
];

function avatarColors(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash + name.charCodeAt(i)) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[hash];
}

// Semantic status badge styles
const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  new:            { bg: "rgba(59,130,246,0.15)",  text: "#3B82F6", label: "New" },
  contacted:      { bg: "rgba(167,139,250,0.15)", text: "#A78BFA", label: "Contacted" },
  showing:        { bg: "rgba(245,158,11,0.15)",  text: "#F59E0B", label: "Showing" },
  offer:          { bg: "rgba(167,139,250,0.15)", text: "#A78BFA", label: "Offer" },
  under_contract: { bg: "rgba(59,130,246,0.15)",  text: "#3B82F6", label: "Under Contract" },
  closed:         { bg: "rgba(16,185,129,0.15)",  text: "#10B981", label: "Closed" },
  dead:           { bg: "rgba(255,255,255,0.06)", text: "#6B7280", label: "Archived" },
};

function initialsOf(name: string | null | undefined) {
  return (
    (name ?? "")
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

// Shared input style for the Add sheet.
// No text-[14px] — globals.css enforces font-size: max(16px, 1em) !important
// on all inputs/textareas, preventing iOS Safari auto-zoom on focus.
const INPUT =
  "w-full rounded-[13px] px-4 py-3 outline-none placeholder-[#4B5563]";
const INPUT_STYLE = {
  background: "rgba(255,255,255,0.06)",
  border: "0.5px solid rgba(255,255,255,0.08)",
  color: "#ffffff",
};

type Row = {
  id: string;
  name: string;
  town: string | null;
  status: string | null;
  lead_score: number | null;
  budget_min: number | null;
  budget_max: number | null;
  phone?: string | null;
  email?: string | null;
  beds_wanted?: number | null;
  baths_wanted?: number | null;
  notes?: string | null;
  client_role?: string | null;
};

export function ClientsPageClient({ initial }: { initial: Record<string, unknown>[] }) {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const rows = initial as unknown as Row[];

  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]>("All");
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
    return rows.filter((c) => {
      if (filter === "Hot" && (c.lead_score ?? 0) < 7) return false;
      if (filter === "Follow Up" && (c.lead_score ?? 0) >= 5) return false;
      if (filter === "Showing" && c.status !== "showing") return false;
      if (filter === "Under Contract" && c.status !== "under_contract") return false;
      if (filter === "Closed" && c.status !== "closed") return false;
      if (search) {
        const s = search.toLowerCase();
        if (!c.name?.toLowerCase().includes(s) && !(c.town ?? "").toLowerCase().includes(s))
          return false;
      }
      return true;
    });
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
    if (!form.name.trim()) { toast.toast("Name is required", "warn"); return; }
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
    if (error) { toast.toast(error.message, "warn"); return; }

    setOpen(false);
    setForm({ name: "", phone: "", email: "", budget_min: "", budget_max: "", towns: [], beds: "", baths: "", client_role: "buyer", notes: "" });
    toast.toast("Client created", "success");
    router.push(`/clients/${created.id}`);
    router.refresh();
  }

  const hotCount = rows.filter((c) => (c.lead_score ?? 0) >= 7).length;

  return (
    <div
      className="min-h-screen pb-[130px]"
      style={{
        background: `
          radial-gradient(ellipse 80% 50% at 50% -20%, rgba(59,130,246,0.10), transparent),
          radial-gradient(ellipse 60% 50% at 80% 80%, rgba(167,139,250,0.06), transparent),
          #000000
        `,
        color: "#ffffff",
      }}
    >
      <div className="px-5 pt-6">

        {/* ── Header ── */}
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h1
              className="text-[26px] font-semibold leading-tight"
              style={{ letterSpacing: "-0.025em" }}
            >
              Clients
            </h1>
            <p className="mt-0.5 text-[12px]" style={{ color: "#6B7280" }}>
              {rows.length} total{hotCount > 0 ? ` · ${hotCount} hot` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-[13px] font-semibold text-white active:scale-[0.97] transition-transform duration-100"
            style={{
              background: "#3B82F6",
              padding: "8px 16px",
              borderRadius: 8,
            }}
          >
            + Add
          </button>
        </div>

        {/* ── Search ── */}
        <div
          className="mb-3 flex items-center gap-3 px-4 py-3"
          style={{
            borderRadius: 13,
            background: "rgba(20,20,22,0.6)",
            border: "0.5px solid rgba(255,255,255,0.06)",
          }}
        >
          <Search size={14} strokeWidth={1.8} style={{ color: "#6B7280", flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search by name or town…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent outline-none placeholder-[#4B5563]"
            style={{ color: "#ffffff" }}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="text-[14px]"
              style={{ color: "#6B7280" }}
            >
              ×
            </button>
          )}
        </div>

        {/* ── Filters ── */}
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {STATUS_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className="whitespace-nowrap text-[12px] font-medium active:scale-[0.97] transition-transform duration-100"
              style={
                filter === f
                  ? { background: "#3B82F6", color: "#ffffff", padding: "7px 14px", borderRadius: 20 }
                  : {
                      background: "rgba(20,20,22,0.6)",
                      color: "#6B7280",
                      padding: "7px 14px",
                      borderRadius: 20,
                      border: "0.5px solid rgba(255,255,255,0.06)",
                    }
              }
            >
              {f}
            </button>
          ))}
        </div>

        {/* ── List ── */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div
              className="mb-4 flex h-11 w-11 items-center justify-center rounded-full"
              style={{ background: "rgba(255,255,255,0.05)" }}
            >
              <Users size={20} style={{ color: "#6B7280" }} />
            </div>
            <p
              className="mb-1 text-[11px] font-semibold uppercase"
              style={{ color: "#6B7280", letterSpacing: "0.08em" }}
            >
              No Results
            </p>
            <p className="text-[13px]" style={{ color: "#9CA3AF" }}>
              {rows.length === 0
                ? "No clients yet — tap Add to get started"
                : "Try adjusting your search or filters"}
            </p>
            {rows.length === 0 && (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="mt-6 text-[14px] font-semibold active:scale-[0.97] transition-transform duration-100"
                style={{
                  background: "#3B82F6",
                  color: "#ffffff",
                  padding: "10px 20px",
                  borderRadius: 8,
                }}
              >
                + Add your first client
              </button>
            )}
          </div>
        ) : (
          <div>
            {filtered.map((client, idx) => {
              const statusStyle = STATUS_STYLE[client.status ?? ""] ?? null;
              const score = client.lead_score ?? 0;
              const hot = score >= 7;
              const colors = avatarColors(client.name);
              const isLast = idx === filtered.length - 1;

              return (
                <Link
                  key={client.id}
                  href={`/clients/${client.id}`}
                  className="flex items-center active:bg-white/[0.03]"
                  style={{
                    padding: "14px 0",
                    borderBottom: isLast ? "none" : "0.5px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {/* Avatar */}
                  <div
                    className="mr-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
                    style={{ background: colors.bg, color: colors.text }}
                  >
                    {initialsOf(client.name)}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p
                        className="truncate text-[15px] font-semibold"
                        style={{ color: "#ffffff", letterSpacing: "-0.01em" }}
                      >
                        {client.name}
                      </p>
                      {hot && (
                        <span
                          className="h-[5px] w-[5px] shrink-0 rounded-full"
                          style={{ background: "#3B82F6" }}
                        />
                      )}
                    </div>
                    <p className="mt-px truncate text-[12px]" style={{ color: "#6B7280" }}>
                      {client.town ?? "—"}
                      {client.budget_max ? ` · Up to ${fmtMoney(client.budget_max)}` : ""}
                    </p>
                  </div>

                  {/* Right meta */}
                  <div className="ml-3 flex shrink-0 items-center gap-2">
                    {statusStyle && (
                      <span
                        className="text-[10px] font-semibold uppercase"
                        style={{
                          background: statusStyle.bg,
                          color: statusStyle.text,
                          padding: "2px 7px",
                          borderRadius: 4,
                          letterSpacing: "0.04em",
                        }}
                      >
                        {statusStyle.label}
                      </span>
                    )}
                    <ChevronRight size={14} style={{ color: "#4B5563" }} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Add client sheet ── */}
      {open ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 backdrop-blur-[3px]">
          <button type="button" aria-label="Close" className="absolute inset-0" onClick={() => setOpen(false)} />
          <div
            className="relative z-10 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-[24px] px-5 pb-10 pt-4"
            style={{
              background: "rgba(20,20,22,0.95)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "0.5px solid rgba(255,255,255,0.08)",
              borderBottom: "none",
            }}
          >
            {/* Drag handle */}
            <div
              className="mx-auto mb-5 h-1 w-9 rounded-full"
              style={{ background: "rgba(255,255,255,0.15)" }}
            />

            <p className="mb-0.5 text-[17px] font-semibold" style={{ color: "#ffffff", letterSpacing: "-0.02em" }}>
              New client
            </p>
            <p className="mb-5 text-[13px]" style={{ color: "#6B7280" }}>
              Saved to your clients table.
            </p>

            <div className="space-y-3">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Full name *"
                className={INPUT}
                style={INPUT_STYLE}
              />

              <div className="grid grid-cols-2 gap-2">
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="Phone"
                  inputMode="tel"
                  className={INPUT}
                  style={INPUT_STYLE}
                />
                <input
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="Email"
                  inputMode="email"
                  className={INPUT}
                  style={INPUT_STYLE}
                />
              </div>

              {/* Role toggle */}
              <div className="flex gap-2">
                {(["buyer", "seller"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setForm({ ...form, client_role: r })}
                    className="flex-1 py-2.5 text-[13px] font-semibold capitalize active:scale-[0.97] transition-transform duration-100"
                    style={{
                      borderRadius: 10,
                      ...(form.client_role === r
                        ? { background: "#3B82F6", color: "#ffffff" }
                        : { background: "rgba(255,255,255,0.06)", color: "#6B7280", border: "0.5px solid rgba(255,255,255,0.08)" }),
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  value={form.budget_min}
                  onChange={(e) => setForm({ ...form, budget_min: e.target.value })}
                  placeholder="Budget min"
                  inputMode="numeric"
                  className={INPUT}
                  style={INPUT_STYLE}
                />
                <input
                  value={form.budget_max}
                  onChange={(e) => setForm({ ...form, budget_max: e.target.value })}
                  placeholder="Budget max"
                  inputMode="numeric"
                  className={INPUT}
                  style={INPUT_STYLE}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  value={form.beds}
                  onChange={(e) => setForm({ ...form, beds: e.target.value })}
                  placeholder="Beds"
                  inputMode="numeric"
                  className={INPUT}
                  style={INPUT_STYLE}
                />
                <input
                  value={form.baths}
                  onChange={(e) => setForm({ ...form, baths: e.target.value })}
                  placeholder="Baths"
                  inputMode="decimal"
                  className={INPUT}
                  style={INPUT_STYLE}
                />
              </div>

              {/* Town picker */}
              <div>
                <p
                  className="mb-2 text-[11px] font-semibold uppercase"
                  style={{ color: "#6B7280", letterSpacing: "0.08em" }}
                >
                  Preferred towns
                </p>
                <div
                  className="flex max-h-36 flex-wrap gap-1 overflow-y-auto p-2.5"
                  style={{
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.04)",
                    border: "0.5px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {NJ_TOWN_OPTIONS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleTown(t)}
                      className="rounded-full px-2 py-[4px] text-[10px] font-medium active:scale-[0.97] transition-transform duration-100"
                      style={
                        form.towns.includes(t)
                          ? { background: "#3B82F6", color: "#ffffff" }
                          : { background: "rgba(255,255,255,0.06)", color: "#6B7280" }
                      }
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Notes — timeline, motivation, anything useful"
                rows={3}
                className="w-full resize-none p-4 outline-none placeholder-[#4B5563]"
                style={{
                  borderRadius: 13,
                  background: "rgba(255,255,255,0.06)",
                  border: "0.5px solid rgba(255,255,255,0.08)",
                  color: "#ffffff",
                }}
              />
            </div>

            <div className="mt-5">
              <button
                type="button"
                onClick={saveClient}
                className="w-full text-[14px] font-semibold text-white active:scale-[0.97] transition-transform duration-100"
                style={{
                  background: "#3B82F6",
                  padding: "14px",
                  borderRadius: 10,
                }}
              >
                Save client
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}

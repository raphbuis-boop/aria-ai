"use client";

import { NJ_TOWN_OPTIONS } from "@/lib/nj-towns";
import { createClient } from "@/lib/supabase/client";
import { fmtMoney, formatPhoneE164 } from "@/lib/utils";
import { useToast } from "@/components/ToastProvider";
import { Search, Users } from "lucide-react";
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

// Status → badge style
const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  new:            { label: "New",            cls: "bg-[#c47e1a]/10 text-[#c47e1a] border-[#c47e1a]/20" },
  contacted:      { label: "Contacted",      cls: "bg-[#3a65f0]/10 text-[#6b8fff] border-[#3a65f0]/20" },
  showing:        { label: "Showing",        cls: "bg-[#3a65f0]/10 text-[#6b8fff] border-[#3a65f0]/20" },
  offer:          { label: "Offer",          cls: "bg-[#1a9b5e]/10 text-[#1a9b5e] border-[#1a9b5e]/20" },
  under_contract: { label: "Under Contract", cls: "bg-[#c084fc]/10 text-[#c084fc] border-[#c084fc]/20" },
  closed:         { label: "Closed",         cls: "bg-white/6 text-[#9498b0] border-white/10" },
  dead:           { label: "Archived",       cls: "bg-white/6 text-[#444458] border-white/8" },
};

// Deterministic avatar color from name
const AVATAR_PALETTE = [
  "bg-[#3a65f0]/15 text-[#6b8fff]",
  "bg-[#c084fc]/15 text-[#c084fc]",
  "bg-[#1a9b5e]/15 text-[#1a9b5e]",
  "bg-[#c47e1a]/15 text-[#c47e1a]",
  "bg-[#c43838]/15 text-[#ff8080]",
];

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

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

// Shared input style
const INPUT =
  "w-full rounded-[13px] border-[0.5px] border-[#1e2230] bg-[#080910] px-4 py-3 text-base text-[#e8e6e0] placeholder-[#3a3a50] outline-none focus:border-[#3a65f0]/50 transition";

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
    <div className="min-h-screen pb-28" style={{ background: "#050816", color: "#e4e8ff" }}>
      <div className="px-5 pt-6">

        {/* ── Header ── */}
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.025em]">Leads</h1>
            <p className="mt-0.5 text-[12px]" style={{ color: "#40486a" }}>
              {rows.length} total{hotCount > 0 ? ` · ${hotCount} hot` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-full px-4 py-2 text-[13px] font-semibold text-white"
            style={{ background: "#4c7aff" }}
          >
            + Add
          </button>
        </div>

        {/* ── Search ── */}
        <div
          className="mb-3 flex items-center gap-3 px-4 py-3"
          style={{ borderRadius: 13, background: "#080c18", border: "0.5px solid #181d2e" }}
        >
          <Search size={14} strokeWidth={1.8} style={{ color: "#40486a", flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search by name or town…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-[14px] outline-none"
            style={{ color: "#e4e8ff" }}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="text-[#6b7090] transition hover:text-[#9498b0]"
            >
              ×
            </button>
          )}
        </div>

        {/* ── Filters ── */}
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1 scroll-touch">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className="whitespace-nowrap rounded-full px-3.5 py-2 text-[12px] font-medium"
              style={
                filter === f
                  ? { background: "rgba(76,122,255,0.12)", color: "#7b9fff", border: "0.5px solid rgba(76,122,255,0.25)" }
                  : { background: "#080c18", color: "#40486a", border: "0.5px solid #181d2e" }
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
              className="mb-3 flex h-11 w-11 items-center justify-center rounded-full"
              style={{ background: "rgba(76,122,255,0.1)" }}
            >
              <Users size={20} style={{ color: "#4c7aff" }} />
            </div>
            <p className="text-[14px] font-semibold" style={{ color: "#8088aa" }}>No clients found</p>
            <p className="mt-1 text-[12px]" style={{ color: "#40486a" }}>Try a different filter or add a new client</p>
          </div>
        ) : (
          <div className="ios-group">
            {filtered.map((client, idx) => {
              const badge = STATUS_BADGE[client.status ?? ""] ?? null;
              const score = client.lead_score ?? 0;
              const hot = score >= 7;

              return (
                <Link
                  key={client.id}
                  href={`/clients/${client.id}`}
                  className="ios-row"
                  style={{ borderBottom: idx < filtered.length - 1 ? "0.5px solid #131520" : "none" }}
                >
                  {/* Avatar */}
                  <div className={`mr-3 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${avatarColor(client.name)}`}>
                    {initialsOf(client.name)}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium" style={{ color: "#dde0f8" }}>
                      {client.name}
                    </p>
                    <p className="mt-px truncate text-[11px]" style={{ color: "#40486a" }}>
                      {client.town ?? "—"}
                      {client.budget_max ? ` · Up to ${fmtMoney(client.budget_max)}` : ""}
                    </p>
                  </div>

                  {/* Right meta */}
                  <div className="ml-2 flex flex-shrink-0 items-center gap-1.5">
                    {hot && <span className="h-[5px] w-[5px] rounded-full" style={{ background: "#4c7aff" }} />}
                    {badge && (
                      <span className="rounded px-1.5 py-[2px] text-[10px]" style={{ color: "#50587a" }}>
                        {badge.label}
                      </span>
                    )}
                    <span className="text-[14px]" style={{ color: "#2a3050" }}>›</span>
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
          <div className="relative z-10 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-[24px] border-[0.5px] border-b-0 border-[#1e2230] bg-[#0d0f16] px-5 pb-10 pt-4">
            <div className="mx-auto mb-5 h-1 w-9 rounded-full bg-[#2a2e40]" />
            <p className="mb-0.5 text-[16px] font-semibold">New client</p>
            <p className="mb-5 text-[12px] text-[#6b7090]">Saved to your clients table.</p>

            <div className="space-y-3">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Full name *" className={INPUT} />

              <div className="grid grid-cols-2 gap-2">
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="Phone" inputMode="tel" className={INPUT} />
                <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="Email" inputMode="email" className={INPUT} />
              </div>

              {/* Role toggle */}
              <div className="flex gap-2">
                {(["buyer", "seller"] as const).map((r) => (
                  <button key={r} type="button" onClick={() => setForm({ ...form, client_role: r })}
                    className={`flex-1 rounded-[12px] py-2.5 text-[13px] font-semibold capitalize transition ${
                      form.client_role === r ? "" : ""
                    }`}
                    style={
                      form.client_role === r
                        ? { background: "rgba(76,122,255,0.12)", color: "#7b9fff", border: "0.5px solid rgba(76,122,255,0.25)" }
                        : { background: "#060912", color: "#40486a", border: "0.5px solid #181d2e" }
                    }>
                    {r}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input value={form.budget_min} onChange={(e) => setForm({ ...form, budget_min: e.target.value })}
                  placeholder="Budget min" inputMode="numeric" className={INPUT} />
                <input value={form.budget_max} onChange={(e) => setForm({ ...form, budget_max: e.target.value })}
                  placeholder="Budget max" inputMode="numeric" className={INPUT} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input value={form.beds} onChange={(e) => setForm({ ...form, beds: e.target.value })}
                  placeholder="Beds" inputMode="numeric" className={INPUT} />
                <input value={form.baths} onChange={(e) => setForm({ ...form, baths: e.target.value })}
                  placeholder="Baths" inputMode="decimal" className={INPUT} />
              </div>

              {/* Town picker */}
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[1.2px] text-[#6b7090]">
                  Preferred towns
                </p>
                <div className="flex max-h-36 flex-wrap gap-1 overflow-y-auto rounded-[14px] border-[0.5px] border-[#1e2230] bg-[#080910] p-2.5">
                  {NJ_TOWN_OPTIONS.map((t) => (
                    <button key={t} type="button" onClick={() => toggleTown(t)}
                      className={`rounded-full border-[0.5px] px-2 py-[4px] text-[10px] font-medium transition ${
                        form.towns.includes(t)
                          ? "border-[#3a65f0]/40 bg-[#3a65f0]/12 text-[#6b8fff]"
                          : "border-[#1e2230] bg-transparent text-[#6b7090] hover:text-[#8888a0]"
                      }`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Notes — timeline, motivation, anything useful"
                rows={3}
                className="w-full resize-none rounded-[13px] border-[0.5px] border-[#1e2230] bg-[#080910] p-4 text-base text-[#e8e6e0] placeholder-[#3a3a50] outline-none focus:border-[#3a65f0]/50 transition" />
            </div>

            <div className="mt-5">
              <button
                type="button"
                onClick={saveClient}
                className="w-full rounded-[13px] py-3.5 text-[14px] font-semibold text-white press"
                style={{ background: "#4c7aff" }}
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

"use client";

import { CardMenu } from "@/components/CardMenu";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EditClientModal } from "@/components/EditClientModal";
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
  new:            { label: "New",            cls: "bg-[#ffb832]/10 text-[#ffb832] border-[#ffb832]/20" },
  contacted:      { label: "Contacted",      cls: "bg-[#4f7bff]/10 text-[#6f9bff] border-[#4f7bff]/20" },
  showing:        { label: "Showing",        cls: "bg-[#4f7bff]/10 text-[#6f9bff] border-[#4f7bff]/20" },
  offer:          { label: "Offer",          cls: "bg-[#50dc78]/10 text-[#50dc78] border-[#50dc78]/20" },
  under_contract: { label: "Under Contract", cls: "bg-[#c084fc]/10 text-[#c084fc] border-[#c084fc]/20" },
  closed:         { label: "Closed",         cls: "bg-white/6 text-[#666680] border-white/10" },
  dead:           { label: "Archived",       cls: "bg-white/6 text-[#444458] border-white/8" },
};

// Deterministic avatar color from name
const AVATAR_PALETTE = [
  "bg-[#4f7bff]/15 text-[#6f9bff]",
  "bg-[#c084fc]/15 text-[#c084fc]",
  "bg-[#50dc78]/15 text-[#50dc78]",
  "bg-[#ffb832]/15 text-[#ffb832]",
  "bg-[#ff6060]/15 text-[#ff8080]",
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
  "w-full rounded-[13px] border-[0.5px] border-[#1c1c2a] bg-[#080810] px-4 py-3 text-[13.5px] text-[#e8e6e0] placeholder-[#3a3a50] outline-none focus:border-[#4f7bff]/50 transition";

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
  const [editClient, setEditClient] = useState<Row | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Row | null>(null);

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

  async function archiveClient(c: Row) {
    const { error } = await supabase.from("clients").update({ status: "dead" }).eq("id", c.id);
    if (error) { toast.toast(error.message, "warn"); return; }
    toast.toast(`${c.name} archived`, "success");
    router.refresh();
  }

  async function deleteClient(c: Row) {
    const { error } = await supabase.from("clients").delete().eq("id", c.id);
    if (error) { toast.toast(error.message, "warn"); return; }
    toast.toast(`${c.name} deleted`, "success");
    setConfirmDelete(null);
    router.refresh();
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
    <div className="min-h-screen bg-[#080810] text-[#f0eee8] pb-28">
      <div className="px-5 pt-5">

        {/* ── Header ── */}
        <div className="mb-5">
          <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em]">Clients</h1>
          <p className="mt-0.5 text-[12px] text-[#44445a]">
            {rows.length} total{hotCount > 0 ? ` · ${hotCount} hot` : ""}
          </p>
        </div>

        {/* ── Search ── */}
        <div className="mb-3 flex items-center gap-3 rounded-[14px] border-[0.5px] border-[#1c1c2a] bg-[#0e0e18] px-4 py-3">
          <Search size={15} strokeWidth={2} className="flex-shrink-0 text-[#44445a]" />
          <input
            type="text"
            placeholder="Search by name or town…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-[13.5px] text-[#f0eee8] placeholder-[#44445a] outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="text-[#44445a] transition hover:text-[#888898]"
            >
              ×
            </button>
          )}
        </div>

        {/* ── Filters ── */}
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`whitespace-nowrap rounded-full border-[0.5px] px-3.5 py-[7px] text-[12px] font-medium transition ${
                filter === f
                  ? "border-[#4f7bff]/35 bg-[#4f7bff]/12 text-[#6f9bff]"
                  : "border-[#1c1c2a] bg-[#0e0e18] text-[#44445a] hover:text-[#8888a0]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* ── List ── */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#4f7bff]/10">
              <Users size={22} className="text-[#4f7bff]" />
            </div>
            <p className="text-[14px] font-semibold text-[#8888a0]">No clients found</p>
            <p className="mt-1 text-[12px] text-[#44445a]">Try a different filter or add a new client</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((client) => {
              const badge = STATUS_BADGE[client.status ?? ""] ?? null;
              const score = client.lead_score ?? 0;
              const isHot = score >= 7;

              return (
                <div key={client.id} className="relative">
                  <Link href={`/clients/${client.id}`}>
                    <div className={`rounded-[18px] border-[0.5px] bg-[#0e0e18] p-4 pr-10 transition active:scale-[0.99] ${
                      isHot ? "border-[#4f7bff]/25" : "border-[#1c1c2a]"
                    }`}>
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <div className={`h-10 w-10 flex-shrink-0 rounded-[13px] flex items-center justify-center text-[13px] font-bold ${avatarColor(client.name)}`}>
                          {initialsOf(client.name)}
                        </div>

                        {/* Main info */}
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex items-center gap-2">
                            <span className="truncate text-[14px] font-semibold text-[#f0eee8]">
                              {client.name}
                            </span>
                            {client.client_role === "seller" && (
                              <span className="flex-shrink-0 rounded-full border-[0.5px] border-[#1c1c2a] px-2 py-px text-[10px] font-medium text-[#44445a]">
                                Seller
                              </span>
                            )}
                            {badge && (
                              <span className={`flex-shrink-0 rounded-md border-[0.5px] px-2 py-px text-[10px] font-bold uppercase tracking-[0.5px] ${badge.cls}`}>
                                {badge.label}
                              </span>
                            )}
                          </div>

                          <p className="mb-2 truncate text-[12px] text-[#44445a]">
                            {client.town ?? "—"}
                            {client.budget_max ? ` · Up to ${fmtMoney(client.budget_max)}` : ""}
                          </p>

                          {score > 0 && (
                            <span className="text-[11px] font-medium text-[#44445a]">Score {score}/10</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                  <CardMenu
                    className="absolute right-3 top-3"
                    onEdit={() => setEditClient(client)}
                    onArchive={() => archiveClient(client)}
                    onDelete={() => setConfirmDelete(client)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Add client sheet ── */}
      {open ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 backdrop-blur-[3px]">
          <button type="button" aria-label="Close" className="absolute inset-0" onClick={() => setOpen(false)} />
          <div className="relative z-10 max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-[24px] border-[0.5px] border-b-0 border-[#1c1c2a] bg-[#0e0e18] px-5 pb-10 pt-4">
            <div className="mx-auto mb-5 h-1 w-9 rounded-full bg-[#2a2a3e]" />
            <p className="mb-0.5 text-[16px] font-semibold">New client</p>
            <p className="mb-5 text-[12px] text-[#44445a]">Saved to your clients table.</p>

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
                    className={`flex-1 rounded-[12px] border-[0.5px] py-2.5 text-[12px] font-semibold uppercase tracking-wider transition ${
                      form.client_role === r
                        ? "border-[#4f7bff]/40 bg-[#4f7bff]/12 text-[#6f9bff]"
                        : "border-[#1c1c2a] bg-[#080810] text-[#44445a]"
                    }`}>
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
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[1.2px] text-[#44445a]">
                  Preferred towns
                </p>
                <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto rounded-[14px] border-[0.5px] border-[#1c1c2a] bg-[#080810] p-3">
                  {NJ_TOWN_OPTIONS.map((t) => (
                    <button key={t} type="button" onClick={() => toggleTown(t)}
                      className={`rounded-full border-[0.5px] px-2.5 py-[5px] text-[11px] font-medium transition ${
                        form.towns.includes(t)
                          ? "border-[#4f7bff]/40 bg-[#4f7bff]/12 text-[#6f9bff]"
                          : "border-[#1c1c2a] bg-transparent text-[#44445a] hover:text-[#8888a0]"
                      }`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Notes — timeline, motivation, anything useful"
                rows={3}
                className="w-full resize-none rounded-[13px] border-[0.5px] border-[#1c1c2a] bg-[#080810] p-4 text-[13.5px] text-[#e8e6e0] placeholder-[#3a3a50] outline-none focus:border-[#4f7bff]/50 transition" />
            </div>

            <div className="mt-5 flex gap-2">
              <button type="button" onClick={saveClient}
                className="flex-1 rounded-[13px] bg-[#4f7bff] py-3 text-[13.5px] font-semibold text-white transition hover:bg-[#3d6ae8] active:scale-[0.98]">
                Save client
              </button>
              <button type="button" onClick={() => setOpen(false)}
                className="rounded-[13px] border-[0.5px] border-[#1c1c2a] px-5 py-3 text-[13.5px] font-semibold text-[#888898] transition hover:text-[#f0eee8]">
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editClient ? (
        <EditClientModal
          client={{
            id: editClient.id,
            name: editClient.name,
            phone: editClient.phone ?? null,
            email: editClient.email ?? null,
            status: editClient.status,
            budget_min: editClient.budget_min,
            budget_max: editClient.budget_max,
            town: editClient.town,
            beds_wanted: editClient.beds_wanted ?? null,
            baths_wanted: editClient.baths_wanted ?? null,
            lead_score: editClient.lead_score,
            notes: editClient.notes ?? null,
            client_role: editClient.client_role ?? null,
          }}
          onClose={() => setEditClient(null)}
        />
      ) : null}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete this client?"
        message={confirmDelete ? `${confirmDelete.name} and their record will be permanently removed. This cannot be undone.` : ""}
        confirmLabel="Delete client"
        onConfirm={async () => { if (confirmDelete) await deleteClient(confirmDelete); }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

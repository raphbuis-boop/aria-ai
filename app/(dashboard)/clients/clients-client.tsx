"use client";

import { NJ_TOWN_OPTIONS } from "@/lib/nj-towns";
import { createClient } from "@/lib/supabase/client";
import { fmtMoney, formatPhoneE164 } from "@/lib/utils";
import { useToast } from "@/components/ToastProvider";
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

const BADGE: Record<string, string> = {
  new: "bg-amber-500/15 text-amber-400",
  contacted: "bg-blue-500/15 text-blue-400",
  showing: "bg-blue-500/15 text-blue-400",
  offer: "bg-green-500/15 text-green-400",
  under_contract: "bg-purple-500/15 text-purple-400",
  closed: "bg-gray-500/15 text-gray-400",
  dead: "bg-gray-500/15 text-gray-500",
};

const AVATAR_COLORS = [
  "bg-blue-500/20 text-blue-400",
  "bg-purple-500/20 text-purple-400",
  "bg-green-500/20 text-green-400",
  "bg-amber-500/20 text-amber-400",
  "bg-red-500/20 text-red-400",
];

type Row = {
  id: string;
  name: string;
  town: string | null;
  status: string | null;
  lead_score: number | null;
  budget_min: number | null;
  budget_max: number | null;
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

export function ClientsPageClient({
  initial,
}: {
  initial: Record<string, unknown>[];
}) {
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
      if (filter === "Under Contract" && c.status !== "under_contract")
        return false;
      if (filter === "Closed" && c.status !== "closed") return false;
      if (search) {
        const s = search.toLowerCase();
        if (
          !c.name?.toLowerCase().includes(s) &&
          !(c.town ?? "").toLowerCase().includes(s)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [rows, filter, search]);

  function toggleTown(t: string) {
    setForm((f) => ({
      ...f,
      towns: f.towns.includes(t)
        ? f.towns.filter((x) => x !== t)
        : [...f.towns, t],
    }));
  }

  async function saveClient() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    if (!form.name.trim()) {
      toast.toast("Name is required", "warn");
      return;
    }
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
      .from("clients")
      .insert(payload)
      .select("id")
      .single();
    if (error) {
      toast.toast(error.message, "warn");
      return;
    }
    setOpen(false);
    setForm({
      name: "",
      phone: "",
      email: "",
      budget_min: "",
      budget_max: "",
      towns: [],
      beds: "",
      baths: "",
      client_role: "buyer",
      notes: "",
    });
    toast.toast("Client created", "success");
    router.push(`/clients/${created.id}`);
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      <div className="px-5 pt-6 pb-2">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-2xl font-semibold">Clients</h1>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="bg-[#4f7bff]/12 text-[#6f9bff] border border-[#4f7bff]/20 rounded-xl px-4 py-2 text-sm font-semibold"
          >
            + Add
          </button>
        </div>

        <div className="bg-[#12121e] border border-[#1e1e2e] rounded-2xl px-4 py-3 flex items-center gap-3 mb-4">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#444460"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search clients or town..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm text-white placeholder-[#444460] outline-none flex-1"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 mb-4">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${
                filter === f
                  ? "bg-[#4f7bff]/15 border-[#4f7bff]/30 text-[#6f9bff]"
                  : "bg-[#12121e] border-[#1e1e2e] text-[#666680]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-[#444460]">
            <p className="font-medium">No clients found</p>
            <p className="text-sm mt-1">
              Try a different filter or add a new client
            </p>
          </div>
        ) : null}

        {filtered.map((client, i) => (
          <Link key={client.id} href={`/clients/${client.id}`}>
            <div className="bg-[#12121e] border border-[#1e1e2e] rounded-2xl p-3.5 flex items-center gap-3 active:border-[#4f7bff] transition-colors">
              <div
                className={`w-10 h-10 rounded-[13px] flex items-center justify-center text-xs font-bold flex-shrink-0 ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}
              >
                {initialsOf(client.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold text-[#d0d0e0] truncate">
                    {client.name}
                  </span>
                  {client.status ? (
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md flex-shrink-0 ${BADGE[client.status] ?? "bg-gray-500/15 text-gray-400"}`}
                    >
                      {client.status.replace("_", " ")}
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-[#555570] truncate">
                  {client.town ?? "—"}
                  {client.budget_max
                    ? ` · Up to ${fmtMoney(client.budget_max)}`
                    : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {(client.lead_score ?? 0) >= 7 ? (
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                ) : null}
                <div className="flex gap-0.5">
                  {Array.from({ length: 10 }).map((_, j) => (
                    <div
                      key={j}
                      className={`w-1.5 h-1.5 rounded-full ${
                        j < (client.lead_score ?? 0)
                          ? "bg-[#4f7bff]"
                          : "bg-[#1e1e2e]"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {open ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[14px] border border-[#1e1e2e] bg-[#12121e] p-4">
            <div className="text-[16px] font-medium text-white">New client</div>
            <div className="mt-3 space-y-2">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Name *"
                className="w-full rounded-[8px] border border-[#1e1e2e] bg-[#0a0a0f] px-3 py-2 text-[13px] text-white outline-none"
              />
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="Phone"
                className="w-full rounded-[8px] border border-[#1e1e2e] bg-[#0a0a0f] px-3 py-2 text-[13px] text-white outline-none"
              />
              <input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="Email"
                className="w-full rounded-[8px] border border-[#1e1e2e] bg-[#0a0a0f] px-3 py-2 text-[13px] text-white outline-none"
              />
              <div className="flex gap-2">
                <input
                  value={form.budget_min}
                  onChange={(e) =>
                    setForm({ ...form, budget_min: e.target.value })
                  }
                  placeholder="Budget min"
                  inputMode="numeric"
                  className="w-1/2 rounded-[8px] border border-[#1e1e2e] bg-[#0a0a0f] px-3 py-2 text-[13px] text-white outline-none"
                />
                <input
                  value={form.budget_max}
                  onChange={(e) =>
                    setForm({ ...form, budget_max: e.target.value })
                  }
                  placeholder="Budget max"
                  inputMode="numeric"
                  className="w-1/2 rounded-[8px] border border-[#1e1e2e] bg-[#0a0a0f] px-3 py-2 text-[13px] text-white outline-none"
                />
              </div>
              <div className="text-[11px] text-[#666680]">
                Preferred towns (NJ)
              </div>
              <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
                {NJ_TOWN_OPTIONS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTown(t)}
                    className={`rounded-full border px-2 py-1 text-[10px] font-medium ${
                      form.towns.includes(t)
                        ? "border-[#4f7bff] bg-[#4f7bff]/15 text-[#6f9bff]"
                        : "border-[#1e1e2e] text-[#666680]"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={form.beds}
                  onChange={(e) => setForm({ ...form, beds: e.target.value })}
                  placeholder="Beds"
                  inputMode="numeric"
                  className="w-1/2 rounded-[8px] border border-[#1e1e2e] bg-[#0a0a0f] px-3 py-2 text-[13px] text-white outline-none"
                />
                <input
                  value={form.baths}
                  onChange={(e) => setForm({ ...form, baths: e.target.value })}
                  placeholder="Baths"
                  inputMode="decimal"
                  className="w-1/2 rounded-[8px] border border-[#1e1e2e] bg-[#0a0a0f] px-3 py-2 text-[13px] text-white outline-none"
                />
              </div>
              <div className="flex gap-2">
                {(["buyer", "seller"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setForm({ ...form, client_role: r })}
                    className={`flex-1 rounded-[8px] border py-2 text-[12px] font-medium capitalize ${
                      form.client_role === r
                        ? "border-[#4f7bff] text-[#6f9bff]"
                        : "border-[#1e1e2e] text-[#666680]"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Notes"
                className="min-h-[72px] w-full rounded-[8px] border border-[#1e1e2e] bg-[#0a0a0f] p-3 text-[13px] text-white outline-none"
              />
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={saveClient}
                className="flex-1 rounded-[8px] bg-[#4f7bff] py-2 text-[13px] font-medium text-white"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-[8px] border border-[#1e1e2e] px-3 py-2 text-[13px] text-[#666680]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

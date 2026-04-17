"use client";

import { ClientRow, type ClientRowData } from "@/components/ClientRow";
import { useToast } from "@/components/ToastProvider";
import { NJ_TOWN_OPTIONS } from "@/lib/nj-towns";
import { createClient } from "@/lib/supabase/client";
import { formatPhoneE164 } from "@/lib/utils";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

const chips = [
  "All",
  "Hot",
  "Follow Up",
  "Showing",
  "Under Contract",
  "Closed",
] as const;

export function ClientsPageClient({
  initial,
}: {
  initial: Record<string, unknown>[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [chip, setChip] = useState<(typeof chips)[number]>("All");
  const [open, setOpen] = useState(false);
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

  const rows = initial as ClientRowData[];

  const filtered = useMemo(() => {
    return rows.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q.toLowerCase())) return false;
      if (chip === "All") return true;
      if (chip === "Hot") return (c.lead_score ?? 0) >= 8;
      if (chip === "Follow Up") return (c.lead_score ?? 0) < 5;
      if (chip === "Showing") return c.status === "showing";
      if (chip === "Under Contract") return c.status === "under_contract";
      if (chip === "Closed") return c.status === "closed";
      return true;
    });
  }, [rows, q, chip]);

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
    const phoneE164 = form.phone.trim()
      ? formatPhoneE164(form.phone)
      : null;
    const townJoined =
      form.towns.length > 0 ? form.towns.join(", ") : null;

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
    <div className="mx-auto max-w-lg px-4 pb-28 pt-6">
      <div className="text-[20px] font-medium text-text-primary">Clients</div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search"
        className="mt-4 w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-3 text-[13px] text-text-primary"
      />
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {chips.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setChip(c)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-medium ${
              chip === c
                ? "border-accent-blue text-accent-blue"
                : "border-border-card text-text-dim"
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="mt-4 space-y-2">
        {filtered.map((c) => (
          <ClientRow
            key={c.id}
            c={{
              ...c,
              automation_active: (c as { automation_day?: number }).automation_day
                ? true
                : true,
            }}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent-blue text-white"
        aria-label="Add client"
      >
        <Plus />
      </button>

      {open ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[14px] border border-border-card bg-bg-card p-4">
            <div className="text-[16px] font-medium text-text-primary">
              New client
            </div>
            <div className="mt-3 space-y-2">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Name *"
                className="w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px]"
              />
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="Phone"
                className="w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px]"
              />
              <input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="Email"
                className="w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px]"
              />
              <div className="flex gap-2">
                <input
                  value={form.budget_min}
                  onChange={(e) =>
                    setForm({ ...form, budget_min: e.target.value })
                  }
                  placeholder="Budget min"
                  inputMode="numeric"
                  className="w-1/2 rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px]"
                />
                <input
                  value={form.budget_max}
                  onChange={(e) =>
                    setForm({ ...form, budget_max: e.target.value })
                  }
                  placeholder="Budget max"
                  inputMode="numeric"
                  className="w-1/2 rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px]"
                />
              </div>
              <div className="text-[11px] text-text-dim">Preferred towns (NJ)</div>
              <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
                {NJ_TOWN_OPTIONS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTown(t)}
                    className={`rounded-full border px-2 py-1 text-[10px] font-medium ${
                      form.towns.includes(t)
                        ? "border-accent-blue bg-accent-blue/15 text-accent-blue"
                        : "border-border-card text-text-dim"
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
                  className="w-1/2 rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px]"
                />
                <input
                  value={form.baths}
                  onChange={(e) => setForm({ ...form, baths: e.target.value })}
                  placeholder="Baths"
                  inputMode="decimal"
                  className="w-1/2 rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px]"
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
                        ? "border-accent-blue text-accent-blue"
                        : "border-border-card text-text-dim"
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
                className="min-h-[72px] w-full rounded-[8px] border border-border-card bg-bg-deep p-3 text-[13px]"
              />
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={saveClient}
                className="flex-1 rounded-[8px] bg-accent-blue py-2 text-[13px] font-medium text-white"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-[8px] border border-border-card px-3 py-2 text-[13px] text-text-dim"
              >
                Cancel
              </button>
            </div>
            <Link
              href="/inbox"
              className="mt-3 block text-center text-[12px] text-accent-blue"
            >
              Review drafted text in Inbox
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

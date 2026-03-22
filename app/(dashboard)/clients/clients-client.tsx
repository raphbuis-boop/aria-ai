"use client";

import { ClientRow, type ClientRowData } from "@/components/ClientRow";
import { useToast } from "@/components/ToastProvider";
import { createClient } from "@/lib/supabase/client";
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
    town: "",
    budget_max: "",
    source: "manual",
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

  async function saveClient() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: created, error } = await supabase
      .from("clients")
      .insert({
        agent_id: user.id,
        name: form.name,
        phone: form.phone || null,
        email: form.email || null,
        town: form.town || null,
        budget_max: form.budget_max ? Number(form.budget_max) : null,
        source: form.source as "manual",
        status: "new",
      })
      .select("id")
      .single();
    if (error) {
      toast.toast(error.message, "warn");
      return;
    }
    setOpen(false);
    const res = await fetch("/api/ai/draft-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: created.id,
        clientName: form.name,
        context: "Speed to lead",
        scenario: "Welcome text after new lead",
      }),
    });
    await res.json();
    toast.toast("Aria drafted a welcome text. Send now?", "success");
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
          <div className="w-full max-w-md rounded-[14px] border border-border-card bg-bg-card p-4">
            <div className="text-[16px] font-medium text-text-primary">
              New client
            </div>
            <div className="mt-3 space-y-2">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Name"
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
              <input
                value={form.town}
                onChange={(e) => setForm({ ...form, town: e.target.value })}
                placeholder="Town"
                className="w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px]"
              />
              <input
                value={form.budget_max}
                onChange={(e) =>
                  setForm({ ...form, budget_max: e.target.value })
                }
                placeholder="Budget max"
                className="w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px]"
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

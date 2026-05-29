"use client";

import { NJ_TOWN_OPTIONS } from "@/lib/nj-towns";
import { createClient } from "@/lib/supabase/client";
import { formatPhoneE164 } from "@/lib/utils";
import { useToast } from "@/components/ToastProvider";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type ClientRecord = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  status: string | null;
  budget_min: number | null;
  budget_max: number | null;
  town: string | null;
  beds_wanted: number | null;
  baths_wanted: number | null;
  lead_score: number | null;
  notes: string | null;
  client_role: string | null;
};

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "showing", label: "Showing" },
  { value: "offer", label: "Offer" },
  { value: "under_contract", label: "Under Contract" },
  { value: "closed", label: "Closed" },
];

function splitTowns(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export function EditClientModal({
  client,
  onClose,
}: {
  client: ClientRecord;
  onClose: () => void;
}) {
  const supabase = createClient();
  const toast = useToast();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const initialTowns = useMemo(() => splitTowns(client.town), [client.town]);

  const [form, setForm] = useState({
    name: client.name ?? "",
    phone: client.phone ?? "",
    email: client.email ?? "",
    status: client.status ?? "new",
    budget_min: client.budget_min != null ? String(client.budget_min) : "",
    budget_max: client.budget_max != null ? String(client.budget_max) : "",
    towns: initialTowns,
    beds: client.beds_wanted != null ? String(client.beds_wanted) : "",
    baths: client.baths_wanted != null ? String(client.baths_wanted) : "",
    lead_score: client.lead_score ?? 5,
    notes: client.notes ?? "",
    client_role: (client.client_role as "buyer" | "seller") ?? "buyer",
  });

  function toggleTown(t: string) {
    setForm((f) => ({
      ...f,
      towns: f.towns.includes(t)
        ? f.towns.filter((x) => x !== t)
        : [...f.towns, t],
    }));
  }

  async function save() {
    if (!form.name.trim()) {
      toast.toast("Name is required", "warn");
      return;
    }
    setSaving(true);
    const phoneE164 = form.phone.trim() ? formatPhoneE164(form.phone) : null;
    const payload = {
      name: form.name.trim(),
      phone: phoneE164,
      email: form.email.trim() || null,
      status: form.status,
      budget_min: form.budget_min ? Number(form.budget_min) : null,
      budget_max: form.budget_max ? Number(form.budget_max) : null,
      town: form.towns.length ? form.towns.join(", ") : null,
      beds_wanted: form.beds ? Number(form.beds) : null,
      baths_wanted: form.baths ? Number(form.baths) : null,
      lead_score: Number(form.lead_score),
      notes: form.notes.trim() || null,
      client_role: form.client_role,
    };
    const { error } = await supabase
      .from("clients")
      .update(payload)
      .eq("id", client.id);
    setSaving(false);
    if (error) {
      toast.toast(error.message, "warn");
      return;
    }
    toast.toast("Client updated", "success");
    onClose();
    router.refresh();
  }

  async function destroy() {
    setDeleting(true);
    const { error } = await supabase
      .from("clients")
      .delete()
      .eq("id", client.id);
    setDeleting(false);
    if (error) {
      toast.toast(error.message, "warn");
      return;
    }
    toast.toast("Client deleted", "success");
    onClose();
    router.push("/clients");
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 backdrop-blur-[2px]">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className="relative z-10 max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-[24px] border-[0.5px] border-b-0 border-[#1e2230] bg-[#0d0f16] px-5 pb-9 pt-4">
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-[#2a2e40]" />
        <div className="mb-1 text-[15px] font-semibold text-[#e8eaf2]">
          Edit client
        </div>
        <p className="mb-4 text-xs text-[#555570]">
          Changes save to your clients table.
        </p>

        <div className="space-y-2.5">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Full name *"
            className="w-full rounded-[14px] border-[0.5px] border-[#222238] bg-[#0d0f16] px-4 py-3 text-sm text-[#e8eaf2] placeholder-[#6b7090] outline-none focus:border-[#3a65f0]/40"
          />
          <div className="flex gap-2">
            <div className="flex w-1/2 flex-col gap-1">
              <p className="text-[11px] font-semibold uppercase" style={{ color: "#6B7280", letterSpacing: "0.08em" }}>Phone</p>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="Phone"
                inputMode="tel"
                className="w-full rounded-[14px] border-[0.5px] border-[#222238] bg-[#0d0f16] px-4 py-3 text-sm text-[#e8eaf2] placeholder-[#6b7090] outline-none focus:border-[#3a65f0]/40"
              />
            </div>
            <div className="flex w-1/2 flex-col gap-1">
              <p className="text-[11px] font-semibold uppercase" style={{ color: "#6B7280", letterSpacing: "0.08em" }}>Email</p>
              <input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="Email"
                inputMode="email"
                className="w-full rounded-[14px] border-[0.5px] border-[#222238] bg-[#0d0f16] px-4 py-3 text-sm text-[#e8eaf2] placeholder-[#6b7090] outline-none focus:border-[#3a65f0]/40"
              />
              <p className="text-[11px]" style={{ color: "#6B7280" }}>Used to sync Gmail conversations</p>
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[1.2px] text-[#6b7090]">
              Status
            </p>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full appearance-none rounded-[14px] border-[0.5px] border-[#222238] bg-[#0d0f16] px-4 py-3 text-sm text-[#e8eaf2] outline-none focus:border-[#3a65f0]/40"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            {(["buyer", "seller"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setForm({ ...form, client_role: r })}
                className={`flex-1 rounded-[12px] border-[0.5px] py-2.5 text-xs font-semibold uppercase tracking-wider transition ${
                  form.client_role === r
                    ? "border-[#3a65f0]/40 bg-[#3a65f0]/12 text-[#6b8fff]"
                    : "border-[#1e2230] bg-[#0d0f16] text-[#555570]"
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              value={form.budget_min}
              onChange={(e) =>
                setForm({ ...form, budget_min: e.target.value })
              }
              placeholder="Budget min"
              inputMode="numeric"
              className="w-1/2 rounded-[14px] border-[0.5px] border-[#222238] bg-[#0d0f16] px-4 py-3 text-sm text-[#e8eaf2] placeholder-[#6b7090] outline-none focus:border-[#3a65f0]/40"
            />
            <input
              value={form.budget_max}
              onChange={(e) =>
                setForm({ ...form, budget_max: e.target.value })
              }
              placeholder="Budget max"
              inputMode="numeric"
              className="w-1/2 rounded-[14px] border-[0.5px] border-[#222238] bg-[#0d0f16] px-4 py-3 text-sm text-[#e8eaf2] placeholder-[#6b7090] outline-none focus:border-[#3a65f0]/40"
            />
          </div>

          <div className="flex gap-2">
            <input
              value={form.beds}
              onChange={(e) => setForm({ ...form, beds: e.target.value })}
              placeholder="Beds"
              inputMode="numeric"
              className="w-1/2 rounded-[14px] border-[0.5px] border-[#222238] bg-[#0d0f16] px-4 py-3 text-sm text-[#e8eaf2] placeholder-[#6b7090] outline-none focus:border-[#3a65f0]/40"
            />
            <input
              value={form.baths}
              onChange={(e) => setForm({ ...form, baths: e.target.value })}
              placeholder="Baths"
              inputMode="decimal"
              className="w-1/2 rounded-[14px] border-[0.5px] border-[#222238] bg-[#0d0f16] px-4 py-3 text-sm text-[#e8eaf2] placeholder-[#6b7090] outline-none focus:border-[#3a65f0]/40"
            />
          </div>

          <div className="pt-1">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[1.2px] text-[#6b7090]">
                Lead score
              </p>
              <span className="text-[13px] font-semibold text-[#6b8fff]">
                {form.lead_score} / 10
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={form.lead_score}
              onChange={(e) =>
                setForm({ ...form, lead_score: Number(e.target.value) })
              }
              className="w-full accent-[#3a65f0]"
            />
          </div>

          <div className="pt-1">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[1.2px] text-[#6b7090]">
              Preferred towns
            </p>
            <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto rounded-[14px] border-[0.5px] border-[#1c1c2e] bg-[#0d0f16] p-3">
              {NJ_TOWN_OPTIONS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTown(t)}
                  className={`rounded-full border-[0.5px] px-2.5 py-1 text-[11px] font-medium transition ${
                    form.towns.includes(t)
                      ? "border-[#3a65f0]/40 bg-[#3a65f0]/12 text-[#6b8fff]"
                      : "border-[#1e2230] bg-[#12121e] text-[#9498b0]"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Notes (timeline, motivations, anything useful)"
            rows={4}
            className="mt-1 w-full resize-none rounded-[14px] border-[0.5px] border-[#222238] bg-[#0d0f16] p-4 text-sm text-[#e8eaf2] placeholder-[#6b7090] outline-none focus:border-[#3a65f0]/40"
          />
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="flex-1 rounded-[12px] bg-[#3a65f0] py-3 text-sm font-semibold text-white transition active:bg-[#4369de] disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[12px] border-[0.5px] border-[#2a2e40] bg-transparent px-4 py-3 text-sm font-semibold text-[#888]"
          >
            Cancel
          </button>
        </div>

        <div className="mt-6 border-t border-[#1e2230] pt-5">
          {confirmDelete ? (
            <div className="rounded-[14px] border-[0.5px] border-[#3a1a1a] bg-[#1a0f0f] p-4">
              <p className="text-[13px] font-semibold text-[#e8eaf2]">
                Delete this client?
              </p>
              <p className="mt-1 text-[12px] text-[#a08890]">
                This cannot be undone. Activities, tasks, and the BBA will
                remain associated.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={destroy}
                  disabled={deleting}
                  className="flex-1 rounded-[10px] bg-gradient-to-br from-[#c43838] to-[#ff4848] py-2.5 text-[13px] font-semibold text-white disabled:opacity-60"
                >
                  {deleting ? "Deleting…" : "Yes, delete"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-[10px] border-[0.5px] border-[#2a2e40] px-4 py-2.5 text-[13px] font-semibold text-[#888]"
                >
                  Keep
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-[12px] border-[0.5px] border-[#3a1a1a] bg-transparent py-2.5 text-[13px] font-semibold text-[#c43838]"
            >
              <Trash2 size={14} /> Delete client
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

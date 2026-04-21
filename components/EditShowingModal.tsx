"use client";

import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export type EditShowingRecord = {
  id: string;
  client_id: string | null;
  address: string | null;
  showing_date: string | null;
  status: string | null;
  notes: string | null;
};

const STATUS_OPTIONS = [
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EditShowingModal({
  showing,
  onClose,
}: {
  showing: EditShowingRecord;
  onClose: () => void;
}) {
  const supabase = createClient();
  const toast = useToast();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);

  const [form, setForm] = useState({
    client_id: showing.client_id ?? "",
    address: showing.address ?? "",
    showing_date: toLocalInputValue(showing.showing_date),
    status: showing.status ?? "scheduled",
    notes: showing.notes ?? "",
  });

  useEffect(() => {
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("clients")
        .select("id, name")
        .eq("agent_id", user.id);
      setClients((data as { id: string; name: string }[]) ?? []);
    })();
  }, [supabase]);

  async function save() {
    if (!form.address.trim()) {
      toast.toast("Address is required", "warn");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("showings")
      .update({
        client_id: form.client_id || null,
        address: form.address.trim(),
        showing_date: form.showing_date
          ? new Date(form.showing_date).toISOString()
          : null,
        status: form.status,
        notes: form.notes.trim() || null,
      })
      .eq("id", showing.id);
    setSaving(false);
    if (error) {
      toast.toast(error.message, "warn");
      return;
    }
    toast.toast("Showing updated", "success");
    onClose();
    router.refresh();
  }

  const inputClass =
    "w-full rounded-[14px] border-[0.5px] border-[#222238] bg-[#0a0a14] px-4 py-3 text-sm text-[#d0d0e0] placeholder-[#444460] outline-none focus:border-[#4f7bff]/40";

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 backdrop-blur-[2px]">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className="relative z-10 max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-[24px] border-[0.5px] border-b-0 border-[#1e1e2e] bg-[#0f0f1a] px-5 pb-9 pt-4">
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-[#2a2a3e]" />
        <div className="mb-1 text-[15px] font-semibold text-[#f0eee8]">
          Edit showing
        </div>
        <p className="mb-4 text-xs text-[#555570]">
          Changes save to your showings table.
        </p>

        <div className="space-y-2.5">
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[1.2px] text-[#444460]">
              Client
            </p>
            <select
              value={form.client_id}
              onChange={(e) =>
                setForm({ ...form, client_id: e.target.value })
              }
              className={`${inputClass} appearance-none`}
            >
              <option value="">Select client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="Property address *"
            className={inputClass}
          />
          <input
            type="datetime-local"
            value={form.showing_date}
            onChange={(e) =>
              setForm({ ...form, showing_date: e.target.value })
            }
            className={inputClass}
          />
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[1.2px] text-[#444460]">
              Status
            </p>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className={`${inputClass} appearance-none`}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Notes"
            rows={4}
            className={`${inputClass} resize-none`}
          />
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="flex-1 rounded-[12px] bg-[#4f7bff] py-3 text-sm font-semibold text-white transition active:bg-[#4369de] disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[12px] border-[0.5px] border-[#2a2a3e] bg-transparent px-4 py-3 text-sm font-semibold text-[#888]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

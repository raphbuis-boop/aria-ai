"use client";

import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type EditTransactionRecord = {
  id: string;
  address: string | null;
  contract_price: number | null;
  closing_date: string | null;
  inspection_date: string | null;
  appraisal_date: string | null;
  mortgage_commitment_date: string | null;
  attorney_name: string | null;
  attorney_email: string | null;
  lender_name: string | null;
  lender_email: string | null;
  status: string | null;
};

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "under_contract", label: "Under Contract" },
  { value: "closed", label: "Closed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "archived", label: "Archived" },
];

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EditTransactionModal({
  tx,
  onClose,
}: {
  tx: EditTransactionRecord;
  onClose: () => void;
}) {
  const supabase = createClient();
  const toast = useToast();
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    address: tx.address ?? "",
    contract_price: tx.contract_price != null ? String(tx.contract_price) : "",
    closing_date: toLocalInputValue(tx.closing_date),
    inspection_date: toLocalInputValue(tx.inspection_date),
    appraisal_date: toLocalInputValue(tx.appraisal_date),
    mortgage_commitment_date: toLocalInputValue(tx.mortgage_commitment_date),
    attorney_name: tx.attorney_name ?? "",
    attorney_email: tx.attorney_email ?? "",
    lender_name: tx.lender_name ?? "",
    lender_email: tx.lender_email ?? "",
    status: tx.status ?? "active",
  });

  const inputClass =
    "w-full rounded-[14px] border-[0.5px] border-border bg-card px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary/40";

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("transactions")
      .update({
        address: form.address.trim() || null,
        contract_price: form.contract_price ? Number(form.contract_price) : null,
        closing_date: form.closing_date
          ? new Date(form.closing_date).toISOString()
          : null,
        inspection_date: form.inspection_date
          ? new Date(form.inspection_date).toISOString()
          : null,
        appraisal_date: form.appraisal_date
          ? new Date(form.appraisal_date).toISOString()
          : null,
        mortgage_commitment_date: form.mortgage_commitment_date
          ? new Date(form.mortgage_commitment_date).toISOString()
          : null,
        attorney_name: form.attorney_name.trim() || null,
        attorney_email: form.attorney_email.trim() || null,
        lender_name: form.lender_name.trim() || null,
        lender_email: form.lender_email.trim() || null,
        status: form.status,
      })
      .eq("id", tx.id);
    setSaving(false);
    if (error) {
      toast.toast(error.message, "warn");
      return;
    }
    toast.toast("Transaction updated", "success");
    onClose();
    router.refresh();
  }

  const milestones: [keyof typeof form, string][] = [
    ["closing_date", "Closing"],
    ["inspection_date", "Inspection"],
    ["appraisal_date", "Appraisal"],
    ["mortgage_commitment_date", "Mortgage commitment"],
  ];

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-foreground/40 backdrop-blur-[2px]">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className="relative z-10 max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-[24px] border-[0.5px] border-b-0 border-border bg-card px-5 pb-9 pt-4">
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-input" />
        <div className="mb-1 text-[15px] font-semibold text-foreground">
          Edit transaction
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          Changes save to your transactions table.
        </p>

        <div className="space-y-2.5">
          <input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="Address"
            className={inputClass}
          />
          <input
            value={form.contract_price}
            onChange={(e) =>
              setForm({ ...form, contract_price: e.target.value })
            }
            placeholder="Contract price"
            inputMode="numeric"
            className={inputClass}
          />

          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[1.2px] text-muted-foreground">
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

          <p className="pt-1 text-[10px] font-semibold uppercase tracking-[1.2px] text-muted-foreground">
            Milestones
          </p>
          {milestones.map(([k, label]) => (
            <div key={k}>
              <p className="mb-1 text-[11px] text-muted-foreground">{label}</p>
              <input
                type="datetime-local"
                value={form[k] as string}
                onChange={(e) =>
                  setForm((f) => ({ ...f, [k]: e.target.value }))
                }
                className={inputClass}
              />
            </div>
          ))}

          <p className="pt-1 text-[10px] font-semibold uppercase tracking-[1.2px] text-muted-foreground">
            Parties
          </p>
          <div className="flex gap-2">
            <input
              value={form.attorney_name}
              onChange={(e) =>
                setForm({ ...form, attorney_name: e.target.value })
              }
              placeholder="Attorney name"
              className={`${inputClass} w-1/2`}
            />
            <input
              value={form.attorney_email}
              onChange={(e) =>
                setForm({ ...form, attorney_email: e.target.value })
              }
              placeholder="Attorney email"
              inputMode="email"
              className={`${inputClass} w-1/2`}
            />
          </div>
          <div className="flex gap-2">
            <input
              value={form.lender_name}
              onChange={(e) =>
                setForm({ ...form, lender_name: e.target.value })
              }
              placeholder="Lender name"
              className={`${inputClass} w-1/2`}
            />
            <input
              value={form.lender_email}
              onChange={(e) =>
                setForm({ ...form, lender_email: e.target.value })
              }
              placeholder="Lender email"
              inputMode="email"
              className={`${inputClass} w-1/2`}
            />
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="flex-1 rounded-[12px] bg-primary py-3 text-sm font-semibold text-primary-foreground transition active:bg-primary disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[12px] border-[0.5px] border-input bg-transparent px-4 py-3 text-sm font-semibold text-muted-foreground"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

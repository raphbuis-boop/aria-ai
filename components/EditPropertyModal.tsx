"use client";

import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type EditPropertyRecord = {
  id: string;
  address: string | null;
  town: string | null;
  price: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  status: string | null;
  description?: string | null;
};

const STATUS_OPTIONS = [
  { value: "available", label: "Available" },
  { value: "pending", label: "Pending" },
  { value: "sold", label: "Sold" },
  { value: "archived", label: "Archived" },
];

export function EditPropertyModal({
  property,
  onClose,
}: {
  property: EditPropertyRecord;
  onClose: () => void;
}) {
  const supabase = createClient();
  const toast = useToast();
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    address: property.address ?? "",
    town: property.town ?? "",
    price: property.price != null ? String(property.price) : "",
    beds: property.beds != null ? String(property.beds) : "",
    baths: property.baths != null ? String(property.baths) : "",
    sqft: property.sqft != null ? String(property.sqft) : "",
    status: property.status ?? "available",
    description: property.description ?? "",
  });

  async function save() {
    if (!form.address.trim()) {
      toast.toast("Address is required", "warn");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("properties")
      .update({
        address: form.address.trim(),
        town: form.town.trim() || null,
        price: form.price ? Number(form.price) : null,
        beds: form.beds ? Number(form.beds) : null,
        baths: form.baths ? Number(form.baths) : null,
        sqft: form.sqft ? Number(form.sqft) : null,
        status: form.status,
        description: form.description.trim() || null,
      })
      .eq("id", property.id);
    setSaving(false);
    if (error) {
      toast.toast(error.message, "warn");
      return;
    }
    toast.toast("Property updated", "success");
    onClose();
    router.refresh();
  }

  const inputClass =
    "w-full rounded-[14px] border-[0.5px] border-[#222238] bg-[#0d0f16] px-4 py-3 text-sm text-[#e8eaf2] placeholder-[#6b7090] outline-none focus:border-[#3a65f0]/40";

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
          Edit property
        </div>
        <p className="mb-4 text-xs text-[#555570]">
          Changes save to your properties table.
        </p>

        <div className="space-y-2.5">
          <input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="Address *"
            className={inputClass}
          />
          <input
            value={form.town}
            onChange={(e) => setForm({ ...form, town: e.target.value })}
            placeholder="Town"
            className={inputClass}
          />
          <input
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            placeholder="Price"
            inputMode="numeric"
            className={inputClass}
          />
          <div className="flex gap-2">
            <input
              value={form.beds}
              onChange={(e) => setForm({ ...form, beds: e.target.value })}
              placeholder="Beds"
              inputMode="numeric"
              className={`${inputClass} w-1/3`}
            />
            <input
              value={form.baths}
              onChange={(e) => setForm({ ...form, baths: e.target.value })}
              placeholder="Baths"
              inputMode="decimal"
              className={`${inputClass} w-1/3`}
            />
            <input
              value={form.sqft}
              onChange={(e) => setForm({ ...form, sqft: e.target.value })}
              placeholder="Sqft"
              inputMode="numeric"
              className={`${inputClass} w-1/3`}
            />
          </div>

          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[1.2px] text-[#6b7090]">
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
            value={form.description}
            onChange={(e) =>
              setForm({ ...form, description: e.target.value })
            }
            placeholder="Description"
            rows={3}
            className={`${inputClass} resize-none`}
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
      </div>
    </div>
  );
}

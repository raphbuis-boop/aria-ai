"use client";

import { useState } from "react";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  danger = true,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function handleConfirm() {
    try {
      setBusy(true);
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-5 backdrop-blur-[2px]">
      <button
        type="button"
        aria-label="Cancel"
        className="absolute inset-0"
        onClick={onCancel}
      />
      <div className="relative z-10 w-full max-w-sm rounded-[18px] border-[0.5px] border-[#1e2230] bg-[#0d0f16] p-5">
        <h3 className="text-[15px] font-semibold text-[#e8eaf2]">{title}</h3>
        <p className="mt-1.5 text-[13px] text-[#9498b0]">{message}</p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className={`flex-1 rounded-[12px] py-2.5 text-[13px] font-semibold text-white transition disabled:opacity-60 ${
              danger
                ? "bg-gradient-to-br from-[#c43838] to-[#ff4848] active:brightness-95"
                : "bg-[#3a65f0] active:bg-[#4369de]"
            }`}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-[12px] border-[0.5px] border-[#2a2e40] px-4 py-2.5 text-[13px] font-semibold text-[#888]"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

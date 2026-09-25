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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-scrim px-5 backdrop-blur-[2px]" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
      <button
        type="button"
        aria-label="Cancel"
        tabIndex={-1}
        className="absolute inset-0"
        onClick={onCancel}
      />
      <div className="relative z-10 w-full max-w-sm rounded-[18px] border-[0.5px] border-border bg-card p-5">
        <h2 id="confirm-dialog-title" className="text-[15px] font-semibold text-foreground">{title}</h2>
        <p className="mt-1.5 text-[13px] text-muted-foreground">{message}</p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className={`flex-1 rounded-[12px] py-2.5 text-[13px] font-semibold transition disabled:opacity-60 ${
              danger
                ? "bg-danger text-danger-foreground active:brightness-95"
                : "bg-primary text-primary-foreground"
            }`}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-[12px] border-[0.5px] border-input px-4 py-2.5 text-[13px] font-semibold text-muted-foreground"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

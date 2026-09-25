"use client";

import { Toaster as SonnerToaster, toast } from "sonner";

/** Sonner toasts, colored from the theme tokens so they follow light/dark. */
export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      theme="light"
      closeButton
      toastOptions={{
        style: {
          background: "var(--popover)",
          color: "var(--popover-foreground)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          boxShadow: "0 12px 32px -12px rgb(var(--shadow-color) / 0.25)",
        },
        classNames: {
          toast:
            "group toast border border-border bg-popover text-popover-foreground font-[family-name:var(--font-sans)] shadow-none",
          description: "text-muted-foreground",
          actionButton: "bg-primary text-primary-foreground",
          cancelButton: "bg-secondary text-secondary-foreground",
        },
      }}
    />
  );
}

export { toast };

"use client";

import { Toaster as SonnerToaster, toast } from "sonner";

/**
 * Sonner-based Toaster — shadcn's modern toast primitive.
 *
 * Aria already has a custom `ToastProvider` at `@/components/ToastProvider`
 * which is wired into `app/layout.tsx`. This file gives you a second
 * option (used by newer shadcn recipes via `toast(...)` from "sonner").
 *
 * To adopt it, mount <Toaster /> in your root layout AFTER the existing
 * ToastProvider, and call `toast("message")` from any client component.
 * Both can coexist; eventually you may want to consolidate on one.
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      theme="dark"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "group toast border border-border-card bg-bg-card text-text-primary shadow-lg",
          description: "text-text-muted",
          actionButton: "bg-accent-blue text-white",
          cancelButton: "bg-bg-deep text-text-muted",
        },
      }}
    />
  );
}

export { toast };

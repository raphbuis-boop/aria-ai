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
      position="top-center"
      theme="dark"
      closeButton
      toastOptions={{
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

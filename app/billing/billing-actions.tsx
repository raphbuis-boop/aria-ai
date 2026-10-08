"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { AccessReason } from "@/lib/access";

export function BillingActions({
  reason,
  billingEnabled,
  allowed,
  pending,
}: {
  reason: AccessReason;
  billingEnabled: boolean;
  allowed: boolean;
  pending: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"checkout" | "portal" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // After Checkout, the webhook usually lands within seconds — re-check until it does.
  useEffect(() => {
    if (!pending) return;
    let tries = 0;
    const id = setInterval(() => {
      tries++;
      router.refresh();
      if (tries >= 10) clearInterval(id);
    }, 2000);
    return () => clearInterval(id);
  }, [pending, router]);

  async function go(kind: "checkout" | "portal") {
    setBusy(kind);
    setError(null);
    try {
      const res = await fetch(`/api/billing/${kind}`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Something went wrong. Try again.");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
      setBusy(null);
    }
  }

  async function signOut() {
    await createClient().auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="mt-8 space-y-3">
      {billingEnabled && (reason === "trial" || reason === "payment_required") ? (
        <Button onClick={() => void go("checkout")} disabled={busy !== null} className="h-12 w-full rounded-xl text-body-lg font-semibold">
          {busy === "checkout" ? "Opening checkout…" : "Subscribe"}
        </Button>
      ) : null}
      {billingEnabled && reason === "subscribed" ? (
        <Button onClick={() => void go("portal")} disabled={busy !== null} variant="outline" className="h-12 w-full rounded-xl text-body-lg font-semibold">
          {busy === "portal" ? "Opening…" : "Manage billing"}
        </Button>
      ) : null}
      {allowed ? (
        <Button onClick={() => router.push("/dashboard")} variant={reason === "trial" ? "outline" : "default"} className="h-12 w-full rounded-xl text-body-lg font-semibold">
          Go to Aria
        </Button>
      ) : null}
      {error ? (
        <p role="alert" className="text-center font-display text-body text-danger">
          {error}
        </p>
      ) : null}
      <button type="button" onClick={() => void signOut()} className="w-full py-3 font-display text-body text-muted-foreground">
        Sign out
      </button>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { Mail, Loader2, Link as LinkIcon } from "lucide-react";
import { useToast } from "@/components/ToastProvider";

interface Status {
  configured: boolean;
  connected: boolean;
  emailAddress: string | null;
  connectedAt: string | null;
  lastUsedAt: string | null;
  scopes: string[];
}

export function GmailConnectionSection() {
  const toast = useToast();
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/gmail/status");
      if (!res.ok) {
        setStatus({
          configured: false,
          connected: false,
          emailAddress: null,
          connectedAt: null,
          lastUsedAt: null,
          scopes: [],
        });
      } else {
        setStatus((await res.json()) as Status);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Surface callback query params once on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const result = params.get("gmail");
    if (!result) return;

    if (result === "connected=1" || result === "1") {
      toast.toast("Gmail connected", "success");
    } else if (result.startsWith("error=")) {
      const msg = decodeURIComponent(result.slice("error=".length));
      toast.toast(`Gmail connection failed: ${msg}`, "warn");
    }

    params.delete("gmail");
    const search = params.toString();
    const url =
      window.location.pathname + (search ? `?${search}` : "") + window.location.hash;
    window.history.replaceState({}, "", url);
  }, [toast]);

  async function connect() {
    setWorking(true);
    try {
      const res = await fetch("/api/gmail/auth");
      if (res.status === 501) {
        toast.toast(
          "Gmail OAuth is not configured on this deployment",
          "warn",
        );
        return;
      }
      if (!res.ok) {
        toast.toast("Could not start Gmail auth", "warn");
        return;
      }
      const data = (await res.json()) as { url: string };
      window.location.href = data.url;
    } catch {
      toast.toast("Network error starting Gmail auth", "warn");
    } finally {
      setWorking(false);
    }
  }

  async function disconnect() {
    if (!confirm("Disconnect Gmail? You can reconnect any time.")) return;
    setWorking(true);
    try {
      const res = await fetch("/api/gmail/disconnect", { method: "POST" });
      if (!res.ok) {
        toast.toast("Disconnect failed", "warn");
        return;
      }
      toast.toast("Gmail disconnected", "success");
      await load();
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="mt-8">
      <div className="mb-2 flex items-center gap-2">
        <Mail size={14} className="text-[#6f9bff]" />
        <div className="text-[10px] font-medium uppercase tracking-[0.07em] text-text-dim">
          Gmail connection
        </div>
      </div>

      <div className="rounded-[14px] border border-border-card bg-bg-card p-4">
        {loading ? (
          <div className="flex items-center gap-2 text-[13px] text-text-secondary">
            <Loader2 size={14} className="animate-spin" /> Loading status…
          </div>
        ) : !status?.configured ? (
          <div className="space-y-2 text-[13px] text-text-secondary">
            <p>
              Gmail OAuth isn&apos;t configured on this deployment yet. Set{" "}
              <code className="rounded bg-bg-deep px-1">GOOGLE_CLIENT_ID</code>,{" "}
              <code className="rounded bg-bg-deep px-1">GOOGLE_CLIENT_SECRET</code>
              , and{" "}
              <code className="rounded bg-bg-deep px-1">GOOGLE_REDIRECT_URI</code>{" "}
              in the environment — see the README.
            </p>
          </div>
        ) : status.connected ? (
          <div className="space-y-3">
            <div>
              <div className="text-[13px] font-semibold text-white">
                Connected
              </div>
              <div className="text-[12px] text-text-secondary">
                {status.emailAddress}
              </div>
              {status.connectedAt ? (
                <div className="text-[11px] text-text-dim">
                  Connected{" "}
                  {new Date(status.connectedAt).toLocaleDateString()}
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href="/settings/gmail/test"
                className="inline-flex items-center gap-1 rounded-[8px] border border-border-card bg-bg-deep px-3 py-1.5 text-[12px] font-medium text-[#d0d0e0]"
              >
                <LinkIcon size={12} /> Test connection
              </a>
              <button
                type="button"
                onClick={disconnect}
                disabled={working}
                className="rounded-[8px] border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[12px] font-medium text-red-300 disabled:opacity-60"
              >
                Disconnect
              </button>
              <button
                type="button"
                onClick={connect}
                disabled={working}
                className="rounded-[8px] border border-border-card bg-bg-deep px-3 py-1.5 text-[12px] font-medium text-text-secondary disabled:opacity-60"
              >
                Reconnect
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-[13px] text-text-secondary">
            <p>
              Connect your Gmail account so emails are sent from your own
              address. Aria never stores the contents of your inbox — we only
              cache thread metadata for 60 seconds.
            </p>
            <button
              type="button"
              onClick={connect}
              disabled={working}
              className="rounded-[8px] bg-accent-blue px-4 py-2 text-[13px] font-medium text-white disabled:opacity-60"
            >
              {working ? "Redirecting…" : "Connect Gmail"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

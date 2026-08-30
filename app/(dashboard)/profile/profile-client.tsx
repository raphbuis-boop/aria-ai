"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, LogOut, Mail } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Toaster, toast } from "@/components/ui/sonner";
import { createClient } from "@/lib/supabase/client";
import { initials } from "@/lib/utils";

type Agent = {
  fullName: string;
  email: string;
  brokerage: string;
  license: string;
  licenseState: string;
};

type GmailStatus = { connected: boolean; email?: string | null } | null;

function triggerHaptic() {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(10);
  } catch {
    /* never break */
  }
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="font-display text-section text-muted-foreground mb-3">{children}</p>;
}

function Toggle({ on, onChange }: { on: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => {
        triggerHaptic();
        onChange(!on);
      }}
      className="relative h-7 w-12 shrink-0 rounded-full transition-colors"
      style={{ background: on ? "var(--primary)" : "var(--border)" }}
    >
      <span
        className="absolute top-0.5 size-6 rounded-full bg-card shadow-sm transition-transform"
        style={{ transform: on ? "translateX(22px)" : "translateX(2px)" }}
      />
    </button>
  );
}

function ToggleRow({
  label,
  sublabel,
  on,
  onChange,
  isLast = false,
}: {
  label: string;
  sublabel?: string;
  on: boolean;
  onChange: (next: boolean) => void;
  isLast?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-4 px-5 py-4 ${isLast ? "" : "border-b border-border"}`}>
      <div className="min-w-0">
        <p className="font-display text-body-lg text-foreground">{label}</p>
        {sublabel && <p className="font-display text-caption text-muted-foreground mt-0.5">{sublabel}</p>}
      </div>
      <Toggle on={on} onChange={onChange} />
    </div>
  );
}

export function ProfileClient({ agent }: { agent: Agent }) {
  const supabase = createClient();
  const router = useRouter();
  const [gmailStatus, setGmailStatus] = useState<GmailStatus>(null);

  // Notification toggles aren't wired to a real preferences store yet —
  // sensible defaults, real local interaction, no fabricated persistence.
  const [notifyFollowUps, setNotifyFollowUps] = useState(true);
  const [notifyMatches, setNotifyMatches] = useState(true);
  const [notifyClosings, setNotifyClosings] = useState(true);

  useEffect(() => {
    void fetch("/api/gmail/status")
      .then((r) => r.json())
      .then((d) => setGmailStatus(d))
      .catch(() => setGmailStatus({ connected: false }));
  }, []);

  const handleGmailConnect = useCallback(() => {
    triggerHaptic();
    window.location.href = "/api/auth/google/connect";
  }, []);

  const handleGmailDisconnect = useCallback(async () => {
    triggerHaptic();
    await fetch("/api/gmail/disconnect", { method: "POST" });
    setGmailStatus({ connected: false });
    toast.success("Gmail disconnected");
  }, []);

  const handleSignOut = useCallback(async () => {
    triggerHaptic();
    await supabase.auth.signOut();
    router.push("/login");
  }, [supabase, router]);

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-5 pt-6 pb-32 sm:px-8 sm:pt-10">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="mb-6 flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary transition-colors"
        >
          <ArrowLeft className="size-4" />
        </button>

        {/* Agent card */}
        <div className="flex items-center gap-4 mb-10">
          <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-secondary font-display text-title font-semibold text-foreground">
            {initials(agent.fullName)}
          </div>
          <div className="min-w-0">
            <h1 className="font-heading text-[24px] leading-tight text-foreground truncate">{agent.fullName}</h1>
            <p className="font-display text-body text-muted-foreground mt-0.5 truncate">{agent.brokerage}</p>
            <p className="font-display text-caption text-muted-foreground/60 mt-0.5">
              License #{agent.license} · {agent.licenseState}
            </p>
          </div>
        </div>

        {/* Account */}
        <section className="mb-8">
          <SectionLabel>Account</SectionLabel>
          <Card className="px-5 py-4">
            <p className="font-display text-caption text-muted-foreground/60 mb-0.5">Email</p>
            <p className="font-display text-body text-foreground">{agent.email || "—"}</p>
          </Card>
        </section>

        {/* Notifications */}
        <section className="mb-8">
          <SectionLabel>Notifications</SectionLabel>
          <Card className="overflow-hidden">
            <ToggleRow label="Follow-up reminders" sublabel="Daily nudge for who needs contact" on={notifyFollowUps} onChange={setNotifyFollowUps} />
            <ToggleRow label="New MLS matches" sublabel="When a listing fits a client" on={notifyMatches} onChange={setNotifyMatches} />
            <ToggleRow label="Closing alerts" sublabel="Deals closing within 3 days" on={notifyClosings} onChange={setNotifyClosings} isLast />
          </Card>
        </section>

        {/* Connected accounts */}
        <section className="mb-8">
          <SectionLabel>Connected accounts</SectionLabel>
          <Card className="px-5 py-4">
            <div className="flex items-center gap-3.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary">
                <Mail className="size-4 text-muted-foreground" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-body-lg text-foreground">Gmail</p>
                <p className="font-display text-caption text-muted-foreground mt-0.5 truncate">
                  {gmailStatus?.connected ? `Connected as ${gmailStatus.email}` : "Not connected"}
                </p>
              </div>
              {gmailStatus?.connected ? (
                <button
                  type="button"
                  onClick={() => void handleGmailDisconnect()}
                  className="font-display text-caption font-semibold text-destructive shrink-0"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleGmailConnect}
                  className="font-display text-caption font-semibold text-primary shrink-0"
                >
                  Connect
                </button>
              )}
            </div>
          </Card>
        </section>

        {/* Sign out */}
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-border py-3.5 font-display text-body-lg font-semibold text-destructive hover:bg-secondary transition-colors"
        >
          <LogOut className="size-4" />
          Sign out
        </button>
      </div>

      <Toaster />
    </div>
  );
}

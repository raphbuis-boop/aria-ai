"use client";

import { createClient } from "@/lib/supabase/client";
import {
  BarChart3,
  Bell,
  CalendarDays,
  ChevronRight,
  FileText,
  Globe,
  Inbox,
  Lock,
  LogOut,
  Mail,
  Mic,
  Sparkles,
  Share2,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { IntegrationWarningBanner } from "@/components/IntegrationWarningBanner";

// ── Types ─────────────────────────────────────────────────────────────────────

type Profile = {
  full_name: string;
  email: string;
};

// ── Sub-components ────────────────────────────────────────────────────────────

function GroupLabel({ label }: { label: string }) {
  return (
    <p
      className="mb-1.5 text-[11px] font-semibold uppercase"
      style={{ color: "#6B7280", letterSpacing: "0.08em", marginLeft: 16 }}
    >
      {label}
    </p>
  );
}

type RowProps = {
  icon: React.ElementType;
  label: string;
  subtitle?: string;
  connected?: boolean;
  href?: string;
  onPress?: () => void;
  destructive?: boolean;
  soon?: boolean;
  isLast?: boolean;
};

function SettingsRow({ icon: Icon, label, subtitle, connected, href, onPress, destructive = false, soon = false, isLast = false }: RowProps) {
  const iconColor = destructive ? "#EF4444" : "#9CA3AF";
  const labelColor = destructive ? "#EF4444" : "#ffffff";
  const labelWeight = destructive ? 500 : 400;

  const inner = (
    <div
      className="flex items-center active:bg-white/[0.03]"
      style={{
        padding: "14px 16px",
        borderBottom: isLast ? "none" : "0.5px solid rgba(255,255,255,0.06)",
      }}
    >
      <Icon size={20} style={{ color: iconColor, flexShrink: 0 }} />
      <div className="ml-3 flex-1 min-w-0">
        <span
          className="block text-[16px]"
          style={{ color: labelColor, fontWeight: labelWeight }}
        >
          {label}
        </span>
        {subtitle ? (
          <span className="block text-[12px] mt-0.5 truncate" style={{ color: "#6B7280" }}>
            {subtitle}
          </span>
        ) : null}
      </div>
      {connected !== undefined && (
        <div
          className="mr-2 h-2 w-2 rounded-full flex-shrink-0"
          style={{ background: connected ? "#10B981" : "#48484a" }}
        />
      )}
      {soon ? (
        <span
          className="text-[9px] font-semibold uppercase"
          style={{
            color: "#6B7280",
            background: "rgba(107,114,128,0.15)",
            padding: "2px 6px",
            borderRadius: 4,
          }}
        >
          Soon
        </span>
      ) : !destructive ? (
        <ChevronRight size={16} style={{ color: "#6B7280", flexShrink: 0 }} />
      ) : null}
    </div>
  );

  if (soon) return <div>{inner}</div>;
  if (href) return <Link href={href} className="block">{inner}</Link>;
  return (
    <button type="button" onClick={onPress} className="block w-full text-left">
      {inner}
    </button>
  );
}

function SettingsGroup({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "rgba(20,20,22,0.6)",
        borderRadius: 14,
        border: "0.5px solid rgba(255,255,255,0.06)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile>({ full_name: "", email: "" });
  const [gmailStatus, setGmailStatus] = useState<{ connected: boolean; email?: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("agent_profiles")
        .select("full_name, email")
        .eq("id", user.id)
        .maybeSingle();
      setProfile({
        full_name: String(data?.full_name ?? user.user_metadata?.full_name ?? ""),
        email: String(data?.email ?? user.email ?? ""),
      });
    })();
  }, [supabase]);

  // Check Gmail connection status
  useEffect(() => {
    void fetch("/api/gmail/status")
      .then((r) => r.json())
      .then((d) => setGmailStatus(d))
      .catch(() => setGmailStatus({ connected: false }));
  }, []);

  // Handle ?gmail=connected|error callback param
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const gmail = params.get("gmail");
    if (gmail === "connected") {
      setToast("Gmail connected!");
      // Refresh status
      void fetch("/api/gmail/status")
        .then((r) => r.json())
        .then((d) => setGmailStatus(d));
      window.history.replaceState({}, "", "/settings");
    } else if (gmail === "error") {
      setToast("Connection failed — try again");
      window.history.replaceState({}, "", "/settings");
    }
  }, []);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  async function handleGmailDisconnect() {
    await fetch("/api/gmail/disconnect", { method: "POST" });
    setGmailStatus({ connected: false });
    setToast("Gmail disconnected");
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const initial = profile.full_name
    ? profile.full_name.trim()[0].toUpperCase()
    : "?";

  return (
    <div
      className="min-h-[100dvh] pb-32"
      style={{ color: "var(--oc-text-1)" }}
    >
      {/* Toast */}
      {toast && (
        <div
          className="fixed left-1/2 z-50 -translate-x-1/2 rounded-full px-5 py-2.5 text-[13px] font-semibold text-white transition-all"
          style={{
            top: "calc(env(safe-area-inset-top) + 12px)",
            background: "rgba(20,20,22,0.95)",
            border: "0.5px solid rgba(255,255,255,0.12)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          }}
        >
          {toast}
        </div>
      )}

      <div className="px-4 pt-6">

        <IntegrationWarningBanner />

        {/* ── Profile card ── */}
        <Link href="/settings/profile">
          <div
            className="mb-7 flex items-center gap-4 active:opacity-80"
            style={{
              background: "rgba(20,20,22,0.6)",
              borderRadius: 14,
              border: "0.5px solid rgba(255,255,255,0.06)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              padding: 16,
            }}
          >
            {/* Avatar */}
            <div
              className="flex shrink-0 items-center justify-center rounded-full text-[22px] font-bold text-white"
              style={{
                width: 64,
                height: 64,
                background: "linear-gradient(135deg, #3B82F6, #06B6D4)",
              }}
            >
              {initial}
            </div>

            {/* Name + subtitle */}
            <div className="min-w-0 flex-1">
              <p className="text-[18px] font-bold leading-tight" style={{ color: "#ffffff" }}>
                {profile.full_name || "Your Profile"}
              </p>
              <p className="mt-0.5 text-[13px]" style={{ color: "#6B7280" }}>
                {profile.email || "Tap to set up your profile"}
              </p>
            </div>

            <ChevronRight size={18} style={{ color: "#6B7280", flexShrink: 0 }} />
          </div>
        </Link>

        {/* ── Group 1: Aria ── */}
        <GroupLabel label="Aria" />
        <SettingsGroup>
          <SettingsRow icon={Mic} label="Mirror My Voice" href="/settings/voice" />
          <SettingsRow icon={Sparkles} label="Ask Aria" href="/voice" isLast />
        </SettingsGroup>

        <div style={{ marginTop: 24 }} />

        <div style={{ marginTop: 24 }} />

        {/* ── Group 2: Integrations ── */}
        <GroupLabel label="Integrations" />
        <SettingsGroup>
          {gmailStatus?.connected ? (
            <>
              <SettingsRow
                icon={Mail}
                label="Gmail"
                subtitle={gmailStatus.email}
                connected={true}
                onPress={() => {/* already connected — no-op tap */}}
              />
              <SettingsRow
                icon={Mail}
                label="Disconnect Gmail"
                onPress={handleGmailDisconnect}
                destructive
                isLast
              />
            </>
          ) : (
            <SettingsRow
              icon={Mail}
              label="Connect Gmail"
              connected={false}
              onPress={() => { window.location.href = "/api/auth/google/connect"; }}
              isLast
            />
          )}
        </SettingsGroup>

        <div style={{ marginTop: 24 }} />

        {/* ── Group 3: Workflow ── */}
        <GroupLabel label="Workflow" />
        <SettingsGroup>
          <SettingsRow icon={BarChart3} label="Pipeline" href="/pipeline" />
          <SettingsRow icon={Inbox} label="Inbox" href="/inbox" />
          <SettingsRow icon={CalendarDays} label="Showings" href="/showings" />
          <SettingsRow icon={FileText} label="Transactions" href="/transactions" isLast />
        </SettingsGroup>

        <div style={{ marginTop: 24 }} />

        {/* ── Group 4: Business ── */}
        <GroupLabel label="Business" />
        <SettingsGroup>
          <SettingsRow icon={Share2} label="Referrals" href="/referrals" />
          <SettingsRow icon={TrendingUp} label="Market Pulse" href="/market-pulse" />
          <SettingsRow icon={Globe} label="Client Portal" soon isLast />
        </SettingsGroup>

        <div style={{ marginTop: 24 }} />

        {/* ── Group 5: Account ── */}
        <GroupLabel label="Account" />
        <SettingsGroup>
          <SettingsRow icon={Bell} label="Notifications" soon />
          <SettingsRow icon={Lock} label="Privacy" soon />
          <SettingsRow
            icon={LogOut}
            label="Sign out"
            onPress={handleSignOut}
            destructive
            isLast
          />
        </SettingsGroup>

        {/* ── Footer ── */}
        <p
          className="mt-6 text-center text-[11px]"
          style={{ color: "#4B5563" }}
        >
          Aria v1.0.0 — Made for NJ agents
        </p>

      </div>
    </div>
  );
}

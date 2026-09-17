"use client";

import { createClient } from "@/lib/supabase/client";
import {
  ChevronRight,
  Download,
  Globe,
  LogOut,
  Mail,
  Mic,
  ShieldCheck,
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

type ProfileSettings = {
  fullName: string;
  phone: string;
  brokerageName: string;
};

type DraftTone = "warm" | "professional" | "direct" | "casual";

const TONE_OPTIONS: { value: DraftTone; label: string }[] = [
  { value: "warm", label: "Warm & friendly" },
  { value: "professional", label: "Professional" },
  { value: "direct", label: "Direct & efficient" },
  { value: "casual", label: "Casual" },
];

const REMINDER_HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 6am – 9pm ET

function formatHour(hour: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:00 ${period}`;
}

function triggerHaptic() {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(10);
  } catch {
    /* never break */
  }
}

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

// iOS-style toggle switch — solid deep-green track when on, visible mid-gray
// track when off, and a solid white knob (with its own shadow) so it reads
// clearly against the dark glass card regardless of state.
function Toggle({ on, onChange, disabled = false }: { on: boolean; onChange: (next: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        triggerHaptic();
        onChange(!on);
      }}
      className="relative shrink-0 rounded-full transition-colors"
      style={{
        width: 46,
        height: 27,
        background: on ? "#1F5C46" : "#3A3A3C",
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "default" : "pointer",
      }}
    >
      <span
        className="absolute rounded-full transition-transform"
        style={{
          top: 2,
          left: 2,
          width: 23,
          height: 23,
          background: "#FFFFFF",
          boxShadow: "0 2px 4px rgba(0,0,0,0.35), 0 0 0 0.5px rgba(0,0,0,0.05)",
          transform: on ? "translateX(19px)" : "translateX(0px)",
          transition: "transform 180ms cubic-bezier(0.25,0.46,0.45,0.94)",
        }}
      />
    </button>
  );
}

function ToggleRow({
  label,
  subtitle,
  on,
  onChange,
  disabled = false,
  isLast = false,
}: {
  label: string;
  subtitle?: string;
  on: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  isLast?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between gap-3"
      style={{
        padding: "14px 16px",
        borderBottom: isLast ? "none" : "0.5px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="min-w-0 flex-1">
        <span className="block text-[16px]" style={{ color: "#ffffff" }}>{label}</span>
        {subtitle ? (
          <span className="block text-[12px] mt-0.5" style={{ color: "#6B7280" }}>{subtitle}</span>
        ) : null}
      </div>
      <Toggle on={on} onChange={onChange} disabled={disabled} />
    </div>
  );
}

// Inline-editable text row — shows label + value, saves onBlur (or Enter).
function EditRow({
  label,
  value,
  placeholder,
  onSave,
  isLast = false,
  inputMode,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onSave: (next: string) => void;
  isLast?: boolean;
  inputMode?: "text" | "tel";
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  return (
    <div
      className="flex items-center justify-between gap-3"
      style={{
        padding: "12px 16px",
        borderBottom: isLast ? "none" : "0.5px solid rgba(255,255,255,0.06)",
      }}
    >
      <span className="text-[16px] shrink-0" style={{ color: "#ffffff" }}>{label}</span>
      <input
        type={inputMode === "tel" ? "tel" : "text"}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft.trim() !== value.trim()) onSave(draft.trim());
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="flex-1 min-w-0 bg-transparent text-right text-[15px] outline-none"
        style={{ color: "#E5E7EB" }}
      />
    </div>
  );
}

function SelectRow({
  label,
  value,
  options,
  onChange,
  isLast = false,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (next: string) => void;
  isLast?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between gap-3"
      style={{
        padding: "12px 16px",
        borderBottom: isLast ? "none" : "0.5px solid rgba(255,255,255,0.06)",
      }}
    >
      <span className="text-[16px] shrink-0" style={{ color: "#ffffff" }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-right text-[15px] outline-none"
        style={{ color: "#E5E7EB", WebkitAppearance: "none", MozAppearance: "none" }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} style={{ background: "#1a1a1c", color: "#fff" }}>
            {opt.label}
          </option>
        ))}
      </select>
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

  const [profileSettings, setProfileSettings] = useState<ProfileSettings>({
    fullName: "",
    phone: "",
    brokerageName: "",
  });

  const [notifyFollowups, setNotifyFollowups] = useState(true);
  const [reminderHourEt, setReminderHourEt] = useState(8);

  const [draftTone, setDraftTone] = useState<DraftTone>("warm");
  const [signature, setSignature] = useState("");

  const [exporting, setExporting] = useState(false);
  const [complianceComplete, setComplianceComplete] = useState<boolean | null>(null);

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

  // Load Profile / Notifications / Message drafts settings
  useEffect(() => {
    void fetch("/api/settings/profile")
      .then((r) => r.json())
      .then((d) => setProfileSettings({
        fullName: d.fullName ?? "",
        phone: d.phone ?? "",
        brokerageName: d.brokerageName ?? "",
      }))
      .catch(() => {});

    void fetch("/api/settings/notifications")
      .then((r) => r.json())
      .then((d) => {
        setNotifyFollowups(d.notifyFollowups ?? true);
        setReminderHourEt(d.reminderHourEt ?? 8);
      })
      .catch(() => {});

    void fetch("/api/settings/drafts")
      .then((r) => r.json())
      .then((d) => {
        setDraftTone((d.draftTone as DraftTone) ?? "warm");
        setSignature(d.signature ?? "");
      })
      .catch(() => {});

    void fetch("/api/compliance")
      .then((r) => r.json())
      .then((d) => setComplianceComplete(Boolean(d.isComplete)))
      .catch(() => {});
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

  async function saveProfileField(field: "fullName" | "phone" | "brokerageName", value: string) {
    setProfileSettings((p) => ({ ...p, [field]: value }));
    const res = await fetch("/api/settings/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setToast(data.error ?? "Couldn't save — try again");
      return;
    }
    setToast("Saved");
    if (field === "fullName") {
      setProfile((p) => ({ ...p, full_name: value }));
    }
  }

  async function saveNotifications(next: Partial<{ notifyFollowups: boolean; reminderHourEt: number }>) {
    if (next.notifyFollowups !== undefined) setNotifyFollowups(next.notifyFollowups);
    if (next.reminderHourEt !== undefined) setReminderHourEt(next.reminderHourEt);
    const res = await fetch("/api/settings/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    if (!res.ok) setToast("Couldn't save — try again");
  }

  async function saveDrafts(next: Partial<{ draftTone: DraftTone; signature: string }>) {
    if (next.draftTone !== undefined) setDraftTone(next.draftTone);
    if (next.signature !== undefined) setSignature(next.signature);
    const res = await fetch("/api/settings/drafts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    if (!res.ok) setToast("Couldn't save — try again");
  }

  async function handleExportClients() {
    setExporting(true);
    try {
      const res = await fetch("/api/clients/export");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aria-clients-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setToast("Clients exported");
    } catch {
      setToast("Couldn't export — try again");
    } finally {
      setExporting(false);
    }
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
        <div
          className="mb-7 flex items-center gap-4"
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
            <p className="mt-0.5 text-[13px] truncate" style={{ color: "#6B7280" }}>
              {profile.email || "Set up your profile below"}
            </p>
          </div>
        </div>

        {/* ── Group: Profile ── */}
        <GroupLabel label="Profile" />
        <SettingsGroup>
          <EditRow
            label="Name"
            value={profileSettings.fullName}
            placeholder="Your name"
            onSave={(v) => v && void saveProfileField("fullName", v)}
          />
          <EditRow
            label="Brokerage"
            value={profileSettings.brokerageName}
            placeholder="Your brokerage"
            onSave={(v) => v && void saveProfileField("brokerageName", v)}
          />
          <EditRow
            label="Phone"
            value={profileSettings.phone}
            placeholder="(555) 555-5555"
            inputMode="tel"
            onSave={(v) => void saveProfileField("phone", v)}
            isLast
          />
        </SettingsGroup>

        <div style={{ marginTop: 24 }} />

        {/* ── Group: Aria ── */}
        <GroupLabel label="Aria" />
        <SettingsGroup>
          <SettingsRow icon={Mic} label="Mirror My Voice" href="/settings/voice" />
          <SettingsRow icon={Sparkles} label="Ask Aria" href="/voice" isLast />
        </SettingsGroup>

        <div style={{ marginTop: 24 }} />

        {/* ── Group: Notifications ── */}
        <GroupLabel label="Notifications" />
        <SettingsGroup>
          <ToggleRow
            label="Follow-up reminders"
            subtitle="Daily nudge for clients who need contact"
            on={notifyFollowups}
            onChange={(v) => void saveNotifications({ notifyFollowups: v })}
          />
          <SelectRow
            label="Daily reminder time"
            value={String(reminderHourEt)}
            options={REMINDER_HOURS.map((h) => ({ value: String(h), label: formatHour(h) }))}
            onChange={(v) => void saveNotifications({ reminderHourEt: Number(v) })}
            isLast
          />
        </SettingsGroup>

        <div style={{ marginTop: 24 }} />

        {/* ── Group: Message drafts ── */}
        <GroupLabel label="Message drafts" />
        <SettingsGroup>
          <SelectRow
            label="Tone"
            value={draftTone}
            options={TONE_OPTIONS}
            onChange={(v) => void saveDrafts({ draftTone: v as DraftTone })}
          />
          <EditRow
            label="Signature"
            value={signature}
            placeholder="e.g. – Sarah, ABC Realty"
            onSave={(v) => void saveDrafts({ signature: v })}
            isLast
          />
        </SettingsGroup>

        <div style={{ marginTop: 24 }} />

        {/* ── Group: Connected accounts ── */}
        <GroupLabel label="Connected accounts" />
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
              />
            </>
          ) : (
            <SettingsRow
              icon={Mail}
              label="Connect Gmail"
              connected={false}
              onPress={() => { window.location.href = "/api/auth/google/connect"; }}
            />
          )}
          <SettingsRow
            icon={LogOut}
            label="Sign out"
            onPress={handleSignOut}
            destructive
            isLast
          />
        </SettingsGroup>

        <div style={{ marginTop: 24 }} />

        {/* ── Group: Business ── */}
        <GroupLabel label="Business" />
        <SettingsGroup>
          <SettingsRow
            icon={ShieldCheck}
            label="Compliance profile"
            subtitle={complianceComplete === false ? "Needs your license & brokerage details" : undefined}
            href="/settings/compliance"
          />
          <SettingsRow icon={Share2} label="Referrals" href="/referrals" />
          <SettingsRow icon={TrendingUp} label="Market Pulse" href="/market-pulse" />
          <SettingsRow icon={Globe} label="Client Portal" soon isLast />
        </SettingsGroup>

        <div style={{ marginTop: 24 }} />

        {/* ── Group: Data ── */}
        <GroupLabel label="Data" />
        <SettingsGroup>
          <SettingsRow
            icon={Download}
            label={exporting ? "Exporting…" : "Export clients"}
            subtitle="Download all clients as a CSV file"
            onPress={exporting ? undefined : handleExportClients}
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

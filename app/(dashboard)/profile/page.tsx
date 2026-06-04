"use client";

// Profile / More page — iOS Settings visual hierarchy.
//
// This is the 5th nav tab (Profile). It provides access to:
// account info, integrations, product settings, and destructive actions.
//
// Rows that are not yet fully functional are shown with an "unavailable"
// indicator rather than pretending they work.

import { createClient } from "@/lib/supabase/client";
import {
  Bell,
  ChevronRight,
  CreditCard,
  HelpCircle,
  LogOut,
  Mail,
  MessageSquare,
  Mic,
  Settings,
  User,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Profile = { full_name: string | null; email: string | null };

// ── Row components ─────────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return (
    <p
      className="px-5 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-wider"
      style={{ color: "#5A5A6E" }}
    >
      {label}
    </p>
  );
}

function RowGroup({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mx-4 overflow-hidden rounded-[18px]"
      style={{ background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.07)" }}
    >
      {children}
    </div>
  );
}

type RowProps = {
  icon: React.ElementType;
  label: string;
  sublabel?: string;
  value?: string;
  href?: string;
  onPress?: () => void;
  destructive?: boolean;
  unavailable?: boolean;
  isLast?: boolean;
};

function Row({
  icon: Icon,
  label,
  sublabel,
  value,
  href,
  onPress,
  destructive = false,
  unavailable = false,
  isLast = false,
}: RowProps) {
  const labelColor = destructive ? "#FF453A" : unavailable ? "#5A5A6E" : "#E8E6E4";

  const inner = (
    <div
      className="flex items-center gap-3.5 px-4 active:bg-white/[0.05]"
      style={{
        paddingTop: 13,
        paddingBottom: 13,
        minHeight: 52,
        borderBottom: isLast ? "none" : "0.5px solid rgba(255,255,255,0.06)",
      }}
      onClick={onPress}
    >
      {/* Icon */}
      <div
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[8px]"
        style={{
          background: destructive
            ? "rgba(255,69,58,0.15)"
            : unavailable
            ? "rgba(255,255,255,0.04)"
            : "rgba(59,130,246,0.14)",
        }}
      >
        <Icon
          size={16}
          strokeWidth={1.8}
          color={destructive ? "#FF453A" : unavailable ? "#5A5A6E" : "#60A5FA"}
        />
      </div>

      {/* Label */}
      <div className="flex-1 min-w-0">
        <p className="text-[15px]" style={{ color: labelColor }}>
          {label}
        </p>
        {sublabel && (
          <p className="text-[12px] mt-0.5" style={{ color: "#5A5A6E" }}>
            {sublabel}
          </p>
        )}
      </div>

      {/* Right */}
      {unavailable ? (
        <span className="text-[11px] font-medium" style={{ color: "#5A5A6E" }}>
          Soon
        </span>
      ) : value ? (
        <span className="text-[13px] max-w-[120px] truncate text-right" style={{ color: "#5A5A6E" }}>
          {value}
        </span>
      ) : !destructive ? (
        <ChevronRight size={16} color="#3A3A4E" strokeWidth={2} />
      ) : null}
    </div>
  );

  if (href && !unavailable) {
    return <Link href={href}>{inner}</Link>;
  }
  return <div role={onPress ? "button" : undefined}>{inner}</div>;
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const supabase = createClient();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setProfile({ full_name: user.user_metadata?.full_name ?? null, email: user.email ?? null });

      const { data: gmail } = await supabase
        .from("gmail_integrations")
        .select("email")
        .eq("agent_id", user.id)
        .maybeSingle();
      setGmailEmail(gmail?.email ?? null);
    })();
  }, [supabase]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div
      className="min-h-[100dvh] pb-32"
      style={{ color: "var(--oc-text-1)" }}
    >
      {/* ── Large title ── */}
      <div className="px-5 pb-2 pt-8">
        <h1
          className="text-[28px] font-bold"
          style={{ letterSpacing: "-0.03em", color: "#E8E6E4" }}
        >
          Profile
        </h1>
      </div>

      {/* ── Account ── */}
      {profile && (
        <>
          <SectionLabel label="Account" />
          <RowGroup>
            <Row
              icon={User}
              label={profile.full_name ?? "Agent"}
              sublabel={profile.email ?? ""}
              isLast
            />
          </RowGroup>
        </>
      )}

      {/* ── Integrations ── */}
      <SectionLabel label="Integrations" />
      <RowGroup>
        <Row
          icon={Mail}
          label="Gmail"
          sublabel={gmailEmail ? `Connected as ${gmailEmail}` : "Not connected"}
          href="/settings"
        />
        <Row
          icon={MessageSquare}
          label="SMS / Twilio"
          sublabel="Manage phone number"
          href="/settings"
          isLast
        />
      </RowGroup>

      {/* ── Product ── */}
      <SectionLabel label="Product" />
      <RowGroup>
        <Row
          icon={Mic}
          label="Voice"
          sublabel="Aria voice assistant"
          href="/voice"
        />
        <Row
          icon={Bell}
          label="Notifications"
          unavailable
        />
        <Row
          icon={Settings}
          label="Settings"
          href="/settings"
          isLast
        />
      </RowGroup>

      {/* ── Billing & Support ── */}
      <SectionLabel label="Billing & Support" />
      <RowGroup>
        <Row
          icon={CreditCard}
          label="Billing"
          unavailable
        />
        <Row
          icon={HelpCircle}
          label="Support"
          unavailable
          isLast
        />
      </RowGroup>

      {/* ── Danger ── */}
      <SectionLabel label="" />
      <RowGroup>
        <Row
          icon={LogOut}
          label="Log out"
          destructive
          onPress={() => void handleLogout()}
          isLast
        />
      </RowGroup>

      <p
        className="mt-8 pb-4 text-center text-[11px]"
        style={{ color: "#3A3A4E" }}
      >
        Aria · Real Estate Intelligence
      </p>
    </div>
  );
}

"use client";

import { BbaTemplatesSection } from "@/components/BbaTemplatesSection";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useToast } from "@/components/ToastProvider";
import { useRouter } from "next/navigation";
import {
  Mic2,
  FileText,
  Shield,
  ChevronRight,
  LogOut,
} from "lucide-react";

type Section = "profile" | "voice" | "bba" | null;

function SectionHeader({ label }: { label: string }) {
  return (
    <p
      className="mb-2 ml-1 text-[11px] font-semibold uppercase tracking-[0.08em]"
      style={{ color: "#333a58" }}
    >
      {label}
    </p>
  );
}

function SettingsRow({
  icon: Icon,
  label,
  sub,
  onPress,
  href,
  destructive,
}: {
  icon: React.ElementType;
  label: string;
  sub?: string;
  onPress?: () => void;
  href?: string;
  destructive?: boolean;
}) {
  const inner = (
    <div className="ios-row press w-full">
      <span
        className="mr-3 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[9px]"
        style={{ background: destructive ? "rgba(192,58,58,0.1)" : "rgba(76,122,255,0.1)" }}
      >
        <Icon size={15} style={{ color: destructive ? "#d96060" : "#4c7aff" }} />
      </span>
      <div className="flex-1 text-left">
        <p
          className="text-[15px] font-medium"
          style={{ color: destructive ? "#d96060" : "#dde0f8" }}
        >
          {label}
        </p>
        {sub && (
          <p className="mt-[1px] text-[11px]" style={{ color: "#40486a" }}>
            {sub}
          </p>
        )}
      </div>
      {!destructive && <ChevronRight size={15} style={{ color: "#2a3050" }} />}
    </div>
  );

  if (href) return <Link href={href} className="block">{inner}</Link>;
  return <button type="button" onClick={onPress} className="block w-full">{inner}</button>;
}

// ── Sub-pages rendered inline ─────────────────────────────────────────────────

function ProfileForm({
  profile,
  setProfile,
  onSave,
}: {
  profile: { full_name: string; phone: string; email: string; license_state: string };
  setProfile: (p: typeof profile) => void;
  onSave: () => void;
}) {
  const inputStyle = "w-full rounded-[13px] px-4 py-3 text-base outline-none";
  const inputBg = { background: "#060912", border: "0.5px solid #181d2e", color: "#e4e8ff" };

  return (
    <div className="space-y-2.5">
      <select
        value={profile.license_state}
        onChange={(e) => setProfile({ ...profile, license_state: e.target.value })}
        className={inputStyle}
        style={inputBg}
      >
        <option value="NJ">New Jersey (NJ)</option>
      </select>
      <input
        value={profile.full_name}
        onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
        placeholder="Full name"
        className={inputStyle}
        style={inputBg}
      />
      <input
        value={profile.phone}
        onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
        placeholder="Phone"
        inputMode="tel"
        className={inputStyle}
        style={inputBg}
      />
      <input
        value={profile.email}
        onChange={(e) => setProfile({ ...profile, email: e.target.value })}
        placeholder="Email"
        inputMode="email"
        className={inputStyle}
        style={inputBg}
      />
      <button
        type="button"
        onClick={onSave}
        className="w-full rounded-[13px] py-3.5 text-[14px] font-semibold text-white press"
        style={{ background: "#4c7aff" }}
      >
        Save profile
      </button>
    </div>
  );
}

function VoiceForm({
  samples,
  setSamples,
  analysis,
  onSave,
  previewQ,
  setPreviewQ,
  previewOut,
  onPreview,
}: {
  samples: string[];
  setSamples: (s: string[]) => void;
  analysis: string | null;
  onSave: () => void;
  previewQ: string;
  setPreviewQ: (q: string) => void;
  previewOut: string | null;
  onPreview: () => void;
}) {
  const taStyle = "w-full rounded-[13px] px-4 py-3 text-base outline-none resize-none";
  const inputBg = { background: "#060912", border: "0.5px solid #181d2e", color: "#e4e8ff" };

  return (
    <div>
      <p className="mb-4 text-[13px] leading-relaxed" style={{ color: "#50587a" }}>
        Paste 5 real texts you&apos;ve sent to clients. Aria will match your tone exactly.
      </p>
      <div className="space-y-2.5">
        {samples.map((s, i) => (
          <div key={i}>
            <p className="mb-1.5 text-[11px]" style={{ color: "#333a58" }}>Sample {i + 1}</p>
            <textarea
              value={s}
              onChange={(e) => {
                const next = [...samples];
                next[i] = e.target.value;
                setSamples(next);
              }}
              rows={2}
              className={taStyle}
              style={inputBg}
            />
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onSave}
        className="mt-4 w-full rounded-[13px] py-3.5 text-[14px] font-semibold text-white press"
        style={{ background: "#4c7aff" }}
      >
        Save & Analyze
      </button>
      {analysis && (
        <div
          className="mt-3 rounded-[13px] p-4 text-[13px] leading-relaxed"
          style={{ background: "#080c18", border: "0.5px solid #181d2e", color: "#7b9fff" }}
        >
          {analysis}
        </div>
      )}
      <div className="mt-6" style={{ borderTop: "0.5px solid #181d2e", paddingTop: 20 }}>
        <p className="mb-2 text-[12px]" style={{ color: "#333a58" }}>Preview a draft</p>
        <input
          value={previewQ}
          onChange={(e) => setPreviewQ(e.target.value)}
          className="w-full rounded-[13px] px-4 py-3 text-base outline-none"
          style={{ background: "#060912", border: "0.5px solid #181d2e", color: "#e4e8ff" }}
        />
        <button
          type="button"
          onClick={onPreview}
          className="mt-2.5 rounded-full px-4 py-2 text-[13px] font-medium press"
          style={{ background: "#080c18", color: "#7b9fff", border: "0.5px solid rgba(76,122,255,0.2)" }}
        >
          Generate preview
        </button>
        {previewOut && (
          <div
            className="mt-3 rounded-[13px] p-4 text-[13px] leading-relaxed"
            style={{ background: "#080c18", border: "0.5px solid #181d2e", color: "#9098c0" }}
          >
            {previewOut}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const supabase = createClient();
  const router = useRouter();
  const toast = useToast();
  const [section, setSection] = useState<Section>(null);
  const [samples, setSamples] = useState(["", "", "", "", ""]);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [previewQ, setPreviewQ] = useState("Follow up after a showing");
  const [previewOut, setPreviewOut] = useState<string | null>(null);
  const [profile, setProfile] = useState({
    full_name: "",
    phone: "",
    email: "",
    license_state: "NJ",
  });

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("agent_profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        const vs = (data.voice_samples as string[] | null) ?? [];
        setSamples([0, 1, 2, 3, 4].map((i) => vs[i] ?? ""));
        setAnalysis(data.tone_analysis as string | null);
        setProfile({
          full_name: String(data.full_name ?? ""),
          phone: String(data.phone ?? ""),
          email: String(data.email ?? ""),
          license_state: String((data as Record<string, unknown>).license_state ?? "NJ"),
        });
      }
    })();
  }, [supabase]);

  async function saveVoice() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("agent_profiles").update({ voice_samples: samples }).eq("id", user.id);
    const res = await fetch("/api/ai/analyze-tone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voiceSamples: samples }),
    });
    const data = await res.json();
    setAnalysis(String(data.analysis ?? ""));
    await supabase.from("agent_profiles").update({ tone_analysis: data.analysis }).eq("id", user.id);
    toast.toast("Saved & analyzed", "success");
  }

  async function preview() {
    const res = await fetch("/api/ai/draft-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientName: "Jordan",
        context: previewQ,
        scenario: previewQ,
        voiceSamples: samples,
        skipInsert: true,
      }),
    });
    const data = await res.json();
    setPreviewOut(String(data.draft ?? ""));
  }

  async function saveProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("agent_profiles").update({
      full_name: profile.full_name,
      phone: profile.phone,
      email: profile.email,
      license_state: profile.license_state,
    }).eq("id", user.id);
    toast.toast("Profile saved", "success");
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  // ── Sub-page view ─────────────────────────────────────────────────────────
  if (section) {
    return (
      <div className="min-h-screen w-full px-5 pb-40 pt-6" style={{ background: "#050816", color: "#e4e8ff" }}>
        <button
          type="button"
          onClick={() => setSection(null)}
          className="mb-5 flex items-center gap-1 text-[14px] press"
          style={{ color: "#4c7aff" }}
        >
          ‹ Back
        </button>

        {section === "profile" && (
          <>
            <h2 className="mb-6 text-[22px] font-semibold tracking-[-0.02em]">Agent Profile</h2>
            <ProfileForm profile={profile} setProfile={setProfile} onSave={saveProfile} />
          </>
        )}

        {section === "voice" && (
          <>
            <h2 className="mb-2 text-[22px] font-semibold tracking-[-0.02em]">Mirror My Voice</h2>
            <VoiceForm
              samples={samples}
              setSamples={setSamples}
              analysis={analysis}
              onSave={saveVoice}
              previewQ={previewQ}
              setPreviewQ={setPreviewQ}
              previewOut={previewOut}
              onPreview={preview}
            />
          </>
        )}

        {section === "bba" && (
          <>
            <h2 className="mb-2 text-[22px] font-semibold tracking-[-0.02em]">BBA Templates</h2>
            <p className="mb-5 text-[13px]" style={{ color: "#50587a" }}>
              Upload your brokerage Buyer Broker Agreement for client signing links.
            </p>
            <BbaTemplatesSection />
          </>
        )}
      </div>
    );
  }

  // ── Main settings menu ────────────────────────────────────────────────────
  const initials = profile.full_name
    ? profile.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "A";

  return (
    <div className="min-h-screen w-full px-5 pb-40 pt-6" style={{ background: "#050816", color: "#e4e8ff" }}>
      <h1 className="mb-6 text-[26px] font-semibold tracking-[-0.025em]">Settings</h1>

      {/* ── Profile header ── */}
      <button
        type="button"
        onClick={() => setSection("profile")}
        className="mb-6 flex w-full items-center gap-4 press"
      >
        <div
          className="flex h-[56px] w-[56px] flex-shrink-0 items-center justify-center rounded-full text-[18px] font-bold"
          style={{ background: "rgba(76,122,255,0.15)", color: "#7b9fff" }}
        >
          {initials}
        </div>
        <div className="flex-1 text-left">
          <p className="text-[17px] font-semibold">
            {profile.full_name || "Your Profile"}
          </p>
          <p className="text-[13px]" style={{ color: "#40486a" }}>
            {profile.email || "Tap to set up your profile"}
          </p>
        </div>
        <ChevronRight size={16} style={{ color: "#2a3050" }} />
      </button>

      {/* ── Aria AI ── */}
      <SectionHeader label="Aria AI" />
      <div className="ios-group mb-6">
        <SettingsRow
          icon={Mic2}
          label="Mirror My Voice"
          sub="Train Aria to match your tone"
          onPress={() => setSection("voice")}
        />
      </div>

      {/* ── Documents ── */}
      <SectionHeader label="Documents" />
      <div className="ios-group mb-6">
        <SettingsRow
          icon={FileText}
          label="BBA Templates"
          sub="Buyer Broker Agreement upload"
          onPress={() => setSection("bba")}
        />
      </div>

      {/* ── Legal ── */}
      <SectionHeader label="Legal" />
      <div className="ios-group mb-6">
        <SettingsRow icon={Shield} label="Privacy Policy" href="/privacy" />
        <SettingsRow icon={Shield} label="Terms of Service" href="/terms" />
        <SettingsRow icon={Shield} label="Fair Housing" href="/fair-housing" />
      </div>

      {/* ── Account ── */}
      <SectionHeader label="Account" />
      <div className="ios-group mb-6">
        <SettingsRow
          icon={LogOut}
          label="Sign out"
          onPress={signOut}
          destructive
        />
      </div>

      <p className="text-center text-[11px]" style={{ color: "#262c48" }}>
        Aria · Real Estate AI
      </p>
    </div>
  );
}

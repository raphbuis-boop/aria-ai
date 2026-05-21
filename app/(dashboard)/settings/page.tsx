"use client";

import { BbaTemplatesSection } from "@/components/BbaTemplatesSection";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useToast } from "@/components/ToastProvider";

export default function SettingsPage() {
  const supabase = createClient();
  const toast = useToast();
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
      const {
        data: { user },
      } = await supabase.auth.getUser();
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
          license_state: String(
            (data as Record<string, unknown>).license_state ?? "NJ",
          ),
        });
      }
    })();
  }, [supabase]);

  async function saveVoice() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("agent_profiles")
      .update({ voice_samples: samples })
      .eq("id", user.id);
    const res = await fetch("/api/ai/analyze-tone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voiceSamples: samples }),
    });
    const data = await res.json();
    setAnalysis(String(data.analysis ?? ""));
    await supabase
      .from("agent_profiles")
      .update({ tone_analysis: data.analysis })
      .eq("id", user.id);
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("agent_profiles")
      .update({
        full_name: profile.full_name,
        phone: profile.phone,
        email: profile.email,
        license_state: profile.license_state,
      })
      .eq("id", user.id);
    toast.toast("Profile saved", "success");
  }

  return (
    <div className="min-h-screen w-full px-5 pb-40 pt-6" style={{ background: "#050816", color: "#e4e8ff" }}>
      <h1 className="mb-6 text-[26px] font-semibold tracking-[-0.025em]">Settings</h1>

      {/* Agent profile card */}
      <div className="mb-3 rounded-[16px] border border-border-subtle bg-bg-card p-4">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-text-dim">Agent Profile</p>
        <div className="space-y-2.5">
          <div>
            <p className="mb-1 text-[11px] text-text-muted">License state</p>
            <select
              value={profile.license_state}
              onChange={(e) => setProfile({ ...profile, license_state: e.target.value })}
              className="w-full rounded-[10px] border border-border-card bg-bg-deep px-3 py-2.5 text-base text-text-primary"
            >
              <option value="NJ">New Jersey (NJ)</option>
            </select>
          </div>
          <input
            value={profile.full_name}
            onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
            placeholder="Full name"
            className="w-full rounded-[10px] border border-border-card bg-bg-deep px-3 py-2.5 text-base text-text-primary placeholder:text-text-dim"
          />
          <input
            value={profile.phone}
            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
            placeholder="Phone"
            className="w-full rounded-[10px] border border-border-card bg-bg-deep px-3 py-2.5 text-base text-text-primary placeholder:text-text-dim"
          />
          <input
            value={profile.email}
            onChange={(e) => setProfile({ ...profile, email: e.target.value })}
            placeholder="Email"
            className="w-full rounded-[10px] border border-border-card bg-bg-deep px-3 py-2.5 text-base text-text-primary placeholder:text-text-dim"
          />
          <button
            type="button"
            onClick={saveProfile}
            className="w-full rounded-[10px] bg-accent-blue py-2.5 text-[13px] font-semibold text-white"
          >
            Save profile
          </button>
        </div>
      </div>

      {/* Mirror My Voice card */}
      <div className="mb-3 rounded-[16px] border border-border-subtle bg-bg-card p-4">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-text-dim">AI Voice</p>
        <p className="mb-3 text-[15px] font-semibold text-text-primary">Mirror My Voice</p>
        <p className="mb-4 text-[13px] leading-relaxed text-text-muted">
          Paste 5 real texts you&apos;ve sent to clients. Aria will match your tone exactly.
        </p>
        <div className="space-y-3">
          {samples.map((s, i) => (
            <div key={i}>
              <p className="mb-1 text-[11px] text-text-dim">Sample {i + 1}</p>
              <textarea
                value={s}
                onChange={(e) => {
                  const next = [...samples];
                  next[i] = e.target.value;
                  setSamples(next);
                }}
                rows={2}
                className="w-full rounded-[10px] border border-border-card bg-bg-deep p-3 text-base text-text-primary placeholder:text-text-dim"
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={saveVoice}
          className="mt-4 w-full rounded-[10px] bg-accent-blue py-2.5 text-[13px] font-semibold text-white"
        >
          Save & Analyze
        </button>
        {analysis ? (
          <div className="mt-3 rounded-[12px] border border-border-card bg-bg-deep p-3 text-[13px] leading-relaxed text-text-secondary">
            {analysis}
          </div>
        ) : null}

        <div className="mt-4 border-t border-border-subtle pt-4">
          <p className="mb-2 text-[11px] text-text-dim">Preview a draft</p>
          <input
            value={previewQ}
            onChange={(e) => setPreviewQ(e.target.value)}
            className="w-full rounded-[10px] border border-border-card bg-bg-deep px-3 py-2.5 text-base text-text-primary"
          />
          <button
            type="button"
            onClick={preview}
            className="mt-2 rounded-[10px] border border-border-card px-4 py-2 text-[13px] text-accent-blue"
          >
            Generate preview
          </button>
          {previewOut ? (
            <div className="mt-2 rounded-[12px] border border-border-card bg-bg-deep p-3 text-[13px] leading-relaxed text-text-secondary">
              {previewOut}
            </div>
          ) : null}
        </div>
      </div>

      {/* BBA templates card */}
      <div className="mb-3 rounded-[16px] border border-border-subtle bg-bg-card p-4">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-text-dim">Documents</p>
        <p className="mb-3 text-[15px] font-semibold text-text-primary">BBA Templates</p>
        <p className="mb-3 text-[13px] leading-relaxed text-text-muted">
          Upload your brokerage Buyer Broker Agreement for client signing links.
        </p>
        <BbaTemplatesSection />
      </div>

      {/* Legal links */}
      <div className="rounded-[16px] border border-border-subtle bg-bg-card p-4">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-text-dim">Legal</p>
        <div className="space-y-3">
          {[
            { href: "/privacy", label: "Privacy Policy" },
            { href: "/terms", label: "Terms of Service" },
            { href: "/fair-housing", label: "Fair Housing" },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="flex items-center justify-between text-[14px] text-text-secondary"
            >
              <span>{l.label}</span>
              <span className="text-text-dim">›</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

"use client";

import { createClient } from "@/lib/supabase/client";
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
      })
      .eq("id", user.id);
    toast.toast("Profile saved", "success");
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-28 pt-6">
      <div className="text-[20px] font-medium text-text-primary">
        Mirror My Voice
      </div>
      <p className="mt-2 text-[13px] text-text-dim">
        Paste 5 real texts you&apos;ve sent to clients. Aria will match your tone
        exactly.
      </p>
      <div className="mt-6 space-y-3">
        {samples.map((s, i) => (
          <div key={i}>
            <div className="text-[10px] font-medium uppercase tracking-[0.07em] text-text-dim">
              Sample {i + 1}
            </div>
            <textarea
              value={s}
              onChange={(e) => {
                const next = [...samples];
                next[i] = e.target.value;
                setSamples(next);
              }}
              className="mt-1 min-h-[72px] w-full rounded-[8px] border border-border-card bg-bg-deep p-3 text-[13px] text-text-primary"
            />
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={saveVoice}
        className="mt-4 w-full rounded-[8px] bg-accent-blue py-3 text-[13px] font-medium text-white"
      >
        Save & Analyze
      </button>
      {analysis ? (
        <div className="mt-4 rounded-[14px] border border-border-card bg-bg-card p-3 text-[13px] text-text-secondary">
          {analysis}
        </div>
      ) : null}

      <div className="mt-8">
        <div className="text-[10px] font-medium uppercase tracking-[0.07em] text-text-dim">
          Preview
        </div>
        <input
          value={previewQ}
          onChange={(e) => setPreviewQ(e.target.value)}
          className="mt-2 w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px]"
        />
        <button
          type="button"
          onClick={preview}
          className="mt-2 rounded-[8px] border border-border-card px-3 py-2 text-[13px] text-accent-blue"
        >
          Generate preview
        </button>
        {previewOut ? (
          <div className="mt-2 rounded-[12px] border border-border-card bg-bg-card p-3 text-[13px] text-text-secondary">
            {previewOut}
          </div>
        ) : null}
      </div>

      <div className="mt-8 space-y-2">
        <div className="text-[10px] font-medium uppercase tracking-[0.07em] text-text-dim">
          Agent profile
        </div>
        <input
          value={profile.full_name}
          onChange={(e) =>
            setProfile({ ...profile, full_name: e.target.value })
          }
          placeholder="Full name"
          className="w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px]"
        />
        <input
          value={profile.phone}
          onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
          placeholder="Phone"
          className="w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px]"
        />
        <input
          value={profile.email}
          onChange={(e) => setProfile({ ...profile, email: e.target.value })}
          placeholder="Email"
          className="w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px]"
        />
        <button
          type="button"
          onClick={saveProfile}
          className="w-full rounded-[8px] bg-accent-blue py-2 text-[13px] font-medium text-white"
        >
          Save profile
        </button>
      </div>
    </div>
  );
}

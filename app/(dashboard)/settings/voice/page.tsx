"use client";

import { BackButton } from "@/components/BackButton";
import { useToast } from "@/components/ToastProvider";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

export default function VoiceSettingsPage() {
  const supabase = createClient();
  const toast = useToast();
  const [samples, setSamples] = useState(["", "", "", "", ""]);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [previewQ, setPreviewQ] = useState("Follow up after a showing");
  const [previewOut, setPreviewOut] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("agent_profiles")
        .select("voice_samples, tone_analysis")
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        const vs = (data.voice_samples as string[] | null) ?? [];
        setSamples([0, 1, 2, 3, 4].map((i) => vs[i] ?? ""));
        setAnalysis(data.tone_analysis as string | null);
      }
    })();
  }, [supabase]);

  async function saveVoice() {
    const { data: { user } } = await supabase.auth.getUser();
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

  async function previewDraft() {
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

  const inputBg: React.CSSProperties = { background: "#1c1c1e", border: "none", color: "#f0f0f5" };
  const inputCls = "w-full rounded-[13px] px-4 py-3 text-base outline-none";

  return (
    <div
      className="min-h-screen pb-32 pt-6"
      style={{ background: "#0a0a0a", color: "#f0f0f5" }}
    >
      <div className="px-5">
        <BackButton className="mb-5" />
        <h1 className="mb-2 text-[22px] font-semibold tracking-[-0.02em]">
          Mirror My Voice
        </h1>
        <p className="mb-6 text-[13px] leading-relaxed" style={{ color: "#50587a" }}>
          Paste 5 real texts you&apos;ve sent to clients. Aria will match your tone exactly.
        </p>

        {/* ── Samples ── */}
        <div className="space-y-2.5">
          {samples.map((s, i) => (
            <div key={i}>
              <p className="mb-1.5 text-[11px]" style={{ color: "#636366" }}>
                Sample {i + 1}
              </p>
              <textarea
                value={s}
                onChange={(e) => {
                  const next = [...samples];
                  next[i] = e.target.value;
                  setSamples(next);
                }}
                rows={2}
                className={`${inputCls} resize-none`}
                style={inputBg}
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={saveVoice}
          className="mt-4 w-full rounded-[13px] py-3.5 text-[14px] font-semibold text-white"
          style={{ background: "#0a7cff" }}
        >
          Save & Analyze
        </button>

        {/* ── Tone analysis result ── */}
        {analysis && (
          <div
            className="mt-3 rounded-[13px] p-4 text-[13px] leading-relaxed"
            style={{ background: "#1c1c1e", color: "#8e8e93" }}
          >
            {analysis}
          </div>
        )}

        {/* ── Preview ── */}
        <div
          className="mt-6"
          style={{ borderTop: "0.5px solid rgba(255,255,255,0.06)", paddingTop: 20 }}
        >
          <p className="mb-2 text-[12px]" style={{ color: "#636366" }}>
            Preview a draft
          </p>
          <input
            value={previewQ}
            onChange={(e) => setPreviewQ(e.target.value)}
            className={inputCls}
            style={inputBg}
          />
          <button
            type="button"
            onClick={previewDraft}
            className="mt-2.5 rounded-full px-4 py-2 text-[13px] font-medium"
            style={{ background: "rgba(255,255,255,0.06)", color: "#8e8e93" }}
          >
            Generate preview
          </button>
          {previewOut && (
            <div
              className="mt-3 rounded-[13px] p-4 text-[13px] leading-relaxed"
              style={{ background: "#1c1c1e", color: "#8e8e93" }}
            >
              {previewOut}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

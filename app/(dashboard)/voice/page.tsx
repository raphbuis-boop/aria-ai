"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

type VoiceState = "idle" | "listening" | "thinking" | "speaking";

const STATE_LABEL: Record<VoiceState, string> = {
  idle: "Tap to speak",
  listening: "Listening",
  thinking: "",
  speaking: "",
};

const STATE_COLOR: Record<VoiceState, string> = {
  idle: "#3a65f0",
  listening: "#1a9b5e",
  thinking: "#3a65f0",
  speaking: "#3a65f0",
};

type SpeechRecognitionResult = { transcript: string };
type SpeechRecognitionEvent = {
  results: ArrayLike<ArrayLike<SpeechRecognitionResult>>;
};
type SpeechRecognitionType = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionType;
    webkitSpeechRecognition: new () => SpeechRecognitionType;
  }
}


export default function VoicePage() {
  const router = useRouter();
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognitionType | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gotResultRef = useRef(false);
  const color = STATE_COLOR[voiceState];

  useEffect(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }
    const r = new SR();
    r.continuous = false;
    r.interimResults = false;
    r.lang = "en-US";

    r.onresult = (e) => {
      gotResultRef.current = true;
      const text = e.results[0][0].transcript;
      handleQuery(text);
    };
    r.onerror = () => setVoiceState("idle");
    r.onend = () => {
      // If no result was captured (e.g. silence or mic denied), reset to idle
      if (!gotResultRef.current) setVoiceState("idle");
      gotResultRef.current = false;
    };
    recognitionRef.current = r;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleQuery = useCallback(async (text: string) => {
    console.log("[Aria voice] transcript:", text);
    setVoiceState("thinking");
    try {
      const res = await fetch("/api/ai/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error("[Aria voice] AI route failed", res.status, errText);
        setVoiceState("idle");
        return;
      }
      const data = await res.json();
      console.log("[Aria voice] reply:", data);
      const reply = String(data.reply ?? "");
      if (!reply) {
        console.error("[Aria voice] empty reply — ANTHROPIC_API_KEY may be missing on Vercel");
        setVoiceState("idle");
        return;
      }
      await speak(reply);
    } catch (e) {
      console.error("[Aria voice] handleQuery error", e);
      setVoiceState("idle");
    }
  }, []);

  async function speak(text: string) {
    // Stop any current source
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch { /* already stopped */ }
      sourceRef.current = null;
    }

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error("TTS failed");

      const arrayBuffer = await res.arrayBuffer();

      // AudioContext was unlocked on tap — use it to bypass iOS autoplay block
      const ctx = audioCtxRef.current!;
      if (ctx.state === "suspended") await ctx.resume();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      sourceRef.current = source;

      setVoiceState("speaking");
      source.onended = () => { setVoiceState("idle"); sourceRef.current = null; };
      source.start(0);
    } catch (e) {
      console.error("speak error — falling back to browser TTS", e);
      // Fallback: browser speech synthesis so something always plays
      try {
        const utt = new SpeechSynthesisUtterance(text);
        utt.rate = 1.1;
        const voices = speechSynthesis.getVoices();
        const fem = voices.find(v => /female|samantha|karen|victoria/i.test(v.name));
        if (fem) utt.voice = fem;
        setVoiceState("speaking");
        utt.onend = () => setVoiceState("idle");
        speechSynthesis.speak(utt);
      } catch {
        setVoiceState("idle");
      }
    }
  }

  function startListening() {
    if (!recognitionRef.current) return;
    setVoiceState("listening");
    try { recognitionRef.current.start(); } catch { /* already running */ }
  }

  function stopAll() {
    recognitionRef.current?.stop();
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch { /* already stopped */ }
      sourceRef.current = null;
    }
    setVoiceState("idle");
  }

  function handleOrbTap() {
    // Unlock / create AudioContext on first user gesture (required for iOS)
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    } else if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    if (voiceState === "idle") startListening();
    else stopAll();
  }

  const isActive = voiceState === "listening" || voiceState === "speaking";
  const isThinking = voiceState === "thinking";

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center overflow-hidden select-none"
      style={{ background: "#040407" }}
    >
      {/* Full screen ambient */}
      <div
        className="pointer-events-none absolute inset-0 transition-all duration-1000"
        style={{
          background: `radial-gradient(ellipse 70% 60% at 50% 50%, ${color}12 0%, transparent 70%)`,
        }}
      />

      {/* Close button */}
      <div className="relative z-10 flex w-full justify-end px-6 pt-14">
        <button
          type="button"
          onClick={() => { stopAll(); router.back(); }}
          className="flex h-10 w-10 items-center justify-center rounded-full border-[0.5px] border-white/6 bg-white/3 text-[#555570] transition hover:text-white"
        >
          <X size={16} strokeWidth={1.8} />
        </button>
      </div>

      {/* Main orb — vertically centered */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-0">

        <button
          type="button"
          onClick={handleOrbTap}
          aria-label={STATE_LABEL[voiceState] || "Aria"}
          className="relative flex items-center justify-center outline-none"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          {/* Expanding rings when active */}
          {isActive && (
            <>
              <span className="absolute rounded-full" style={{ width: 280, height: 280, background: `${color}05`, animation: "ring-out 2.4s ease-out infinite" }} />
              <span className="absolute rounded-full" style={{ width: 230, height: 230, background: `${color}07`, animation: "ring-out 2.4s ease-out infinite 0.6s" }} />
              <span className="absolute rounded-full" style={{ width: 185, height: 185, background: `${color}09`, animation: "ring-out 2.4s ease-out infinite 1.2s" }} />
            </>
          )}

          {/* Steady outer ring */}
          <span
            className="absolute rounded-full"
            style={{
              width: 170, height: 170,
              border: `0.5px solid ${color}20`,
              transition: "all 700ms cubic-bezier(0.16,1,0.3,1)",
              transform: isActive ? "scale(1.04)" : "scale(1)",
            }}
          />

          {/* Inner ring */}
          <span
            className="absolute rounded-full"
            style={{
              width: 148, height: 148,
              border: `0.5px solid ${color}30`,
              transition: "all 700ms cubic-bezier(0.16,1,0.3,1)",
            }}
          />

          {/* Orb */}
          <span
            className="relative flex items-center justify-center rounded-full"
            style={{
              width: 120, height: 120,
              background:
                voiceState === "listening"
                  ? "radial-gradient(circle at 38% 35%, #80f0a8, #1a9b5e 55%, #28a855)"
                  : "radial-gradient(circle at 38% 35%, #8aacff, #3a65f0 55%, #2a48cc)",
              boxShadow:
                voiceState === "listening"
                  ? "0 0 0 1px rgba(80,220,120,0.25), 0 20px 80px rgba(80,220,120,0.4)"
                  : "0 0 0 1px rgba(58,101,240,0.25), 0 20px 80px rgba(58,101,240,0.4)",
              transition: "all 700ms cubic-bezier(0.16,1,0.3,1)",
              transform: isThinking ? "scale(0.9)" : isActive ? "scale(1.06)" : "scale(1)",
              opacity: isThinking ? 0.7 : 1,
            }}
          >
            {/* Thinking spinner inside orb */}
            {isThinking ? (
              <span
                className="block rounded-full border-[1.5px] border-white/20 border-t-white/80"
                style={{ width: 28, height: 28, animation: "spin 0.8s linear infinite" }}
              />
            ) : (
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="3" width="6" height="11" rx="3" />
                <path d="M5 10a7 7 0 0014 0" />
                <line x1="12" y1="19" x2="12" y2="22" />
                <line x1="8" y1="22" x2="16" y2="22" />
              </svg>
            )}
          </span>
        </button>

        {/* State label below orb */}
        <p
          className="mt-10 text-[13px] font-medium tracking-[0.08em] transition-all duration-500"
          style={{ color: voiceState === "idle" ? "#33334a" : `${color}cc` }}
        >
          {STATE_LABEL[voiceState] || "\u00a0"}
        </p>

        {/* Unsupported notice */}
        {!supported && (
          <p className="mt-4 text-[12px] text-[#ff8080]">
            Use Safari on iPhone for voice
          </p>
        )}
      </div>

      {/* Bottom wordmark */}
      <div className="relative z-10 pb-16 text-center">
        <p className="text-[11px] font-medium tracking-[0.2em] text-[#22222e] uppercase">Aria Voice</p>
      </div>

      <style>{`
        @keyframes ring-out {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.9); opacity: 0; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

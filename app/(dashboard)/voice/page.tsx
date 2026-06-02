"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { X, AlertCircle, RefreshCw } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type VoiceState = "idle" | "listening" | "thinking" | "speaking" | "error";

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

const CHIPS = [
  "What's my pipeline today?",
  "Any new client matches?",
  "Showings this week?",
  "Draft a follow-up SMS",
  "Market update for NJ?",
];

// ── Aria "A" logo SVG ─────────────────────────────────────────────────────────

function AriaA({ size = 36 }: { size?: number }) {
  return (
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" width={size} height={size} aria-hidden>
      <defs>
        <linearGradient id="orb-aria-grad" x1="100" y1="20" x2="100" y2="180" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="rgba(255,255,255,0.95)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.70)" />
        </linearGradient>
      </defs>
      <path
        d="M100 28 L168 178 L132 178 L122 152 L78 152 L68 178 L32 178 Z M88 128 L112 128 L100 96 Z"
        fill="url(#orb-aria-grad)"
      />
    </svg>
  );
}

// ── Orb component ─────────────────────────────────────────────────────────────

function VoiceOrb({
  state,
  onTap,
}: {
  state: VoiceState;
  onTap: () => void;
}) {
  const isListening = state === "listening";
  const isSpeaking = state === "speaking";
  const isThinking = state === "thinking";
  const isActive = isListening || isSpeaking;

  // Color values
  const orbColor = isListening ? "#1a9b5e" : "#3a65f0";
  const glowColor = isListening ? "80,220,120" : "58,101,240";

  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={state === "idle" ? "Tap to speak" : "Tap to stop"}
      className="relative flex items-center justify-center outline-none"
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      {/* Outermost expanding rings — listening & speaking */}
      {isActive && (
        <>
          <span
            className="absolute rounded-full"
            style={{
              width: 300, height: 300,
              background: `rgba(${glowColor},0.04)`,
              animation: "ring-out 2.6s ease-out infinite",
            }}
          />
          <span
            className="absolute rounded-full"
            style={{
              width: 250, height: 250,
              background: `rgba(${glowColor},0.06)`,
              animation: "ring-out 2.6s ease-out infinite 0.65s",
            }}
          />
          <span
            className="absolute rounded-full"
            style={{
              width: 200, height: 200,
              background: `rgba(${glowColor},0.09)`,
              animation: "ring-out 2.6s ease-out infinite 1.3s",
            }}
          />
        </>
      )}

      {/* Thinking: slow breathing ring */}
      {isThinking && (
        <span
          className="absolute rounded-full"
          style={{
            width: 196, height: 196,
            border: "0.5px solid rgba(58,101,240,0.15)",
            animation: "breathe 2.2s ease-in-out infinite",
          }}
        />
      )}

      {/* Outer static ring */}
      <span
        className="absolute rounded-full transition-all duration-700"
        style={{
          width: 180, height: 180,
          border: `0.5px solid ${orbColor}18`,
          transform: isActive ? "scale(1.06)" : "scale(1)",
        }}
      />

      {/* Mid ring */}
      <span
        className="absolute rounded-full transition-all duration-700"
        style={{
          width: 158, height: 158,
          border: `0.5px solid ${orbColor}28`,
        }}
      />

      {/* Core orb */}
      <span
        className="relative flex items-center justify-center rounded-full transition-all duration-700"
        style={{
          width: 132, height: 132,
          background: isListening
            ? "radial-gradient(circle at 38% 32%, #a0f4c0, #1a9b5e 55%, #158848)"
            : "radial-gradient(circle at 38% 32%, #8aacff, #3a65f0 55%, #2a48cc)",
          boxShadow: isListening
            ? `0 0 0 1px rgba(80,220,120,0.2), 0 0 60px rgba(80,220,120,0.35), 0 20px 80px rgba(0,0,0,0.6)`
            : `0 0 0 1px rgba(58,101,240,0.2), 0 0 60px rgba(58,101,240,0.35), 0 20px 80px rgba(0,0,0,0.6)`,
          transform: isThinking
            ? "scale(0.88)"
            : isActive
            ? "scale(1.07)"
            : "scale(1)",
          opacity: isThinking ? 0.75 : 1,
        }}
      >
        {isThinking ? (
          <span
            className="block rounded-full border-[1.5px] border-white/25 border-t-white"
            style={{ width: 30, height: 30, animation: "spin 0.85s linear infinite" }}
          />
        ) : (
          <AriaA size={38} />
        )}
      </span>
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function VoicePage() {
  const router = useRouter();
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [supported, setSupported] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const [lastReply, setLastReply] = useState<string>("");

  const recognitionRef = useRef<SpeechRecognitionType | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gotResultRef = useRef(false);

  // Ambient glow color per state
  const glowRGB =
    voiceState === "listening" ? "80,220,120"
    : voiceState === "error" ? "220,60,60"
    : "58,101,240";

  // ── Speech recognition setup ────────────────────────────────────────────────

  const handleQuery = useCallback(async (text: string) => {
    setTranscript(text);
    setVoiceState("thinking");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/ai/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error("[Aria voice] AI route failed", res.status, errText);
        setErrorMsg("Couldn't reach Aria — please try again.");
        setVoiceState("error");
        return;
      }
      const data = await res.json();
      const reply = String(data.reply ?? "");
      if (!reply) {
        setErrorMsg("Aria returned an empty response.");
        setVoiceState("error");
        return;
      }
      setLastReply(reply);
      await speak(reply);
    } catch (e) {
      console.error("[Aria voice] handleQuery error", e);
      setErrorMsg("Something went wrong. Tap to try again.");
      setVoiceState("error");
    }
  }, []);

  useEffect(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }
    const r = new SR();
    r.continuous = false;
    r.interimResults = false;
    r.lang = "en-US";

    r.onresult = (e) => {
      gotResultRef.current = true;
      const text = e.results[0][0].transcript;
      void handleQuery(text);
    };
    r.onerror = () => {
      setVoiceState("idle");
    };
    r.onend = () => {
      if (!gotResultRef.current) setVoiceState("idle");
      gotResultRef.current = false;
    };
    recognitionRef.current = r;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── TTS ──────────────────────────────────────────────────────────────────────

  async function speak(text: string) {
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
      console.error("speak error — fallback to browser TTS", e);
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

  // ── Controls ─────────────────────────────────────────────────────────────────

  function startListening() {
    if (!recognitionRef.current) return;
    setTranscript("");
    setLastReply("");
    setErrorMsg(null);
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
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    } else if (audioCtxRef.current.state === "suspended") {
      void audioCtxRef.current.resume();
    }
    if (voiceState === "idle" || voiceState === "error") startListening();
    else stopAll();
  }

  function handleChip(text: string) {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    void handleQuery(text);
  }

  // ── Derived UI ────────────────────────────────────────────────────────────────

  const showChips = voiceState === "idle";
  const stateHint =
    voiceState === "idle" ? "Tap to speak"
    : voiceState === "listening" ? "Listening…"
    : voiceState === "thinking" ? "Thinking…"
    : voiceState === "speaking" ? "Speaking"
    : "Tap to try again";

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col select-none overflow-hidden"
      style={{ background: "#040407" }}
    >
      {/* Ambient background — shifts per state */}
      <div
        className="pointer-events-none absolute inset-0 transition-all duration-1000"
        style={{
          background: `radial-gradient(ellipse 65% 55% at 50% 42%, rgba(${glowRGB},0.10) 0%, transparent 68%)`,
        }}
      />

      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <div
        className="relative z-10 flex w-full items-center justify-between px-5"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 14px)", paddingBottom: 14 }}
      >
        <span className="text-[13px] font-semibold tracking-[0.12em] uppercase text-white/20">
          Ask Aria
        </span>
        <button
          type="button"
          onClick={() => { stopAll(); router.back(); }}
          className="flex h-9 w-9 items-center justify-center rounded-full text-white/30 transition hover:text-white/60"
          style={{ background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.07)" }}
        >
          <X size={15} strokeWidth={2} />
        </button>
      </div>

      {/* ── Center: orb zone ───────────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center">

        {/* Transcript / reply text above orb */}
        <div className="mb-10 flex min-h-[44px] max-w-[260px] flex-col items-center justify-end gap-1">
          {transcript && voiceState !== "idle" ? (
            <p className="text-center text-[13px] font-medium leading-snug text-white/50">
              &ldquo;{transcript}&rdquo;
            </p>
          ) : voiceState === "speaking" && lastReply ? (
            <p className="text-center text-[13px] font-medium leading-snug text-white/50 line-clamp-2">
              {lastReply}
            </p>
          ) : null}
        </div>

        {/* Orb */}
        <VoiceOrb state={voiceState} onTap={handleOrbTap} />

        {/* State hint below orb */}
        <p
          className="mt-8 text-[12px] font-medium tracking-[0.10em] uppercase transition-all duration-500"
          style={{
            color:
              voiceState === "idle" ? "rgba(255,255,255,0.18)"
              : voiceState === "error" ? "rgba(220,80,80,0.85)"
              : voiceState === "listening" ? "rgba(80,220,120,0.75)"
              : "rgba(100,130,255,0.75)",
          }}
        >
          {stateHint}
        </p>

        {/* Unsupported — mic not available */}
        {!supported && (
          <div
            className="mt-6 flex items-center gap-2 rounded-xl px-4 py-3"
            style={{ background: "rgba(220,60,60,0.08)", border: "0.5px solid rgba(220,60,60,0.2)" }}
          >
            <AlertCircle size={14} className="shrink-0 text-red-400" />
            <p className="text-[12px] text-red-300">Voice requires Safari on iPhone</p>
          </div>
        )}

        {/* API / TTS error banner */}
        {voiceState === "error" && errorMsg && supported && (
          <div
            className="mt-6 flex items-center gap-3 rounded-xl px-4 py-3"
            style={{ background: "rgba(220,60,60,0.07)", border: "0.5px solid rgba(220,60,60,0.18)" }}
          >
            <AlertCircle size={14} className="shrink-0 text-red-400" />
            <p className="flex-1 text-[12px] text-red-300">{errorMsg}</p>
            <button
              type="button"
              onClick={() => { setVoiceState("idle"); setErrorMsg(null); }}
              className="shrink-0 text-red-400 hover:text-red-200 transition"
            >
              <RefreshCw size={13} />
            </button>
          </div>
        )}

      </div>

      {/* ── Prompt chips ───────────────────────────────────────────────────── */}
      <div
        className="relative z-10 transition-all duration-400"
        style={{
          opacity: showChips ? 1 : 0,
          pointerEvents: showChips ? "auto" : "none",
          transform: showChips ? "translateY(0)" : "translateY(8px)",
        }}
      >
        <div
          className="flex gap-2.5 overflow-x-auto px-5 pb-3"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => handleChip(chip)}
              className="shrink-0 rounded-full px-4 py-2.5 text-[12px] font-medium text-white/60 transition-all active:scale-95 hover:text-white/90"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "0.5px solid rgba(255,255,255,0.10)",
                whiteSpace: "nowrap",
              }}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* ── Bottom spacer — clears the floating bottom nav (≈ 88px) ─────── */}
      <div style={{ height: "calc(env(safe-area-inset-bottom) + 88px)" }} />

      {/* ── Keyframes ─────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes ring-out {
          0%   { transform: scale(1);   opacity: 1; }
          100% { transform: scale(2.0); opacity: 0; }
        }
        @keyframes breathe {
          0%, 100% { transform: scale(1);    opacity: 0.4; }
          50%       { transform: scale(1.06); opacity: 0.9; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

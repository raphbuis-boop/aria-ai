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
  idle: "#4f7bff",
  listening: "#50dc78",
  thinking: "#4f7bff",
  speaking: "#4f7bff",
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

// Pick best feminine voice available
function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  // Priority: Samantha (macOS/iOS) > Ava > Allison > any en-US female
  const priority = ["Samantha", "Ava", "Allison", "Susan", "Victoria", "Karen", "Moira"];
  for (const name of priority) {
    const v = voices.find((v) => v.name === name);
    if (v) return v;
  }
  // Fallback: any English female-sounding voice
  return voices.find((v) => v.lang.startsWith("en") && !v.name.includes("Male")) ?? voices[0] ?? null;
}

export default function VoicePage() {
  const router = useRouter();
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognitionType | null>(null);
  const color = STATE_COLOR[voiceState];

  useEffect(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }
    const r = new SR();
    r.continuous = false;
    r.interimResults = false;
    r.lang = "en-US";

    r.onresult = (e) => {
      const text = e.results[0][0].transcript;
      handleQuery(text);
    };
    r.onerror = () => setVoiceState("idle");
    r.onend = () => {
      setVoiceState((s) => s === "listening" ? "thinking" : s);
    };
    recognitionRef.current = r;

    // Pre-load voices
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleQuery = useCallback(async (text: string) => {
    setVoiceState("thinking");
    try {
      const res = await fetch("/api/ai/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      const data = await res.json();
      const reply = String(data.reply ?? "I didn't catch that. Try again.");
      speak(reply);
    } catch {
      setVoiceState("idle");
    }
  }, []);

  function speak(text: string) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);

    // Pick feminine voice, with slight delay to ensure voices loaded
    const trySpeak = () => {
      const voice = pickVoice();
      if (voice) u.voice = voice;
      u.rate = 0.95;
      u.pitch = 1.1;
      u.volume = 1;
      u.onstart = () => setVoiceState("speaking");
      u.onend = () => setVoiceState("idle");
      u.onerror = () => setVoiceState("idle");
      window.speechSynthesis.speak(u);
    };

    if (window.speechSynthesis.getVoices().length > 0) {
      trySpeak();
    } else {
      window.speechSynthesis.onvoiceschanged = trySpeak;
    }
  }

  function startListening() {
    if (!recognitionRef.current) return;
    setVoiceState("listening");
    try { recognitionRef.current.start(); } catch { /* already running */ }
  }

  function stopAll() {
    recognitionRef.current?.stop();
    window.speechSynthesis.cancel();
    setVoiceState("idle");
  }

  function handleOrbTap() {
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
                  ? "radial-gradient(circle at 38% 35%, #80f0a8, #50dc78 55%, #28a855)"
                  : "radial-gradient(circle at 38% 35%, #8aacff, #4f7bff 55%, #2a48cc)",
              boxShadow:
                voiceState === "listening"
                  ? "0 0 0 1px rgba(80,220,120,0.25), 0 20px 80px rgba(80,220,120,0.4)"
                  : "0 0 0 1px rgba(79,123,255,0.25), 0 20px 80px rgba(79,123,255,0.4)",
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

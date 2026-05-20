"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { X, ChevronLeft } from "lucide-react";

type VoiceState = "idle" | "listening" | "thinking" | "speaking";

const STATE_LABEL: Record<VoiceState, string> = {
  idle: "Tap to speak",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking…",
};

const STATE_COLOR: Record<VoiceState, string> = {
  idle: "#4f7bff",
  listening: "#50dc78",
  thinking: "#ffb832",
  speaking: "#4f7bff",
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

type SpeechRecognitionResult = { transcript: string };
type SpeechRecognitionEvent = {
  results: ArrayLike<ArrayLike<SpeechRecognitionResult>>;
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
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognitionType | null>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);
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
      setTranscript(text);
      handleQuery(text);
    };
    r.onerror = () => setVoiceState("idle");
    r.onend = () => {
      if (voiceState === "listening") setVoiceState("thinking");
    };
    recognitionRef.current = r;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleQuery = useCallback(async (text: string) => {
    setVoiceState("thinking");
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text, context: "Voice operator session." }),
      });
      const data = await res.json();
      const reply = String(data.reply ?? "I couldn't get a response. Try again.");
      setResponse(reply);
      speak(reply);
    } catch {
      setVoiceState("idle");
    }
  }, []);

  function speak(text: string) {
    window.speechSynthesis?.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    u.pitch = 1;
    u.volume = 1;
    u.onstart = () => setVoiceState("speaking");
    u.onend = () => setVoiceState("idle");
    u.onerror = () => setVoiceState("idle");
    synthRef.current = u;
    window.speechSynthesis?.speak(u);
  }

  function startListening() {
    if (!recognitionRef.current) return;
    setTranscript("");
    setResponse("");
    setVoiceState("listening");
    try { recognitionRef.current.start(); } catch { /* already started */ }
  }

  function stopAll() {
    recognitionRef.current?.stop();
    window.speechSynthesis?.cancel();
    setVoiceState("idle");
  }

  function handleOrbTap() {
    if (voiceState === "idle") startListening();
    else stopAll();
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-between overflow-hidden"
      style={{ background: "#050508" }}
    >
      {/* Ambient glow behind orb */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 600px 500px at 50% 50%, ${color}18 0%, transparent 70%)`,
          transition: "background 800ms ease",
        }}
      />

      {/* Top bar */}
      <div className="relative z-10 flex w-full items-center justify-between px-6 pt-14">
        <button
          type="button"
          onClick={() => { stopAll(); router.back(); }}
          className="flex h-10 w-10 items-center justify-center rounded-full border-[0.5px] border-white/8 bg-white/4 text-[#666680] transition hover:text-white"
        >
          <ChevronLeft size={18} strokeWidth={2} />
        </button>
        <span className="text-[13px] font-medium tracking-wide text-[#444460]">Aria Voice</span>
        <button
          type="button"
          onClick={() => { stopAll(); router.back(); }}
          className="flex h-10 w-10 items-center justify-center rounded-full border-[0.5px] border-white/8 bg-white/4 text-[#666680] transition hover:text-white"
        >
          <X size={16} strokeWidth={2} />
        </button>
      </div>

      {/* Center orb */}
      <div className="relative z-10 flex flex-col items-center">
        <button
          type="button"
          onClick={handleOrbTap}
          aria-label={STATE_LABEL[voiceState]}
          className="relative flex items-center justify-center outline-none"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          {/* Outer pulse rings */}
          {(voiceState === "listening" || voiceState === "speaking") && (
            <>
              <span
                className="absolute rounded-full"
                style={{
                  width: 220, height: 220,
                  background: `${color}08`,
                  animation: "ring-out 2s ease-out infinite",
                }}
              />
              <span
                className="absolute rounded-full"
                style={{
                  width: 180, height: 180,
                  background: `${color}10`,
                  animation: "ring-out 2s ease-out infinite 0.5s",
                }}
              />
            </>
          )}
          {/* Mid ring */}
          <span
            className="absolute rounded-full"
            style={{
              width: 156, height: 156,
              border: `0.5px solid ${color}28`,
              transition: "all 600ms ease",
              animation: voiceState === "idle" ? "none" : "ring-breathe 3s ease-in-out infinite",
            }}
          />
          {/* Orb */}
          <span
            className="relative flex items-center justify-center rounded-full"
            style={{
              width: 128, height: 128,
              background: `radial-gradient(circle at 38% 35%, ${color === "#50dc78" ? "#70eea0" : color === "#ffb832" ? "#ffd070" : "#7090ff"}, ${color} 55%, ${color === "#50dc78" ? "#28a850" : color === "#ffb832" ? "#d09020" : "#2a4acc"})`,
              boxShadow: `0 0 0 1px ${color}30, 0 20px 80px ${color}50`,
              transition: "all 600ms cubic-bezier(0.16,1,0.3,1)",
              transform: voiceState === "listening" ? "scale(1.08)" : voiceState === "thinking" ? "scale(0.95)" : "scale(1)",
            }}
          >
            {/* Mic icon */}
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 10a7 7 0 0014 0" />
              <line x1="12" y1="19" x2="12" y2="22" />
              <line x1="8" y1="22" x2="16" y2="22" />
            </svg>
          </span>
        </button>

        {/* State label */}
        <p
          className="mt-10 text-[14px] font-medium tracking-wide transition-all duration-500"
          style={{ color: voiceState === "idle" ? "#444460" : color }}
        >
          {STATE_LABEL[voiceState]}
        </p>
      </div>

      {/* Bottom content: transcript + response */}
      <div className="relative z-10 w-full max-w-md px-6 pb-20">
        {!supported && (
          <p className="mb-4 rounded-[14px] bg-white/4 px-4 py-3 text-center text-[13px] text-[#ff8080]">
            Voice is not supported on this browser. Use Safari or Chrome.
          </p>
        )}

        {transcript && (
          <div className="mb-3 rounded-[16px] border-[0.5px] border-white/6 bg-white/3 px-4 py-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[1px] text-[#444460]">You said</p>
            <p className="text-[14px] text-[#a0a0c0]">{transcript}</p>
          </div>
        )}

        {response && (
          <div className="rounded-[16px] border-[0.5px] border-[#4f7bff]/15 bg-[#4f7bff]/6 px-4 py-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[1px] text-[#4f7bff]">Aria</p>
            <p className="text-[14px] leading-relaxed text-[#c0c0d8]">{response}</p>
          </div>
        )}

        {voiceState === "idle" && !transcript && (
          <p className="text-center text-[12px] text-[#333348]">
            Ask about your pipeline, clients, follow-ups, or deals
          </p>
        )}
      </div>

      <style>{`
        @keyframes ring-out {
          0% { transform: scale(1); opacity: 0.7; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes ring-breathe {
          0%,100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
}

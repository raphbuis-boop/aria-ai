"use client";

import { createClient } from "@/lib/supabase/client";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, ArrowLeft, Mic, MicOff, Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

type Mode = "chat" | "voice";
type VoiceState = "idle" | "listening" | "thinking" | "speaking" | "error";
type Msg = { role: "user" | "assistant"; content: string; id: string };

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

// ── Constants ─────────────────────────────────────────────────────────────────

const BAR_COUNT = 32;
const DEFAULT_CHIPS = [
  "What should I do today?",
  "Who's my hottest lead?",
  "Any showings this week?",
  "Summarize my pipeline",
];

// ── Aria spark icon — 4-point star in blue gradient ───────────────────────────

function AriaSpark({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden
    >
      <defs>
        <linearGradient id="spark-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#60A5FA" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
      </defs>
      {/* 4-point star */}
      <path
        d="M20 2 L22.5 17.5 L38 20 L22.5 22.5 L20 38 L17.5 22.5 L2 20 L17.5 17.5 Z"
        fill="url(#spark-grad)"
      />
    </svg>
  );
}

// ── Waveform bars ─────────────────────────────────────────────────────────────

function WaveformBars({
  voiceState,
  color,
}: {
  voiceState: VoiceState;
  color: string;
}) {
  const [heights, setHeights] = useState<number[]>(Array(BAR_COUNT).fill(4));
  const frameRef = useRef<number>(0);
  const tickRef = useRef(0);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;

    if (voiceState === "idle") {
      intervalId = setInterval(() => {
        tickRef.current += 0.08;
        setHeights(
          Array.from({ length: BAR_COUNT }, (_, i) =>
            4 + 2 * Math.abs(Math.sin(tickRef.current + i * 0.35))
          )
        );
      }, 80);
    } else if (voiceState === "listening") {
      intervalId = setInterval(() => {
        setHeights(
          Array.from({ length: BAR_COUNT }, (_, i) => {
            const center = Math.abs(i - BAR_COUNT / 2);
            const envelope = 1 - center / (BAR_COUNT / 2) * 0.4;
            return 5 + Math.random() * 38 * envelope;
          })
        );
      }, 70);
    } else if (voiceState === "thinking") {
      intervalId = setInterval(() => {
        tickRef.current += 0.06;
        setHeights(
          Array.from({ length: BAR_COUNT }, (_, i) =>
            6 + 16 * Math.abs(Math.sin(tickRef.current + i * 0.28))
          )
        );
      }, 60);
    } else if (voiceState === "speaking") {
      intervalId = setInterval(() => {
        setHeights(
          Array.from({ length: BAR_COUNT }, (_, i) => {
            const center = Math.abs(i - BAR_COUNT / 2);
            const envelope = 1 - center / (BAR_COUNT / 2) * 0.25;
            return 4 + Math.random() * 28 * envelope;
          })
        );
      }, 75);
    } else {
      // error — flat
      setHeights(Array(BAR_COUNT).fill(4));
    }

    const frameSnapshot = frameRef.current;
    return () => {
      clearInterval(intervalId);
      cancelAnimationFrame(frameSnapshot);
    };
  }, [voiceState]);

  return (
    <div className="flex items-center justify-center gap-[3px]" style={{ height: 64 }}>
      {heights.map((h, i) => (
        <motion.div
          key={i}
          animate={{ height: h }}
          transition={{ type: "spring", stiffness: 280, damping: 18, mass: 0.6 }}
          style={{
            width: 3,
            borderRadius: 3,
            background: color,
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  );
}

// ── Chat bubble ───────────────────────────────────────────────────────────────

function ChatBubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 340, damping: 26 }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      {!isUser && (
        <div
          className="h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 mr-2 mt-0.5"
          style={{ background: "rgba(59,130,246,0.16)" }}
        >
          <AriaSpark size={16} />
        </div>
      )}
      <div
        className="max-w-[80%] rounded-[18px] px-4 py-2.5 text-[14px] leading-relaxed"
        style={
          isUser
            ? {
                background: "var(--oc-blue)",
                color: "#fff",
                borderBottomRightRadius: 4,
              }
            : {
                background: "var(--oc-surface-1)",
                border: "0.5px solid var(--oc-border-soft)",
                color: "var(--oc-text-1)",
                borderBottomLeftRadius: 4,
              }
        }
      >
        {msg.content}
      </div>
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function VoicePage() {
  const router = useRouter();
  const supabase = createClient();

  // ── Mode & voice state ──
  const [mode, setMode] = useState<Mode>("chat");
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");

  // ── Chat ──
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Voice ──
  const [transcript, setTranscript] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [micSupported, setMicSupported] = useState(true);

  // ── Agent context ──
  const [agentName, setAgentName] = useState<string>("");
  const [chips, setChips] = useState<string[]>(DEFAULT_CHIPS);

  // ── Refs ──
  const recognitionRef = useRef<SpeechRecognitionType | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gotResultRef = useRef(false);
  const historyRef = useRef<Msg[]>([]);

  // Keep historyRef in sync with messages
  useEffect(() => {
    historyRef.current = messages;
  }, [messages]);

  // Scroll chat to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Fetch agent context on mount ──────────────────────────────────────────
  useEffect(() => {
    void (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const [profileRes, clientsRes, showingsRes, draftsRes] = await Promise.allSettled([
          supabase
            .from("agent_profiles")
            .select("full_name")
            .eq("id", user.id)
            .maybeSingle(),
          supabase
            .from("clients")
            .select("name, lead_score, town")
            .eq("agent_id", user.id)
            .order("lead_score", { ascending: false })
            .limit(3),
          supabase
            .from("showings")
            .select("address")
            .eq("agent_id", user.id)
            .eq("status", "scheduled")
            .gte("showing_date", new Date().toISOString())
            .limit(1),
          supabase
            .from("activities")
            .select("id", { count: "exact" })
            .eq("agent_id", user.id)
            .eq("ai_draft", true)
            .eq("approved", false)
            .eq("sent", false),
        ]);

        if (profileRes.status === "fulfilled" && profileRes.value.data?.full_name) {
          setAgentName(profileRes.value.data.full_name.split(" ")[0]);
        }

        const topClients =
          clientsRes.status === "fulfilled" ? clientsRes.value.data ?? [] : [];
        const nextShowing =
          showingsRes.status === "fulfilled" ? showingsRes.value.data?.[0] : null;
        const draftCount =
          draftsRes.status === "fulfilled"
            ? (draftsRes.value.count ?? draftsRes.value.data?.length ?? 0)
            : 0;

        // Generate context-aware chips
        const dynamic: string[] = ["What should I do today?"];
        if (draftCount > 0) dynamic.push("Review my pending drafts");
        if (topClients[0]) dynamic.push(`Any updates on ${(topClients[0].name as string).split(" ")[0]}?`);
        if (nextShowing?.address) dynamic.push(`Prep for ${nextShowing.address as string}`);
        if (topClients.length > 1) dynamic.push("Who's my hottest lead?");
        dynamic.push("Summarize my pipeline");

        setChips(dynamic.slice(0, 5));
      } catch {
        // Non-fatal — keep default chips
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Greeting text ─────────────────────────────────────────────────────────
  const greeting = (() => {
    const h = new Date().getHours();
    const time = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
    return agentName ? `${time}, ${agentName}.` : "What's on your mind?";
  })();

  // ── Speech recognition init ───────────────────────────────────────────────
  useEffect(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) {
      setMicSupported(false);
      return;
    }
    const r = new SR();
    r.continuous = false;
    r.interimResults = false;
    r.lang = "en-US";

    r.onresult = (e) => {
      gotResultRef.current = true;
      const text = e.results[0][0].transcript;
      void handleVoiceQuery(text);
    };
    r.onerror = () => setVoiceState("idle");
    r.onend = () => {
      if (!gotResultRef.current) setVoiceState("idle");
      gotResultRef.current = false;
    };
    recognitionRef.current = r;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── TTS ───────────────────────────────────────────────────────────────────
  const speak = useCallback(async (text: string) => {
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch { /* stopped */ }
      sourceRef.current = null;
    }
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error("TTS failed");
      const buf = await res.arrayBuffer();
      const ctx = audioCtxRef.current!;
      if (ctx.state === "suspended") await ctx.resume();
      const audioBuf = await ctx.decodeAudioData(buf);
      const source = ctx.createBufferSource();
      source.buffer = audioBuf;
      source.connect(ctx.destination);
      sourceRef.current = source;
      setVoiceState("speaking");
      source.onended = () => { setVoiceState("idle"); sourceRef.current = null; };
      source.start(0);
    } catch {
      // Browser TTS fallback
      try {
        const utt = new SpeechSynthesisUtterance(text);
        utt.rate = 1.1;
        const voices = speechSynthesis.getVoices();
        const fem = voices.find((v) => /female|samantha|karen|victoria/i.test(v.name));
        if (fem) utt.voice = fem;
        setVoiceState("speaking");
        utt.onend = () => setVoiceState("idle");
        speechSynthesis.speak(utt);
      } catch {
        setVoiceState("idle");
      }
    }
  }, []);

  // ── Call assistant route ──────────────────────────────────────────────────
  const callAssistant = useCallback(
    async (question: string, mode: "chat" | "voice"): Promise<string> => {
      const res = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          mode,
          history: historyRef.current
            .slice(-6)
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!res.ok) throw new Error(`Assistant error ${res.status}`);
      const data = (await res.json()) as { reply?: string };
      return String(data.reply ?? "");
    },
    []
  );

  // ── Chat: send message ────────────────────────────────────────────────────
  const sendChat = useCallback(
    async (text?: string) => {
      const q = (text ?? input).trim();
      if (!q || isLoading) return;
      setInput("");
      setIsLoading(true);
      const userMsg: Msg = { role: "user", content: q, id: crypto.randomUUID() };
      setMessages((prev) => [...prev, userMsg]);
      try {
        const reply = await callAssistant(q, "chat");
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: reply, id: crypto.randomUUID() },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Something went wrong reaching Aria. Try again.",
            id: crypto.randomUUID(),
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [input, isLoading, callAssistant]
  );

  // ── Voice: handle transcribed query ──────────────────────────────────────
  const handleVoiceQuery = useCallback(
    async (text: string) => {
      setTranscript(text);
      setVoiceState("thinking");
      setErrorMsg(null);
      try {
        const reply = await callAssistant(text, "voice");
        if (!reply) {
          setErrorMsg("Aria returned an empty response.");
          setVoiceState("error");
          return;
        }
        await speak(reply);
      } catch {
        setErrorMsg("Couldn't reach Aria — tap to try again.");
        setVoiceState("error");
      }
    },
    [callAssistant, speak]
  );

  // ── Voice controls ────────────────────────────────────────────────────────
  function ensureAudioCtx() {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    } else if (audioCtxRef.current.state === "suspended") {
      void audioCtxRef.current.resume();
    }
  }

  function startListening() {
    if (!recognitionRef.current) return;
    ensureAudioCtx();
    setTranscript("");
    setErrorMsg(null);
    setVoiceState("listening");
    try { recognitionRef.current.start(); } catch { /* already running */ }
  }

  function stopAll() {
    recognitionRef.current?.stop();
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch { /* stopped */ }
      sourceRef.current = null;
    }
    setVoiceState("idle");
  }

  function handleVoiceTap() {
    if (voiceState === "idle" || voiceState === "error") startListening();
    else stopAll();
  }

  // ── Mic from chat composer — jump to voice mode ───────────────────────────
  function handleComposerMic() {
    ensureAudioCtx();
    setMode("voice");
    setTimeout(startListening, 150);
  }

  // ── Mode tab colors ───────────────────────────────────────────────────────
  const waveColor =
    voiceState === "listening" ? "#1A9B5E"
    : voiceState === "error" ? "#C43838"
    : "var(--oc-blue)";

  const stateLabel =
    voiceState === "idle" ? "Tap to speak"
    : voiceState === "listening" ? "Listening…"
    : voiceState === "thinking" ? "Thinking…"
    : voiceState === "speaking" ? "Speaking"
    : "Tap to try again";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col select-none overflow-hidden"
      style={{ background: "#0C0F16", color: "var(--oc-text-1)" }}
    >
      {/* Atmospheric glow — shifts blue at bottom */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 100%, rgba(59,130,246,0.12) 0%, transparent 70%)",
        }}
      />

      {/* ── Top bar ── */}
      <div
        className="relative z-10 flex w-full items-center justify-between px-5 shrink-0"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 14px)", paddingBottom: 14 }}
      >
        <button
          type="button"
          onClick={() => { stopAll(); router.back(); }}
          className="flex h-9 w-9 items-center justify-center rounded-full active:opacity-70"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "0.5px solid rgba(255,255,255,0.08)",
          }}
          aria-label="Close"
        >
          <ArrowLeft size={16} style={{ color: "var(--oc-text-2)" }} />
        </button>

        {/* Mode switcher pill */}
        <div
          className="flex gap-0.5 rounded-full p-0.5"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "0.5px solid rgba(255,255,255,0.08)",
          }}
        >
          {(["chat", "voice"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                if (m !== "voice") stopAll();
                setMode(m);
              }}
              className="rounded-full px-3.5 py-1.5 text-[12px] font-medium capitalize transition-all duration-200"
              style={
                mode === m
                  ? { background: "var(--oc-blue)", color: "#fff" }
                  : { color: "var(--oc-text-3)" }
              }
            >
              {m}
            </button>
          ))}
        </div>

        <div style={{ width: 36 }} /> {/* spacer to balance top bar */}
      </div>

      {/* ── Mode content ── */}
      <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
        <AnimatePresence mode="wait">

          {/* ══ CHAT MODE ══════════════════════════════════════════════════════ */}
          {mode === "chat" && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="flex flex-1 flex-col overflow-hidden"
            >
              {messages.length === 0 ? (
                /* ── Empty state: greeting + chips ── */
                <div className="flex flex-1 flex-col items-center justify-center px-6">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: "spring", stiffness: 280, damping: 22, delay: 0.05 }}
                    className="mb-5"
                  >
                    <AriaSpark size={44} />
                  </motion.div>

                  <motion.h1
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                    className="text-[28px] font-bold text-center mb-1"
                    style={{ letterSpacing: "-0.02em", color: "var(--oc-text-1)" }}
                  >
                    {greeting}
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.15 }}
                    className="text-[15px] text-center mb-8"
                    style={{ color: "var(--oc-text-3)" }}
                  >
                    What&apos;s on your mind?
                  </motion.p>

                  {/* Context-aware chips */}
                  <div className="w-full max-w-sm space-y-2">
                    {chips.map((chip, i) => (
                      <motion.button
                        key={chip}
                        type="button"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, delay: 0.18 + i * 0.06 }}
                        onClick={() => void sendChat(chip)}
                        className="w-full text-left rounded-2xl px-4 py-3 text-[14px] active:opacity-70"
                        style={{
                          background: "var(--oc-surface-1)",
                          border: "0.5px solid var(--oc-border-soft)",
                          backdropFilter: "blur(24px) saturate(240%)",
                          WebkitBackdropFilter: "blur(24px) saturate(240%)",
                          color: "var(--oc-text-2)",
                        }}
                      >
                        {chip}
                      </motion.button>
                    ))}
                  </div>
                </div>
              ) : (
                /* ── Conversation ── */
                <div className="flex-1 overflow-y-auto px-4 py-2" style={{ scrollbarWidth: "none" }}>
                  <div className="space-y-3 pb-2">
                    {messages.map((m) => (
                      <ChatBubble key={m.id} msg={m} />
                    ))}
                    {isLoading && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex justify-start"
                      >
                        <div
                          className="rounded-[18px] rounded-bl-[4px] px-4 py-3"
                          style={{
                            background: "var(--oc-surface-1)",
                            border: "0.5px solid var(--oc-border-soft)",
                          }}
                        >
                          {/* Typing dots */}
                          <div className="flex gap-1.5 items-center h-4">
                            {[0, 1, 2].map((i) => (
                              <motion.div
                                key={i}
                                animate={{ y: [0, -4, 0] }}
                                transition={{
                                  duration: 0.6,
                                  repeat: Infinity,
                                  delay: i * 0.15,
                                }}
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ background: "var(--oc-text-3)" }}
                              />
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </div>
              )}

              {/* ── Bottom composer ── */}
              <div
                className="shrink-0 px-4"
                style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)", paddingTop: 12 }}
              >
                <div
                  className="flex items-center gap-2 rounded-full px-4 py-2"
                  style={{
                    background: "var(--oc-surface-1)",
                    border: "0.5px solid var(--oc-border-soft)",
                    backdropFilter: "blur(24px) saturate(240%)",
                    WebkitBackdropFilter: "blur(24px) saturate(240%)",
                  }}
                >
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void sendChat();
                      }
                    }}
                    placeholder="Ask Aria…"
                    className="flex-1 min-w-0 bg-transparent text-[15px] outline-none"
                    style={{
                      color: "var(--oc-text-1)",
                    }}
                    autoComplete="off"
                    autoCorrect="off"
                  />

                  {/* Mic button — switches to voice mode */}
                  {!input.trim() && micSupported && (
                    <button
                      type="button"
                      onClick={handleComposerMic}
                      className="h-9 w-9 flex items-center justify-center rounded-full flex-shrink-0 active:opacity-70"
                      style={{ background: "rgba(255,255,255,0.08)" }}
                      aria-label="Voice input"
                    >
                      <Mic size={16} style={{ color: "var(--oc-text-2)" }} />
                    </button>
                  )}

                  {/* Send button */}
                  {input.trim() && (
                    <button
                      type="button"
                      onClick={() => void sendChat()}
                      disabled={isLoading}
                      className="h-9 w-9 flex items-center justify-center rounded-full flex-shrink-0 disabled:opacity-40 active:opacity-80"
                      style={{ background: "var(--oc-blue)" }}
                      aria-label="Send"
                    >
                      <Send size={15} color="#fff" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ══ VOICE MODE ═════════════════════════════════════════════════════ */}
          {mode === "voice" && (
            <motion.div
              key="voice"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="flex flex-1 flex-col items-center"
            >
              {/* Transcript card — slides up when present */}
              <div className="w-full px-5 mb-4" style={{ minHeight: 72 }}>
                <AnimatePresence>
                  {(transcript || voiceState === "speaking") && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ type: "spring", stiffness: 300, damping: 24 }}
                      className="rounded-2xl px-4 py-3 text-[13px] leading-relaxed text-center"
                      style={{
                        background: "var(--oc-surface-1)",
                        border: "0.5px solid var(--oc-border-soft)",
                        color: "var(--oc-text-2)",
                        backdropFilter: "blur(24px) saturate(240%)",
                        WebkitBackdropFilter: "blur(24px) saturate(240%)",
                      }}
                    >
                      {transcript}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Waveform + tap target */}
              <div className="flex flex-1 flex-col items-center justify-center">
                <button
                  type="button"
                  onClick={handleVoiceTap}
                  className="flex flex-col items-center gap-6 outline-none active:opacity-80"
                  aria-label={voiceState === "idle" ? "Tap to speak" : "Tap to stop"}
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  <WaveformBars voiceState={voiceState} color={waveColor} />

                  {/* State label */}
                  <motion.p
                    key={voiceState}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-[12px] font-medium tracking-[0.10em] uppercase"
                    style={{ color: waveColor === "var(--oc-blue)" ? "rgba(255,255,255,0.22)" : waveColor }}
                  >
                    {stateLabel}
                  </motion.p>
                </button>
              </div>

              {/* Error banner */}
              <AnimatePresence>
                {voiceState === "error" && errorMsg && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mx-5 mb-4 flex items-center gap-3 rounded-2xl px-4 py-3"
                    style={{
                      background: "rgba(196,56,56,0.08)",
                      border: "0.5px solid rgba(196,56,56,0.22)",
                    }}
                  >
                    <AlertCircle size={14} color="#C43838" className="shrink-0" />
                    <p className="flex-1 text-[13px]" style={{ color: "#C43838" }}>
                      {errorMsg}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Unsupported mic warning */}
              {!micSupported && (
                <div
                  className="mx-5 mb-4 flex items-center gap-2 rounded-2xl px-4 py-3"
                  style={{
                    background: "rgba(196,56,56,0.08)",
                    border: "0.5px solid rgba(196,56,56,0.2)",
                  }}
                >
                  <MicOff size={14} color="#C43838" className="shrink-0" />
                  <p className="text-[13px]" style={{ color: "#C43838" }}>
                    Voice requires Safari on iPhone
                  </p>
                </div>
              )}

              {/* Voice controls */}
              <div
                className="shrink-0 flex items-center justify-center gap-4 pb-4"
                style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
              >
                <button
                  type="button"
                  onClick={() => { stopAll(); setMode("chat"); }}
                  className="flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-medium active:opacity-70"
                  style={{
                    background: "var(--oc-surface-1)",
                    border: "0.5px solid var(--oc-border-soft)",
                    color: "var(--oc-text-2)",
                  }}
                >
                  <ArrowLeft size={14} />
                  Chat
                </button>

                {(voiceState === "listening" || voiceState === "speaking") && (
                  <button
                    type="button"
                    onClick={stopAll}
                    className="flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-medium active:opacity-70"
                    style={{ background: "rgba(196,56,56,0.14)", color: "#C43838" }}
                  >
                    Stop
                  </button>
                )}
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}

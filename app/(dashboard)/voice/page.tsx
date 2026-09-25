"use client";

import { createClient } from "@/lib/supabase/client";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertCircle, ArrowLeft, ChevronRight, Mic, MicOff, Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type Mode = "chat" | "voice";
type VoiceState = "idle" | "listening" | "thinking" | "speaking" | "error";
type ChatAction = { label: string; href: string };
type Msg = { role: "user" | "assistant"; content: string; id: string; action?: ChatAction | null };

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
  "Review my pending drafts",
  "Who's my hottest lead?",
  "Any showings this week?",
];

// ── Aria spark — 4-point star, the app's one green accent ─────────────────────

function AriaSpark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
      {/* 4-point star */}
      <path
        d="M20 2 L22.5 17.5 L38 20 L22.5 22.5 L20 38 L17.5 22.5 L2 20 L17.5 17.5 Z"
        fill="var(--primary)"
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
  const router = useRouter();
  const isUser = msg.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 340, damping: 26 }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      {!isUser && (
        <div className="h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 mr-2 mt-0.5 bg-primary/10">
          <AriaSpark size={16} />
        </div>
      )}
      <div className="flex max-w-[80%] flex-col items-start gap-2">
        <div
          className={cn(
            "rounded-[18px] px-4 py-2.5 font-display text-body leading-relaxed",
            isUser
              ? "self-end bg-primary text-primary-foreground rounded-br-[4px]"
              : "border border-border bg-card text-foreground rounded-bl-[4px]",
          )}
        >
          {msg.content}
        </div>
        {!isUser && msg.action && (
          <button
            type="button"
            onClick={() => {
              try {
                navigator.vibrate?.(8);
              } catch {
                /* ignore */
              }
              router.push(msg.action!.href);
            }}
            className="inline-flex items-center gap-1 rounded-full bg-primary px-3.5 py-1.5 font-display text-caption font-semibold text-primary-foreground active:scale-95 transition-transform"
          >
            {msg.action.label}
            <ChevronRight className="size-3.5" />
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function VoicePage() {
  const router = useRouter();
  const supabase = createClient();
  const shouldReduceMotion = useReducedMotion();

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

        // Generate context-aware chips — money-first, capped at 4.
        // The 3 always-relevant chips get priority; the 4th slot goes to
        // whichever specific nudge (a showing to prep, a client to check on)
        // is most timely, falling back to a generic 4th if neither applies.
        const dynamic: string[] = ["What should I do today?"];
        if (draftCount > 0) dynamic.push("Review my pending drafts");
        if (topClients.length > 1) dynamic.push("Who's my hottest lead?");
        if (nextShowing?.address) dynamic.push(`Prep for ${nextShowing.address as string}`);
        else if (topClients[0]) dynamic.push(`Any updates on ${(topClients[0].name as string).split(" ")[0]}?`);
        else dynamic.push("Any showings this week?");

        setChips(dynamic.slice(0, 4));
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
    async (question: string, mode: "chat" | "voice"): Promise<{ reply: string; action: ChatAction | null }> => {
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
      const data = (await res.json()) as { reply?: string; action?: ChatAction | null };
      return { reply: String(data.reply ?? ""), action: data.action ?? null };
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
        const { reply, action } = await callAssistant(q, "chat");
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: reply, id: crypto.randomUUID(), action },
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
        const { reply } = await callAssistant(text, "voice");
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
  // One accent throughout — deep green for every active state, terracotta only
  // for genuine errors.
  const waveColor = voiceState === "error" ? "var(--destructive)" : "var(--primary)";

  const stateLabel =
    voiceState === "idle" ? "Tap to speak"
    : voiceState === "listening" ? "Listening…"
    : voiceState === "thinking" ? "Thinking…"
    : voiceState === "speaking" ? "Speaking"
    : "Tap to try again";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[100] flex flex-col select-none overflow-hidden bg-background text-foreground" role="dialog" aria-modal="true" aria-label="Ask Aria">
      {/* ── Top bar ── */}
      <div
        className="relative z-10 flex w-full items-center justify-between px-5 shrink-0"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 14px)", paddingBottom: 14 }}
      >
        <Button
          variant="outline"
          size="icon"
          onClick={() => { stopAll(); router.back(); }}
          className="h-9 w-9 rounded-full"
          aria-label="Close"
        >
          <ArrowLeft size={16} />
        </Button>

        {/* Mode switcher pill */}
        <div className="flex gap-0.5 rounded-full border border-border bg-secondary p-0.5">
          {(["chat", "voice"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                if (m !== "voice") stopAll();
                setMode(m);
              }}
              className={cn(
                "rounded-full px-3.5 py-1.5 font-display text-caption font-semibold capitalize transition-colors duration-200",
                mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
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
                    className="relative mb-5"
                  >
                    {/* Soft breathing glow behind the mark */}
                    <motion.div
                      aria-hidden
                      className="absolute inset-0 -z-10 rounded-full bg-primary/15 blur-xl"
                      animate={
                        shouldReduceMotion
                          ? undefined
                          : { opacity: [0.5, 0.9, 0.5], scale: [0.9, 1.15, 0.9] }
                      }
                      transition={
                        shouldReduceMotion
                          ? undefined
                          : { duration: 3.6, repeat: Infinity, ease: "easeInOut" }
                      }
                    />
                    {/* The mark itself breathes — slow, calm, never distracting */}
                    <motion.div
                      animate={shouldReduceMotion ? undefined : { scale: [1, 1.05, 1] }}
                      transition={
                        shouldReduceMotion
                          ? undefined
                          : { duration: 3.6, repeat: Infinity, ease: "easeInOut" }
                      }
                    >
                      <AriaSpark size={44} />
                    </motion.div>
                  </motion.div>

                  <motion.h1
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                    className="font-heading text-[28px] leading-tight text-center mb-1 text-foreground"
                  >
                    {greeting}
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.15 }}
                    className="font-display text-body-lg text-center mb-8 text-muted-foreground"
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
                        className="w-full text-left rounded-2xl border border-border bg-card px-4 py-3 font-display text-body text-foreground active:opacity-70"
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
                        <div className="rounded-[18px] rounded-bl-[4px] border border-border bg-card px-4 py-3">
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
                                className="h-1.5 w-1.5 rounded-full bg-muted-foreground"
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
                <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2">
                  <input aria-label="Ask Aria"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void sendChat();
                      }
                    }}
                    placeholder="Ask Aria…"
                    data-focus-parent
            className="flex-1 min-w-0 bg-transparent font-display text-body-lg text-foreground outline-none placeholder:text-muted-foreground"
                    autoComplete="off"
                    autoCorrect="off"
                  />

                  {/* Mic button — switches to voice mode */}
                  {!input.trim() && micSupported && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={handleComposerMic}
                      className="h-9 w-9 rounded-full flex-shrink-0"
                      aria-label="Voice input"
                    >
                      <Mic size={16} />
                    </Button>
                  )}

                  {/* Send button */}
                  {input.trim() && (
                    <Button
                      type="button"
                      size="icon"
                      onClick={() => void sendChat()}
                      disabled={isLoading}
                      className="h-9 w-9 rounded-full flex-shrink-0"
                      aria-label="Send"
                    >
                      <Send size={15} />
                    </Button>
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
                      className="rounded-2xl border border-border bg-card px-4 py-3 text-center font-display text-body leading-relaxed text-foreground"
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
                  className="flex flex-col items-center gap-6 rounded-3xl active:opacity-80"
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
                    className={cn(
                      "font-display text-[12px] font-medium tracking-[0.10em] uppercase",
                      voiceState === "error" ? "text-destructive" : "text-muted-foreground",
                    )}
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
                    className="mx-5 mb-4 flex items-center gap-3 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3"
                  >
                    <AlertCircle size={14} className="shrink-0 text-destructive" />
                    <p className="flex-1 font-display text-body text-destructive">
                      {errorMsg}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Unsupported mic warning */}
              {!micSupported && (
                <div className="mx-5 mb-4 flex items-center gap-2 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3">
                  <MicOff size={14} className="shrink-0 text-destructive" />
                  <p className="font-display text-body text-destructive">
                    Voice requires Safari on iPhone
                  </p>
                </div>
              )}

              {/* Voice controls */}
              <div
                className="shrink-0 flex items-center justify-center gap-4 pb-4"
                style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
              >
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { stopAll(); setMode("chat"); }}
                  className="gap-2 rounded-full px-5 py-2.5 font-display text-body"
                >
                  <ArrowLeft size={14} />
                  Chat
                </Button>

                {(voiceState === "listening" || voiceState === "speaking") && (
                  <button
                    type="button"
                    onClick={stopAll}
                    className="flex items-center gap-2 rounded-full bg-destructive/10 px-5 py-2.5 font-display text-body font-medium text-destructive active:opacity-70"
                  >
                    Stop
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {/* ══ LIVE MODE ══════════════════════════════════════════════════════ */}
        </AnimatePresence>
      </div>
    </div>
  );
}

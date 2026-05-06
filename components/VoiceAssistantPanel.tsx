"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { usePageContext } from "@/hooks/usePageContext";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";

type OrbState = "idle" | "listening" | "thinking" | "speaking";

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

type Props = {
  open: boolean;
  onOrbStateChange: (state: OrbState) => void;
};

export function VoiceAssistantPanel({ open, onOrbStateChange }: Props) {
  const { contextHint, pageName } = usePageContext();
  const {
    transcript,
    interimTranscript,
    listening,
    supported,
    error: srError,
    start: startListening,
    stop: stopListening,
    reset: resetTranscript,
  } = useSpeechRecognition();

  const { speak, stop: stopSpeaking, speaking, muted, toggleMute } = useSpeechSynthesis();

  const [messages, setMessages] = useState<Message[]>([]);
  const [thinking, setThinking] = useState(false);
  const [inputText, setInputText] = useState("");
  const [, setOrbStateLocal] = useState<OrbState>("idle");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasFinalRef = useRef(false);
  const lastTranscriptRef = useRef("");

  // Sync orb state upward
  const setOrbState = useCallback(
    (s: OrbState) => {
      setOrbStateLocal(s);
      onOrbStateChange(s);
    },
    [onOrbStateChange],
  );

  // Derive orb state from speech hooks
  useEffect(() => {
    if (speaking) {
      setOrbState("speaking");
    } else if (thinking) {
      setOrbState("thinking");
    } else if (listening) {
      setOrbState("listening");
    } else {
      setOrbState("idle");
    }
  }, [listening, thinking, speaking, setOrbState]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open]);

  // When transcript finalises (listening stopped and we have text), send it
  useEffect(() => {
    if (!listening && transcript && transcript !== lastTranscriptRef.current) {
      lastTranscriptRef.current = transcript;
      hasFinalRef.current = true;
      sendMessage(transcript);
      resetTranscript();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening, transcript]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        text: trimmed,
      };
      setMessages((prev) => [...prev, userMsg]);
      setInputText("");
      setThinking(true);

      try {
        const res = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: trimmed,
            context: contextHint,
            history: messages.map((m) => ({ role: m.role, content: m.text })),
          }),
        });

        const data = (await res.json()) as { reply?: string; error?: string };
        const reply = data.reply ?? data.error ?? "Sorry, I couldn't get a response.";

        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          text: reply,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setThinking(false);

        // Speak the response
        speak(reply);
      } catch {
        setThinking(false);
        const errMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          text: "Sorry, something went wrong. Please try again.",
        };
        setMessages((prev) => [...prev, errMsg]);
      }
    },
    [messages, contextHint, speak],
  );

  const handleMicToggle = useCallback(() => {
    if (listening) {
      stopListening();
    } else {
      stopSpeaking();
      lastTranscriptRef.current = "";
      startListening();
    }
  }, [listening, startListening, stopListening, stopSpeaking]);

  const handleTextSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (inputText.trim()) {
        sendMessage(inputText);
      }
    },
    [inputText, sendMessage],
  );

  if (!open) return null;

  return (
    <div
      className={[
        "fixed bottom-[calc(4rem+4.5rem)] right-4 z-[90]",
        "flex w-[340px] max-w-[calc(100vw-2rem)] flex-col",
        "rounded-2xl border border-[#222222] bg-[#111111] shadow-2xl",
        "overflow-hidden",
      ].join(" ")}
      style={{ maxHeight: "60vh" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#222222] px-4 py-3">
        <div>
          <p className="text-[13px] font-semibold text-text-primary">Aria Voice</p>
          <p className="text-[11px] text-text-dim">{pageName}</p>
        </div>
        <button
          onClick={toggleMute}
          aria-label={muted ? "Unmute Aria" : "Mute Aria"}
          className="rounded-lg p-1.5 text-text-dim transition-colors hover:bg-[#222222] hover:text-text-primary"
        >
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ minHeight: 120 }}>
        {messages.length === 0 && !thinking && (
          <p className="text-center text-[12px] text-text-dim pt-4">
            {supported
              ? 'Tap the mic or type to talk with Aria'
              : 'Type below to talk with Aria'}
          </p>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={[
              "flex",
              msg.role === "user" ? "justify-end" : "justify-start",
            ].join(" ")}
          >
            <div
              className={[
                "max-w-[80%] rounded-2xl px-3 py-2 text-[13px] leading-snug",
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-[#1a1a1a] text-text-primary",
              ].join(" ")}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {/* Interim transcript bubble */}
        {(interimTranscript || (listening && !interimTranscript)) && (
          <div className="flex justify-end">
            <div className="max-w-[80%] rounded-2xl bg-blue-900/40 px-3 py-2 text-[13px] italic text-blue-300">
              {interimTranscript || "…"}
            </div>
          </div>
        )}

        {/* Thinking indicator */}
        {thinking && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-[#1a1a1a] px-4 py-2">
              <span className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-dim [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-dim [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-dim [animation-delay:300ms]" />
              </span>
            </div>
          </div>
        )}

        {/* Error notice */}
        {srError === "permission-denied" && (
          <p className="text-center text-[11px] text-red-400">
            Microphone access denied. Use the text input below.
          </p>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="border-t border-[#222222] px-3 py-2">
        <form onSubmit={handleTextSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a message…"
            disabled={thinking}
            className={[
              "flex-1 rounded-xl border border-[#333333] bg-[#0a0a0a]",
              "px-3 py-2 text-[13px] text-text-primary placeholder-text-dim",
              "outline-none focus:border-[#555555]",
              "disabled:opacity-50",
            ].join(" ")}
          />

          {supported && (
            <button
              type="button"
              onClick={handleMicToggle}
              disabled={thinking}
              aria-label={listening ? "Stop listening" : "Start voice input"}
              className={[
                "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition-colors",
                listening
                  ? "bg-blue-600 text-white"
                  : "bg-[#222222] text-text-dim hover:bg-[#333333] hover:text-text-primary",
                "disabled:opacity-50",
              ].join(" ")}
            >
              {listening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
          )}

          <button
            type="submit"
            disabled={!inputText.trim() || thinking}
            className={[
              "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl",
              "bg-blue-600 text-white transition-colors",
              "disabled:opacity-30",
              "hover:bg-blue-500",
            ].join(" ")}
            aria-label="Send message"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}

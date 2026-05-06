"use client";

import { Mic, MicOff, X } from "lucide-react";

type OrbState = "idle" | "listening" | "thinking" | "speaking";

type Props = {
  orbState: OrbState;
  open: boolean;
  muted: boolean;
  onToggleOpen: () => void;
};

export function VoiceOrb({ orbState, open, muted, onToggleOpen }: Props) {
  return (
    <button
      onClick={onToggleOpen}
      aria-label={open ? "Close Aria voice assistant" : "Open Aria voice assistant"}
      className={[
        "fixed bottom-24 right-4 z-[85]",
        "flex h-14 w-14 items-center justify-center rounded-full",
        "shadow-lg transition-all duration-300 select-none",
        // Base ring
        "ring-2",
        orbState === "idle" && !open
          ? "bg-[#111111] ring-[#333333] hover:ring-[#555555]"
          : orbState === "listening"
            ? "bg-[#0a1628] ring-blue-500 orb-pulse-blue"
            : orbState === "thinking"
              ? "bg-[#1a0a28] ring-purple-500 orb-pulse-purple"
              : orbState === "speaking"
                ? "bg-[#0a2018] ring-emerald-500 orb-pulse-green"
                : open
                  ? "bg-[#111111] ring-[#444444]"
                  : "bg-[#111111] ring-[#333333]",
      ].join(" ")}
    >
      {/* Glow layer */}
      {orbState !== "idle" && (
        <span
          className={[
            "absolute inset-0 rounded-full opacity-30 blur-sm",
            orbState === "listening"
              ? "bg-blue-500 orb-glow-blue"
              : orbState === "thinking"
                ? "bg-purple-500 orb-glow-purple"
                : "bg-emerald-500 orb-glow-green",
          ].join(" ")}
        />
      )}

      {/* Icon */}
      <span className="relative z-10">
        {open ? (
          <X
            size={20}
            className={
              orbState === "listening"
                ? "text-blue-400"
                : orbState === "thinking"
                  ? "text-purple-400"
                  : orbState === "speaking"
                    ? "text-emerald-400"
                    : "text-text-dim"
            }
          />
        ) : muted ? (
          <MicOff size={20} className="text-text-dim" />
        ) : (
          <Mic
            size={20}
            className={
              orbState === "listening"
                ? "text-blue-400"
                : orbState === "thinking"
                  ? "text-purple-400"
                  : orbState === "speaking"
                    ? "text-emerald-400"
                    : "text-text-dim"
            }
          />
        )}
      </span>

      {/* State label */}
      {orbState !== "idle" && (
        <span
          className={[
            "absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap",
            "rounded px-1.5 py-0.5 text-[10px] font-medium",
            orbState === "listening"
              ? "bg-blue-500/20 text-blue-300"
              : orbState === "thinking"
                ? "bg-purple-500/20 text-purple-300"
                : "bg-emerald-500/20 text-emerald-300",
          ].join(" ")}
        >
          {orbState === "listening"
            ? "Listening…"
            : orbState === "thinking"
              ? "Thinking…"
              : "Speaking…"}
        </span>
      )}
    </button>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type UseSpeechSynthesisReturn = {
  speak: (text: string) => void;
  stop: () => void;
  speaking: boolean;
  muted: boolean;
  toggleMute: () => void;
};

export function useSpeechSynthesis(): UseSpeechSynthesisReturn {
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);

  // Pick the best available English voice on mount
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    function pickVoice() {
      const voices = window.speechSynthesis.getVoices();
      // Prefer high-quality natural voices
      const preferred = voices.find(
        (v) =>
          v.lang.startsWith("en") &&
          (v.name.includes("Samantha") ||
            v.name.includes("Karen") ||
            v.name.includes("Google US English") ||
            v.name.includes("Microsoft Aria") ||
            v.name.includes("Zira")),
      );
      voiceRef.current = preferred ?? voices.find((v) => v.lang.startsWith("en")) ?? null;
    }

    pickVoice();
    // Chrome loads voices async
    window.speechSynthesis.onvoiceschanged = pickVoice;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const stop = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (typeof window === "undefined" || !window.speechSynthesis) return;
      if (muted) return;

      // Cancel any in-progress speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      if (voiceRef.current) utterance.voice = voiceRef.current;
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);

      window.speechSynthesis.speak(utterance);
    },
    [muted],
  );

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      if (!prev) {
        // Muting — stop current speech
        window.speechSynthesis?.cancel();
        setSpeaking(false);
      }
      return !prev;
    });
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  return { speak, stop, speaking, muted, toggleMute };
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Web Speech API types (not yet fully in TypeScript's DOM lib)
interface ISpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(i: number): { readonly transcript: string };
  [i: number]: { readonly transcript: string };
}

interface ISpeechRecognitionResultList {
  readonly length: number;
  item(index: number): ISpeechRecognitionResult;
  [index: number]: ISpeechRecognitionResult;
}

interface ISpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: ISpeechRecognitionResultList;
}

interface ISpeechRecognitionErrorEvent extends Event {
  readonly error: string;
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: ISpeechRecognitionEvent) => void) | null;
  onerror: ((event: ISpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type ISpeechRecognitionCtor = new () => ISpeechRecognition;

export type SpeechRecognitionError =
  | "not-supported"
  | "permission-denied"
  | "network"
  | "unknown";

export type UseSpeechRecognitionReturn = {
  transcript: string;
  interimTranscript: string;
  listening: boolean;
  supported: boolean;
  error: SpeechRecognitionError | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
};

const SILENCE_TIMEOUT_MS = 2500;

function getSpeechRecognitionCtor(): ISpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as ISpeechRecognitionCtor | null;
}

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<SpeechRecognitionError | null>(null);
  const [supported, setSupported] = useState(false);

  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppingRef = useRef(false);

  useEffect(() => {
    if (getSpeechRecognitionCtor()) {
      setSupported(true);
    } else {
      console.warn("[VoiceOrb] Web Speech API not supported in this browser.");
    }
  }, []);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    clearSilenceTimer();
    stoppingRef.current = true;
    recognitionRef.current?.stop();
  }, [clearSilenceTimer]);

  const start = useCallback(() => {
    const SR = getSpeechRecognitionCtor();
    if (!SR) return;

    stoppingRef.current = false;
    setError(null);
    setTranscript("");
    setInterimTranscript("");

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setListening(true);
      silenceTimerRef.current = setTimeout(() => {
        stop();
      }, SILENCE_TIMEOUT_MS);
    };

    recognition.onresult = (event: ISpeechRecognitionEvent) => {
      clearSilenceTimer();
      silenceTimerRef.current = setTimeout(() => {
        stop();
      }, SILENCE_TIMEOUT_MS);

      let final = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) {
          final += res[0].transcript;
        } else {
          interim += res[0].transcript;
        }
      }
      if (final) setTranscript((prev) => prev + final);
      setInterimTranscript(interim);
    };

    recognition.onerror = (event: ISpeechRecognitionErrorEvent) => {
      clearSilenceTimer();
      setListening(false);
      if (event.error === "not-allowed" || event.error === "permission-denied") {
        setError("permission-denied");
      } else if (event.error === "network") {
        setError("network");
      } else if (event.error !== "aborted" && event.error !== "no-speech") {
        setError("unknown");
      }
    };

    recognition.onend = () => {
      clearSilenceTimer();
      setListening(false);
      setInterimTranscript("");
    };

    try {
      recognition.start();
    } catch {
      setError("unknown");
      setListening(false);
    }
  }, [supported, stop, clearSilenceTimer]); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
    setError(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearSilenceTimer();
      stoppingRef.current = true;
      recognitionRef.current?.abort();
    };
  }, [clearSilenceTimer]);

  return {
    transcript,
    interimTranscript,
    listening,
    supported,
    error,
    start,
    stop,
    reset,
  };
}

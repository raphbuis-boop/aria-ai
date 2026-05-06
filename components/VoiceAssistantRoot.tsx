"use client";

import { useState, useCallback } from "react";
import { VoiceOrb } from "@/components/VoiceOrb";
import { VoiceAssistantPanel } from "@/components/VoiceAssistantPanel";

type OrbState = "idle" | "listening" | "thinking" | "speaking";

export function VoiceAssistantRoot() {
  const [open, setOpen] = useState(false);
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [muted] = useState(false);

  const handleToggle = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  const handleOrbStateChange = useCallback((state: OrbState) => {
    setOrbState(state);
  }, []);

  // We need to expose muted from the panel — pass it up via a callback
  // For now, muted state is owned by useSpeechSynthesis inside the panel.
  // The orb just shows current orbState.

  return (
    <>
      <VoiceOrb
        orbState={orbState}
        open={open}
        muted={muted}
        onToggleOpen={handleToggle}
      />
      <VoiceAssistantPanel
        open={open}
        onOrbStateChange={handleOrbStateChange}
      />
    </>
  );
}

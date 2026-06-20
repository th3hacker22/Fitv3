"use client";
import { useEffect, useState } from "react";
import { voiceCoach } from "@/services/voiceCoach";

/**
 * React hook for the Voice Coach.
 * Reads/writes the enabled state + selected voice to localStorage
 * so the user's preference persists across sessions.
 *
 * Initial state is read lazily from localStorage / the singleton (so the
 * very first paint already reflects the persisted preference); the only
 * work the effects do is propagate that choice to the underlying
 * voiceCoach singleton and poll for late-loading voices.
 */
function readStoredEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem("pulse_voice_coach_enabled") === "true";
  } catch {
    return false;
  }
}

function readStoredVoice(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem("pulse_voice_coach_voice");
  } catch {
    return null;
  }
}

function readInitialVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined") return [];
  return voiceCoach.getAvailableVoices();
}

export function useVoiceCoach() {
  const [enabled, setEnabled] = useState<boolean>(readStoredEnabled);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | null>(readStoredVoice);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(readInitialVoices);

  // Push the persisted preference into the singleton on mount. We only call
  // imperative methods here (no setState) — the lazy initializers above
  // already loaded the React state from the same source, so there's nothing
  // to sync back from the effect.
  useEffect(() => {
    voiceCoach.setEnabled(enabled);
    if (selectedVoiceURI) {
      voiceCoach.setSelectedVoice(selectedVoiceURI);
    }
    // Subscribe to the browser's voiceschanged event — on Chrome voices
    // load asynchronously and the first getAvailableVoices() call returns
    // an empty array.
    const handler = () => {
      const v = voiceCoach.getAvailableVoices();
      // setState in an async event handler (NOT in the effect body) is fine
      // and won't trigger cascading renders.
      setVoices((prev) => (prev.length === v.length ? prev : v));
    };
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.addEventListener("voiceschanged", handler);
    }
    // Also poll briefly — some engines never fire voiceschanged.
    const interval = setInterval(handler, 500);
    const stop = setTimeout(() => clearInterval(interval), 5000);
    return () => {
      clearInterval(interval);
      clearTimeout(stop);
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.removeEventListener("voiceschanged", handler);
      }
    };
  }, []);

  const toggle = (on: boolean) => {
    setEnabled(on);
    try {
      localStorage.setItem("pulse_voice_coach_enabled", String(on));
    } catch {
      /* localStorage may be unavailable (private mode) */
    }
    voiceCoach.setEnabled(on);
    if (on) {
      // Test announcement
      voiceCoach.speakText("Voice coach activated. Let's get to work!");
    }
  };

  const selectVoice = (voiceURI: string) => {
    setSelectedVoiceURI(voiceURI);
    try {
      localStorage.setItem("pulse_voice_coach_voice", voiceURI);
    } catch {
      /* ignore */
    }
    voiceCoach.setSelectedVoice(voiceURI);
  };

  return {
    enabled,
    toggle,
    voices,
    selectedVoiceURI,
    selectVoice,
    isSupported: typeof window !== "undefined" && "speechSynthesis" in window,
  };
}

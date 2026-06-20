/**
 * Voice Coach — Text-to-Speech via Web Speech API.
 *
 * Uses the browser's built-in SpeechSynthesis API (no backend needed).
 * Works offline, instant, zero latency.
 *
 * The coach announces key workout events:
 *  - Rest timer completion
 *  - New personal records
 *  - Set completion
 *  - Workout milestones (halfway, complete)
 *
 * Voice selection: prefers English voices, allows user override.
 * Rate: slightly faster than normal (1.1) for an energetic coach feel.
 */

type VoiceCoachPhrase =
  | "rest_complete"
  | "rest_15s_left"
  | "new_pr"
  | "set_complete"
  | "halfway"
  | "workout_complete"
  | "first_set_done"
  | "last_set";

const PHRASES: Record<VoiceCoachPhrase, string[]> = {
  rest_complete: [
    "Rest complete! Let's go!",
    "Time's up! Next set!",
    "Rest over, get after it!",
  ],
  rest_15s_left: [
    "15 seconds left!",
    "Fifteen seconds, get ready!",
  ],
  new_pr: [
    "New personal record! Amazing!",
    "PR alert! You crushed it!",
    "That's a new record! Incredible!",
  ],
  set_complete: [
    "Nice work! Set complete.",
    "Great set!",
    "Solid rep, keep going!",
  ],
  first_set_done: [
    "First set done, way to start!",
    "One down, great form!",
  ],
  last_set: [
    "Last set! Give it everything!",
    "Final set, leave it all here!",
  ],
  halfway: [
    "Halfway there! Keep pushing!",
    "You're at the halfway mark!",
  ],
  workout_complete: [
    "Workout complete! Amazing session!",
    "Great workout! You showed up!",
    "Session done! Be proud of that!",
  ],
};

class VoiceCoach {
  private enabled: boolean = false;
  private selectedVoiceURI: string | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private lastSpoken: number = 0;
  private readonly MIN_INTERVAL_MS = 2000; // prevent overlapping speech

  constructor() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      // Load voices (async on some browsers)
      this.loadVoices();
      window.speechSynthesis.onvoiceschanged = () => this.loadVoices();
    }
  }

  private loadVoices() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    this.voices = window.speechSynthesis.getVoices();
    // Auto-select a good English voice if none selected
    if (!this.selectedVoiceURI && this.voices.length > 0) {
      // Prefer Google US English, then any en-US, then any en
      const preferred =
        this.voices.find((v) => v.name.includes("Google US English")) ||
        this.voices.find((v) => v.lang === "en-US") ||
        this.voices.find((v) => v.lang.startsWith("en")) ||
        this.voices[0];
      this.selectedVoiceURI = preferred?.voiceURI || null;
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled && typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getAvailableVoices(): SpeechSynthesisVoice[] {
    return this.voices.filter((v) => v.lang.startsWith("en"));
  }

  setSelectedVoice(voiceURI: string) {
    this.selectedVoiceURI = voiceURI;
  }

  getSelectedVoice(): string | null {
    return this.selectedVoiceURI;
  }

  /**
   * Speak a phrase. Randomly picks from the available variations
   * to keep the coach feeling fresh.
   */
  speak(phrase: VoiceCoachPhrase): void {
    if (!this.enabled) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    // Throttle — don't speak if we just spoke < 2s ago
    const now = Date.now();
    if (now - this.lastSpoken < this.MIN_INTERVAL_MS) return;
    this.lastSpoken = now;

    const variations = PHRASES[phrase];
    const text = variations[Math.floor(Math.random() * variations.length)];

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1; // slightly faster = energetic
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Select voice
    if (this.selectedVoiceURI) {
      const voice = this.voices.find((v) => v.voiceURI === this.selectedVoiceURI);
      if (voice) utterance.voice = voice;
    }

    // Cancel any pending speech (don't queue — can cause long delays)
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  /** Speak arbitrary text (for dynamic phrases like PR details). */
  speakText(text: string): void {
    if (!this.enabled) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    if (this.selectedVoiceURI) {
      const voice = this.voices.find((v) => v.voiceURI === this.selectedVoiceURI);
      if (voice) utterance.voice = voice;
    }

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  /** Stop any current speech. */
  stop(): void {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }
}

// Singleton — one voice coach for the whole app
export const voiceCoach = new VoiceCoach();

export type { VoiceCoachPhrase };

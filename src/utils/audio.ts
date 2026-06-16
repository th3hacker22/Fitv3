import { useSettingsStore } from "@/store/useSettingsStore";

const audioCtx = typeof window !== "undefined" ? new (window.AudioContext || (window as any).webkitAudioContext)() : null;

function playTone(freq: number, type: OscillatorType, duration: number, vol: number = 0.1) {
  if (!audioCtx) return;
  const { soundEnabled } = useSettingsStore.getState();
  if (!soundEnabled) return;

  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);

  gainNode.gain.setValueAtTime(vol, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  oscillator.start();
  oscillator.stop(audioCtx.currentTime + duration);
}

export function playWorkoutStartSound() {
  if (!audioCtx) return;
  if (audioCtx.state === "suspended") audioCtx.resume();
  // Ascending tones
  playTone(330, "sine", 0.15, 0.1);
  setTimeout(() => playTone(440, "sine", 0.3, 0.1), 150);
}

export function playWorkoutStopSound() {
  if (!audioCtx) return;
  if (audioCtx.state === "suspended") audioCtx.resume();
  // Descending tones
  playTone(440, "sine", 0.15, 0.1);
  setTimeout(() => playTone(330, "sine", 0.3, 0.1), 150);
}

export function playTimerCompleteSound() {
  if (!audioCtx) return;
  if (audioCtx.state === "suspended") audioCtx.resume();
  // Double beep
  playTone(523.25, "sine", 0.15, 0.2);
  setTimeout(() => playTone(523.25, "sine", 0.4, 0.2), 200);
}

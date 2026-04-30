"use client";

export type TrainerSound = "move" | "capture" | "wrong" | "complete";

const moveSoundAsset = "/chess-piece-move.mp3";
const moveSoundStartTime = 1;
const moveSoundEndTime = 2;
const moveSoundVolume = 0.7;

export function playTrainerSound(kind: TrainerSound, enabled: boolean): void {
  if (!enabled || typeof window === "undefined") {
    return;
  }

  if (kind === "move" || kind === "capture") {
    playRecordedMoveSound();
    return;
  }

  const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextCtor) {
    return;
  }

  try {
    const context = new AudioContextCtor();
    const gain = context.createGain();
    gain.connect(context.destination);
    gain.gain.setValueAtTime(0.0001, context.currentTime);

    {
      const notes = kind === "wrong" ? [220, 174.61] : [523.25, 659.25, 783.99];

      notes.forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        oscillator.type = kind === "wrong" ? "square" : "triangle";
        oscillator.frequency.setValueAtTime(frequency, context.currentTime + index * 0.09);
        oscillator.connect(gain);
        oscillator.start(context.currentTime + index * 0.09);
        oscillator.stop(context.currentTime + index * 0.09 + 0.12);
      });

      gain.gain.exponentialRampToValueAtTime(kind === "wrong" ? 0.038 : 0.035, context.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + notes.length * 0.09 + 0.18);
    }

    window.setTimeout(() => {
      void context.close().catch(() => undefined);
    }, 260);
  } catch {
    // Ignore audio failures so board interaction stays smooth.
  }
}

function playRecordedMoveSound(): void {
  const audio = new Audio(moveSoundAsset);
  audio.preload = "auto";
  audio.volume = moveSoundVolume;

  const startPlayback = () => {
    try {
      audio.currentTime = moveSoundStartTime;
    } catch {
      // Ignore seek errors and still try to play.
    }

    void audio.play().catch(() => undefined);

    window.setTimeout(() => {
      audio.pause();
      try {
        audio.currentTime = 0;
      } catch {
        // Ignore reset issues.
      }
    }, Math.max(0, (moveSoundEndTime - moveSoundStartTime) * 1000));
  };

  if (audio.readyState >= 1) {
    startPlayback();
    return;
  }

  audio.addEventListener("loadedmetadata", startPlayback, { once: true });
  audio.load();
}

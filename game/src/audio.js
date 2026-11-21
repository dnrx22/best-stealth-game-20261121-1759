// Tiny synthesized sound effects, made with the Web Audio oscillator — no audio
// files, no network. The context is created on the first user gesture.
export function createAudio() {
  let context = null;
  let muted = false;

  function ensure() {
    if (!context) {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        context = new AudioContext();
      } catch {
        context = null;
      }
    }
    if (context && context.state === 'suspended') void context.resume();
    return context;
  }

  function tone(frequency, duration, type, volume, when = 0) {
    const ctx = ensure();
    if (!ctx || muted) return;
    const start = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  return {
    unlock() { ensure(); },
    toggleMute() { muted = !muted; return muted; },
    get muted() { return muted; },
    ember() {
      tone(880, 0.12, 'sine', 0.16);
      tone(1318, 0.18, 'sine', 0.14, 0.07);
    },
    spotted() {
      tone(220, 0.16, 'square', 0.1);
      tone(311, 0.2, 'square', 0.1, 0.12);
    },
    caught() {
      tone(196, 0.5, 'sawtooth', 0.14);
      tone(131, 0.6, 'sawtooth', 0.12, 0.15);
    },
    level() {
      tone(523, 0.14, 'sine', 0.15);
      tone(659, 0.14, 'sine', 0.15, 0.1);
      tone(784, 0.24, 'sine', 0.15, 0.2);
    },
    win() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, 'sine', 0.15, i * 0.12));
    },
  };
}

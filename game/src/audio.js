// All sound is synthesized with WebAudio: short oscillator blips and filtered noise,
// no audio files, no network. The context is created only after the first user
// gesture (browsers block audio before one); before that every call is a no-op, so
// the deterministic screenshot scenes stay silent and side-effect free.

export function createAudio() {
  let context = null;
  let master = null;

  /** Call once from the first user gesture. Safe to call again. */
  function unlock() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.35;
      master.connect(context.destination);
    } catch {
      context = null;
    }
  }

  function tone(freq, duration, type, volume, slideTo, delay) {
    if (!context) return;
    const start = context.currentTime + (delay || 0);
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  function noise(duration, volume, cutoff, delay) {
    if (!context) return;
    const start = context.currentTime + (delay || 0);
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(start);
  }

  return {
    unlock,
    shoot() { tone(880, 0.07, 'square', 0.10, 320); },
    hit() { tone(220, 0.05, 'triangle', 0.12, 140); },
    explode() { noise(0.35, 0.30, 900); tone(120, 0.3, 'sine', 0.25, 40); },
    split() { tone(520, 0.12, 'sawtooth', 0.10, 180); },
    pickup() { tone(1320, 0.09, 'sine', 0.12, 1760); },
    hurt() { tone(160, 0.18, 'sawtooth', 0.20, 70); },
    dash() { noise(0.14, 0.12, 2400); },
    upgrade() {
      tone(523, 0.12, 'triangle', 0.16, 0, 0);
      tone(659, 0.12, 'triangle', 0.16, 0, 0.09);
      tone(784, 0.2, 'triangle', 0.18, 0, 0.18);
    },
    horn() {
      tone(196, 0.7, 'sawtooth', 0.14, 196, 0);
      tone(294, 0.7, 'sawtooth', 0.10, 294, 0.05);
      tone(392, 0.7, 'sawtooth', 0.08, 392, 0.1);
    },
    win() {
      const notes = [523, 659, 784, 1047];
      notes.forEach((freq, i) => tone(freq, 0.25, 'triangle', 0.18, 0, i * 0.13));
    },
    lose() {
      const notes = [392, 330, 262, 196];
      notes.forEach((freq, i) => tone(freq, 0.3, 'sawtooth', 0.14, freq * 0.8, i * 0.16));
    },
  };
}

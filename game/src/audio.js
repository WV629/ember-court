// Sound, synthesized with the Web Audio API: no audio files, no network.
// A tiny blip for a selection, a chord for a play, a low thud for damage.

let context = null;

function audio() {
  if (!context) {
    try {
      context = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return null;
    }
  }
  if (context.state === 'suspended') context.resume().catch(() => {});
  return context;
}

function tone(freq, seconds, type = 'sine', gain = 0.08, when = 0) {
  const ctx = audio();
  if (!ctx) return;
  const start = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  amp.gain.setValueAtTime(gain, start);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
  osc.connect(amp).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + seconds);
}

/** Play a named effect: select, play, end, win, lose. */
export function sfx(name) {
  if (name === 'select') tone(660, 0.07, 'triangle', 0.05);
  if (name === 'play') { tone(392, 0.1, 'triangle', 0.07); tone(523, 0.12, 'triangle', 0.07, 0.07); }
  if (name === 'end') tone(220, 0.15, 'sine', 0.06);
  if (name === 'win') { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'triangle', 0.08, i * 0.12)); }
  if (name === 'lose') { [330, 262, 196].forEach((f, i) => tone(f, 0.3, 'sine', 0.07, i * 0.15)); }
}

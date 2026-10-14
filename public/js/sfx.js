// Procedural 8-bit sound effects + a short chiptune loop, all synthesized with WebAudio (no assets).
let ctx = null, master = null, muted = false, bgmOn = true, bgmTimer = null, bgmGain = null;

function ac() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    bgmGain = ctx.createGain(); bgmGain.gain.value = 0.22; bgmGain.connect(master);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
export function initAudio() { try { ac(); } catch (e) { /* no audio */ } }
export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.5; }
export function isMuted() { return muted; }

let noiseBuf = null;
function noise() {
  const c = ac();
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = c.createBufferSource(); s.buffer = noiseBuf; return s;
}

function env(g, t, a, d, peak = 1) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

function tone(type, f0, f1, dur, vol = 0.3, delay = 0) {
  const c = ac(); const t = c.currentTime + delay;
  const o = c.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = c.createGain(); env(g, t, 0.005, dur, vol);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
}
function burst(dur, vol = 0.3, delay = 0, lp = 8000, hp = 100) {
  const c = ac(); const t = c.currentTime + delay;
  const n = noise();
  const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(lp, t); f.frequency.exponentialRampToValueAtTime(Math.max(80, lp * 0.15), t + dur);
  const h = c.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = hp;
  const g = c.createGain(); env(g, t, 0.003, dur, vol);
  n.connect(f); f.connect(h); h.connect(g); g.connect(master); n.start(t); n.stop(t + dur + 0.05);
}

const SFX = {
  hit1: () => { tone('square', 420, 120, 0.08, 0.25); burst(0.06, 0.25, 0, 5000); },
  hit2: () => { tone('square', 300, 60, 0.14, 0.35); burst(0.12, 0.35, 0, 3500); tone('sine', 120, 40, 0.16, 0.4); },
  hit3: () => { tone('sawtooth', 220, 30, 0.28, 0.45); burst(0.25, 0.5, 0, 2500); tone('sine', 90, 25, 0.35, 0.6); },
  crit: () => { tone('square', 900, 1400, 0.06, 0.2); tone('square', 600, 140, 0.12, 0.25, 0.03); burst(0.08, 0.3, 0, 6000); },
  slam: () => { burst(0.5, 0.7, 0, 1800, 40); tone('sine', 70, 18, 0.6, 0.9); tone('square', 160, 30, 0.25, 0.3); burst(0.3, 0.3, 0.05, 900, 30); },
  meteor: () => { burst(0.9, 0.8, 0, 1400, 30); tone('sine', 55, 14, 0.9, 1); tone('sawtooth', 200, 20, 0.5, 0.35); },
  swing: () => burst(0.12, 0.12, 0, 2600, 400),
  swingHeavy: () => { burst(0.22, 0.18, 0, 1500, 150); tone('sine', 140, 60, 0.2, 0.08); },
  thrust: () => burst(0.07, 0.12, 0, 7000, 1500),
  shot: () => { burst(0.14, 0.4, 0, 3000, 200); tone('square', 180, 50, 0.1, 0.25); },
  shotBig: () => { burst(0.3, 0.55, 0, 2400, 100); tone('sawtooth', 120, 30, 0.25, 0.35); },
  throw: () => { tone('square', 500, 900, 0.1, 0.12); burst(0.1, 0.1, 0, 4000, 800); },
  saw: () => { tone('sawtooth', 800, 700, 0.05, 0.1); },
  jump: () => tone('square', 220, 560, 0.12, 0.18),
  land: () => burst(0.06, 0.15, 0, 1200),
  dash: () => { burst(0.18, 0.3, 0, 5000, 600); tone('square', 900, 300, 0.15, 0.1); },
  hurt: () => { tone('square', 300, 90, 0.18, 0.3); tone('sawtooth', 180, 50, 0.2, 0.2); },
  ko: () => { tone('square', 700, 60, 0.3, 0.3); tone('square', 350, 30, 0.35, 0.25, 0.04); burst(0.25, 0.3, 0, 4000); },
  splat: () => { burst(0.18, 0.3, 0, 2000, 60); tone('square', 200, 40, 0.15, 0.2); },
  bossko: () => { for (let i = 0; i < 6; i++) { tone('square', 500 - i * 60, 40, 0.3, 0.25, i * 0.12); burst(0.3, 0.4, i * 0.12, 2500); } tone('sine', 60, 15, 1.4, 0.9, 0.5); },
  bounce: () => { tone('sine', 150, 50, 0.15, 0.4); burst(0.1, 0.3, 0, 1500); },
  wall: () => { tone('square', 200, 60, 0.12, 0.35); burst(0.15, 0.35, 0, 2000); tone('sine', 90, 30, 0.2, 0.4); },
  buried: () => { burst(0.3, 0.45, 0, 900, 40); tone('sine', 80, 30, 0.3, 0.5); tone('square', 260, 90, 0.2, 0.2, 0.05); },
  stagger: () => { tone('sawtooth', 300, 80, 0.3, 0.3); tone('square', 150, 60, 0.3, 0.3, 0.05); },
  special: () => { for (let i = 0; i < 4; i++) tone('square', 300 + i * 150, 300 + i * 150, 0.08, 0.2, i * 0.07); burst(0.4, 0.2, 0.3, 3000, 200); },
  warn: () => { tone('square', 880, 880, 0.08, 0.15); tone('square', 880, 880, 0.08, 0.15, 0.15); },
  catch: () => tone('square', 600, 1200, 0.08, 0.15),
  swap: () => { tone('square', 500, 500, 0.05, 0.15); tone('square', 750, 750, 0.06, 0.15, 0.06); },
  pickup: () => { tone('square', 660, 660, 0.06, 0.2); tone('square', 880, 880, 0.06, 0.2, 0.07); tone('square', 1320, 1320, 0.1, 0.2, 0.14); },
  wave: () => { tone('square', 440, 440, 0.1, 0.2); tone('square', 660, 660, 0.12, 0.2, 0.12); },
  go: () => { tone('square', 523, 523, 0.08, 0.2); tone('square', 784, 784, 0.08, 0.2, 0.09); tone('square', 1046, 1046, 0.14, 0.2, 0.18); },
  clear: () => { const n = [523, 659, 784, 1046, 784, 1046, 1318]; n.forEach((f, i) => tone('square', f, f, 0.14, 0.22, i * 0.12)); },
  gameover: () => { const n = [392, 370, 349, 330, 311, 294]; n.forEach((f, i) => tone('square', f, f * 0.98, 0.25, 0.22, i * 0.2)); },
  ewindup: () => tone('square', 180, 240, 0.12, 0.12),
  ewindupBig: () => { tone('sawtooth', 100, 200, 0.4, 0.25); burst(0.3, 0.15, 0, 1200, 100); },
  blink: () => burst(0.1, 0.2, 0, 6000, 1500),
  stomp: () => { burst(0.2, 0.35, 0, 1500, 40); tone('sine', 90, 30, 0.2, 0.4); },
  combo: () => { tone('square', 784, 784, 0.06, 0.18); tone('square', 988, 988, 0.06, 0.18, 0.06); tone('square', 1175, 1175, 0.1, 0.18, 0.12); },
  ui: () => tone('square', 800, 800, 0.04, 0.12),
  respawn: () => { for (let i = 0; i < 3; i++) tone('triangle', 400 + i * 200, 400 + i * 200, 0.1, 0.2, i * 0.1); },
};

export function play(name) {
  if (muted || !SFX[name]) return;
  try { ac(); SFX[name](); } catch (e) { /* ignore */ }
}

// ---------------------------------------------------------------- BGM: a looping 8-bit groove
const BPM = 150;
const LEAD = [ // (midi, beats) — a bouncy fast-food jingle
  [67, .5], [67, .5], [74, .5], [72, .5], [71, 1], [67, .5], [69, .5],
  [71, .5], [72, .5], [74, .5], [76, .5], [74, 1], [0, .5], [72, .5],
  [71, .5], [69, .5], [67, .5], [69, .5], [71, 1], [67, .5], [64, .5],
  [65, .5], [67, .5], [69, .5], [71, .5], [67, 1], [0, 1],
];
const BASS = [[43, .5], [43, .5], [50, .5], [43, .5], [48, .5], [48, .5], [55, .5], [48, .5], [41, .5], [41, .5], [48, .5], [41, .5], [43, .5], [43, .5], [38, .5], [43, .5]];
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

function scheduleLoop(startAt) {
  const c = ac(); const beat = 60 / BPM;
  let t = startAt;
  for (const [m, b] of LEAD) {
    if (m) {
      const o = c.createOscillator(); o.type = 'square'; o.frequency.value = mtof(m);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + b * beat * 0.9);
      o.connect(g); g.connect(bgmGain); o.start(t); o.stop(t + b * beat);
    }
    t += b * beat;
  }
  const loopLen = t - startAt;
  let tb = startAt;
  while (tb < startAt + loopLen - 0.001) {
    for (const [m, b] of BASS) {
      const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = mtof(m);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, tb); g.gain.exponentialRampToValueAtTime(0.9, tb + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, tb + b * beat * 0.8);
      o.connect(g); g.connect(bgmGain); o.start(tb); o.stop(tb + b * beat);
      // hat
      const n = noise(); const hg = c.createGain(); hg.gain.setValueAtTime(0.0001, tb); hg.gain.exponentialRampToValueAtTime(0.12, tb + 0.004); hg.gain.exponentialRampToValueAtTime(0.0001, tb + 0.05);
      const hf = c.createBiquadFilter(); hf.type = 'highpass'; hf.frequency.value = 6000;
      n.connect(hf); hf.connect(hg); hg.connect(bgmGain); n.start(tb); n.stop(tb + 0.06);
      tb += b * beat;
    }
  }
  return loopLen;
}

let nextLoopAt = 0;
export function startBgm() {
  if (!bgmOn) return;
  try { ac(); } catch (e) { return; }
  if (bgmTimer) return;
  nextLoopAt = ctx.currentTime + 0.1;
  const tickBgm = () => {
    if (!bgmOn) return;
    while (nextLoopAt < ctx.currentTime + 1.5) nextLoopAt += scheduleLoop(nextLoopAt);
  };
  tickBgm();
  bgmTimer = setInterval(tickBgm, 500);
}
export function stopBgm() { bgmOn = false; if (bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; } if (bgmGain) bgmGain.gain.value = 0; }
export function toggleBgm() { bgmOn = !bgmOn; if (bgmOn) { if (bgmGain) bgmGain.gain.value = 0.22; bgmTimer = null; startBgm(); } else stopBgm(); return bgmOn; }
export function bgmEnabled() { return bgmOn; }

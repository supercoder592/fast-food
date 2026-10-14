// Headless smoke test: drives a bot through the stage and asserts the combat systems fire.
import { createSim, addPlayer, startGame, step, snapshot } from '../public/sim/sim.js';
import { IN, PHASE } from '../public/sim/constants.js';
import { WEAPONS } from '../public/sim/weapons.js';

function run(weaponIdx, ticks = 60 * 240) {
  const sim = createSim(42);
  const p = addPlayer(sim, { name: 'BOT', weapon: weaponIdx });
  startGame(sim);
  const seen = {};
  let maxCombo = 0, kills = 0, maxWave = 0, bytes = 0, snaps = 0;
  for (let t = 0; t < ticks; t++) {
    const held = IN.R | ((t % 300) === 0 ? IN.JUMP : 0);
    let pressed = (t % 300 === 0 ? IN.JUMP : 0) | (t % 200 === 7 ? IN.DASH : 0) | (t % 500 === 3 ? IN.SPEC : 0);
    // chase nearest enemy
    let inp = held;
    const e = sim.enemies.find(e => e.state !== 'dying' && e.state !== 'gone' && e.state !== 'spawn');
    if (e) {
      inp = 0;
      if (e.x > p.x + 10) inp |= IN.R; else if (e.x < p.x - 10) inp |= IN.L;
      if (e.y > p.y + 3) inp |= IN.D; else if (e.y < p.y - 3) inp |= IN.U;
      if (Math.abs(e.x - p.x) < 40) { inp |= IN.ATK; if (t % 10 === 0) pressed |= IN.ATK; }
    }
    const ev = step(sim, { [p.id]: { held: inp, pressed } });
    for (const x of ev) { seen[x.e] = (seen[x.e] || 0) + 1; if (x.e === 'ko') kills++; }
    maxCombo = Math.max(maxCombo, p.hits);
    maxWave = Math.max(maxWave, sim.wave);
    if (t % 3 === 0) { bytes += JSON.stringify(snapshot(sim)).length; snaps++; }
    if (p.hp < p.maxHp * 0.4) p.hp = p.maxHp; // bot cheats so it reaches later waves
    // sanity
    for (const e of sim.enemies) if (!Number.isFinite(e.x) || !Number.isFinite(e.z)) throw new Error('NaN enemy ' + JSON.stringify(e));
    if (!Number.isFinite(p.x) || !Number.isFinite(p.z)) throw new Error('NaN player');
    if (sim.phase === PHASE.CLEAR) break;
  }
  return { weapon: WEAPONS[weaponIdx].id, seen, maxCombo, kills, maxWave, phase: sim.phase, score: sim.score, avgSnapBytes: Math.round(bytes / snaps) };
}

let ok = true;
for (let w = 0; w < WEAPONS.length; w++) {
  const r = run(w);
  const need = ['hit', 'swing', 'ko', 'wave', 'launch'];
  const missing = need.filter(k => !r.seen[k]);
  console.log(JSON.stringify({ weapon: r.weapon, kills: r.kills, maxCombo: r.maxCombo, maxWave: r.maxWave, phase: r.phase, score: r.score, snapBytes: r.avgSnapBytes, events: r.seen }));
  if (missing.length) { ok = false; console.log('  MISSING events:', missing); }
}
console.log(ok ? 'SIM TEST OK' : 'SIM TEST FAILED');
process.exit(ok ? 0 : 1);

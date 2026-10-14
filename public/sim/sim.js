// Pure deterministic game simulation. No DOM, no rendering. Runs in the browser (offline mode)
// and in Node (authoritative server for online co-op).
import { W, FLOOR_TOP, FLOOR_BOT, GRAVITY, STAGE_LEN, IN, MAX_PLAYERS, PLAYER_HP, START_LIVES, METER_MAX, PHASE } from './constants.js';
import { WEAPONS, DASH, SPECIAL, JUMP_VZ } from './weapons.js';
import { ENEMIES, STAGE } from './enemies.js';
import { makeRng } from './rng.js';

const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
const sign = (v) => v < 0 ? -1 : 1;

export function createSim(seed = 1) {
  return {
    seed, tick: 0, phase: PHASE.LOBBY, phaseT: 0, nextId: 1,
    players: [], enemies: [], projs: [], pickups: [],
    camX: 0, camLock: -1, wave: -1, waveActive: false, loop: 0, score: 0,
    events: [], slow: 0,
    rng: makeRng(seed),
  };
}

// ---------------------------------------------------------------- players
export function addPlayer(sim, { name = 'P', slot = -1, weapon = 0 } = {}) {
  if (sim.players.length >= MAX_PLAYERS) return null;
  if (slot < 0) { slot = 0; while (sim.players.some(p => p.slot === slot)) slot++; }
  const p = {
    id: sim.nextId++, kind: 'player', name: String(name).slice(0, 10), slot,
    x: sim.camX + 50 + slot * 22, y: FLOOR_TOP + 20 + slot * 12, z: 120, vx: 0, vy: 0, vz: 0, dir: 1,
    hp: PLAYER_HP, maxHp: PLAYER_HP, lives: START_LIVES, score: 0,
    state: 'spawn', st: 0, weapon: clamp(weapon | 0, 0, WEAPONS.length - 1), mv: -1, alt: false,
    atkHit: {}, buf: 0, hitstop: 0, flash: 0, inv: 90, meter: 0, dashCd: 0,
    hits: 0, comboT: 0, hurtDur: 0, bounced: false, weight: 1, w: 12, h: 26,
    held: 0, pressed: 0, lastInput: 0, deadT: 0,
  };
  sim.players.push(p);
  sim.events.push({ e: 'join', id: p.id, x: p.x, y: p.y });
  return p;
}

export function removePlayer(sim, id) {
  const i = sim.players.findIndex(p => p.id === id);
  if (i >= 0) sim.players.splice(i, 1);
}

export function startGame(sim) {
  sim.phase = PHASE.PLAY; sim.phaseT = 0; sim.loop = 0; sim.score = 0;
  resetStage(sim);
  for (const p of sim.players) { p.lives = START_LIVES; p.score = 0; p.hp = p.maxHp; p.meter = 0; }
  sim.events.push({ e: 'start' });
}

function resetStage(sim) {
  sim.enemies = []; sim.projs = []; sim.pickups = [];
  sim.camX = 0; sim.camLock = -1; sim.wave = -1; sim.waveActive = false;
  sim.players.forEach((p, i) => {
    p.x = 40 + i * 22; p.y = FLOOR_TOP + 24 + i * 10; p.z = 100; p.vx = p.vy = p.vz = 0; p.dir = 1;
    p.state = 'spawn'; p.st = 0; p.inv = 90; p.hitstop = 0; p.hits = 0;
    if (p.hp <= 0) { p.hp = p.maxHp; }
  });
}

// ---------------------------------------------------------------- main step
// inputs: { [playerId]: { held, pressed } }
export function step(sim, inputs = {}) {
  sim.events = [];
  sim.tick++;
  sim.phaseT++;
  const ev = sim.events;

  for (const p of sim.players) {
    const inp = inputs[p.id];
    if (inp) { p.held = inp.held | 0; p.pressed = inp.pressed | 0; }
    else { p.pressed = 0; }
  }

  if (sim.phase === PHASE.OVER) {
    if (sim.phaseT > 90 && sim.players.some(p => p.pressed & (IN.ATK | IN.JUMP))) {
      startGame(sim);
    }
    return ev;
  }
  if (sim.phase === PHASE.CLEAR) {
    if (sim.phaseT > 320) {
      sim.loop++; sim.phase = PHASE.PLAY; sim.phaseT = 0; resetStage(sim); ev.push({ e: 'stage', loop: sim.loop });
    }
  }

  for (const p of sim.players) stepPlayer(sim, p);
  for (const e of sim.enemies) stepEnemy(sim, e);
  for (const pr of sim.projs) stepProj(sim, pr);

  for (const p of sim.players) physics(sim, p);
  for (const e of sim.enemies) physics(sim, e);

  resolveHits(sim);
  separateEnemies(sim);
  stepPickups(sim);

  // cleanup
  sim.enemies = sim.enemies.filter(e => e.state !== 'gone');
  sim.projs = sim.projs.filter(pr => pr.life > 0 && !pr.dead);
  sim.pickups = sim.pickups.filter(k => !k.dead);

  if (sim.phase === PHASE.PLAY) stepWaves(sim);
  stepCamera(sim);

  if (sim.phase === PHASE.PLAY) {
    const alive = sim.players.some(p => p.state !== 'dead' || p.lives > 0);
    if (sim.players.length && !alive) { sim.phase = PHASE.OVER; sim.phaseT = 0; ev.push({ e: 'gameover' }); }
  }
  for (const p of sim.players) p.pressed = 0;
  return ev;
}

// ---------------------------------------------------------------- player logic
function moveDef(p) {
  const w = WEAPONS[p.weapon];
  if (p.state === 'airatk') return w.air;
  if (p.state !== 'attack') return null;
  const m = w.combo[p.mv];
  return (p.alt && m.alt) ? m.alt : m;
}

function beginMove(sim, p, mv) {
  const w = WEAPONS[p.weapon];
  const m = w.combo[mv];
  p.alt = false;
  p.state = 'attack'; p.mv = mv; p.st = 0; p.atkHit = {}; p.buf = 0;
  if (m.fwd) p.vx = m.fwd * p.dir;
  p.vy = 0;
  if (m.hop) p.vz = m.hop;
  sim.events.push({ e: 'swing', id: p.id, x: p.x, y: p.y, z: p.z, dir: p.dir, w: w.id, pose: m.pose, pow: (m.hits && m.hits[0] && m.hits[0].pow) || 1 });
}

function beginAir(sim, p) {
  const w = WEAPONS[p.weapon];
  p.state = 'airatk'; p.mv = -1; p.st = 0; p.atkHit = {}; p.buf = 0; p.alt = false;
  if (w.air.plunge) { p.vz = w.air.plunge; p.vx = p.dir * 1.5; }
  sim.events.push({ e: 'swing', id: p.id, x: p.x, y: p.y, z: p.z, dir: p.dir, w: w.id, pose: w.air.pose, pow: 1 });
}

function stepPlayer(sim, p) {
  const held = p.held, pressed = p.pressed;
  if (p.flash > 0) p.flash--;
  if (p.inv > 0) p.inv--;
  if (p.dashCd > 0) p.dashCd--;
  if (p.buf > 0) p.buf--;
  if (p.comboT > 0) { p.comboT--; if (p.comboT === 0) p.hits = 0; }
  if (p.hitstop > 0) { p.hitstop--; return; }
  p.st++;
  const w = WEAPONS[p.weapon];
  const air = p.z > 0;
  if (pressed & IN.ATK) p.buf = 8;

  switch (p.state) {
    case 'dead': {
      p.deadT++;
      if (p.deadT > 100 && p.lives > 0) {
        p.lives--; p.hp = p.maxHp; p.state = 'spawn'; p.st = 0; p.inv = 120;
        p.x = clamp(p.x, sim.camX + 30, sim.camX + W - 30); p.z = 130; p.vz = 0; p.vx = 0; p.vy = 0; p.meter = 0;
        sim.events.push({ e: 'respawn', id: p.id, x: p.x, y: p.y });
      }
      return;
    }
    case 'spawn': {
      if (p.z <= 0 && p.st > 2) { p.state = 'idle'; p.st = 0; }
      return;
    }
    case 'hurt': {
      p.vx *= 0.86;
      if (p.st >= p.hurtDur) { p.state = 'idle'; p.st = 0; p.inv = Math.max(p.inv, 36); }
      return;
    }
    case 'launched': return; // physics
    case 'down': {
      if (p.st >= 34) { p.state = 'getup'; p.st = 0; p.inv = 50; }
      return;
    }
    case 'getup': { if (p.st >= 16) { p.state = 'idle'; p.st = 0; } return; }
    case 'special': {
      p.vx *= 0.8;
      if (p.st === SPECIAL.spawnAt) {
        const mx = clamp(p.x + p.dir * SPECIAL.dist, sim.camX + 20, sim.camX + W - 20);
        sim.projs.push({ id: sim.nextId++, kind: 'proj', type: 'meteor', team: 'p', owner: p.id, x: mx, y: p.y, z: SPECIAL.startZ,
          vx: 0, vy: 0, vz: -1, life: 400, t: 0, dir: p.dir, dmg: 0, hitT: {} });
        sim.events.push({ e: 'meteor_warn', x: mx, y: p.y });
      }
      if (p.st >= SPECIAL.dur) { p.state = 'idle'; p.st = 0; }
      return;
    }
    case 'dash': {
      if (p.st === 1) sim.events.push({ e: 'dash', id: p.id, x: p.x, y: p.y, z: p.z, dir: p.dir });
      p.vx = p.dir * DASH.speed * (1 - p.st / (DASH.dur * 1.6));
      if (p.z > 0) { p.vz = 0; p.noGrav = true; } else p.noGrav = false;
      if (p.st >= DASH.dur) { p.state = air ? 'jump' : 'idle'; p.st = 0; p.noGrav = false; p.dashCd = DASH.cd; p.vx *= 0.5; }
      // allow attack cancel out of dash after 6 ticks
      if (p.st > 6 && (pressed & IN.ATK)) { p.noGrav = false; p.dashCd = DASH.cd; if (air) beginAir(sim, p); else beginMove(sim, p, 0); }
      return;
    }
    case 'attack': {
      const m = moveDef(p);
      p.vx *= 0.84; p.vy *= 0.8;
      if (m.proj && p.st === m.proj.at) fireProj(sim, p, m.proj);
      if (m.slam && p.st === m.slam.at) doSlam(sim, p, m.slam.self ? p.x : p.x + p.dir * 18, p.y, m.slam, p.atkHit);
      if (p.st >= m.cancel && p.buf > 0 && p.mv + 1 < w.combo.length) { beginMove(sim, p, p.mv + 1); return; }
      if (p.st >= m.cancel && (pressed & IN.DASH) && p.dashCd === 0) { startDash(p); return; }
      if (p.st >= m.dur) { p.state = 'idle'; p.st = 0; }
      return;
    }
    case 'airatk': {
      const m = w.air;
      if (m.proj && p.st === m.proj.at) fireProj(sim, p, m.proj);
      if (p.z <= 0) {
        if (m.landSlam) doSlam(sim, p, p.x, p.y, m.landSlam, p.atkHit);
        p.state = 'recover'; p.st = 0; p.vx = 0;
        return;
      }
      if (!m.plunge && p.st >= m.dur) { p.state = 'jump'; p.st = 0; }
      return;
    }
    case 'recover': { if (p.st >= 10) { p.state = 'idle'; p.st = 0; } return; }
    default: break; // idle / walk / jump
  }

  // free movement (idle, walk, jump)
  let mx = 0, my = 0;
  if (held & IN.L) mx -= 1; if (held & IN.R) mx += 1;
  if (held & IN.U) my -= 1; if (held & IN.D) my += 1;
  const spd = 1.45 * w.speed;
  if (!air) {
    p.vx = mx * spd; p.vy = my * spd * 0.72;
    if (mx) p.dir = mx;
    p.state = (mx || my) ? 'walk' : 'idle';
    if (p.state === 'idle' && p.st > 1000) p.st = 0;
  } else {
    p.state = 'jump';
    p.vx = clamp(p.vx + mx * 0.25, -spd, spd);
    if (mx) p.dir = mx;
  }

  if (!air && (pressed & IN.SPEC) && p.meter >= METER_MAX) {
    p.meter = 0; p.state = 'special'; p.st = 0; p.inv = SPECIAL.dur + 10; p.vx = 0; p.vy = 0;
    sim.events.push({ e: 'special', id: p.id, x: p.x, y: p.y, dir: p.dir });
    return;
  }
  if ((pressed & IN.DASH) && p.dashCd === 0) { startDash(p); return; }
  if (!air && (pressed & IN.JUMP)) {
    p.vz = JUMP_VZ; p.z = 0.01; p.state = 'jump'; p.st = 0;
    sim.events.push({ e: 'jump', id: p.id, x: p.x, y: p.y });
    return;
  }
  if (p.buf > 0) {
    p.buf = 0;
    if (air) beginAir(sim, p); else beginMove(sim, p, 0);
  }
}

function startDash(p) { p.state = 'dash'; p.st = 0; p.atkHit = {}; p.inv = Math.max(p.inv, DASH.inv); p.vy = 0; }

function fireProj(sim, p, def) {
  const n = def.n || 1;
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : (i / (n - 1) - 0.5) * 2; // -1..1
    const ang = t * (def.spread || 0);
    const jitter = sim.rng.range(-0.05, 0.05);
    const spd = def.speed * sim.rng.range(0.92, 1.08);
    const pr = {
      id: sim.nextId++, kind: 'proj', type: def.type, team: 'p', owner: p.id,
      x: p.x + p.dir * 10, y: p.y, z: def.roll ? 0 : p.z + 12,
      vx: p.dir * spd * Math.cos(ang),
      vy: Math.sin(ang) * spd * 0.45 + jitter,
      vz: (def.vz || 0) + (def.type === 'friesdart' ? Math.sin(ang * 1.3) * spd * 0.2 : 0),
      life: def.life, t: 0, dir: p.dir,
      dmg: def.dmg, kbx: def.kbx, kbz: def.kbz, hs: def.hs, shake: def.shake, pow: def.pow,
      pierce: !!def.pierce, rehit: def.rehit || 0, hitT: {},
      grav: def.grav || 0, roll: !!def.roll, rollOnLand: !!def.rollOnLand, bounce: !!def.bounce, bounced: false,
      landSlam: def.landSlam || null,
    };
    sim.projs.push(pr);
  }
  sim.events.push({ e: 'shot', id: p.id, x: p.x + p.dir * 10, y: p.y, z: p.z + 12, dir: p.dir, type: def.type, n, pow: def.pow });
}

// ---------------------------------------------------------------- enemies
function spawnEnemy(sim, type, x, y, delay = 0) {
  const d = ENEMIES[type];
  const hpScale = 1 + sim.loop * 0.3 + Math.max(0, sim.players.length - 1) * 0.15;
  const e = {
    id: sim.nextId++, kind: 'enemy', type, x, y, z: 0, vx: 0, vy: 0, vz: 0, dir: -1,
    hp: Math.round(d.hp * hpScale), maxHp: Math.round(d.hp * hpScale), weight: d.weight, w: d.w, h: d.h,
    state: 'spawn', st: 0, spawnDelay: delay, hitstop: 0, flash: 0, inv: 0,
    target: 0, think: 10, laneOff: 0, laneT: 0, cd: {}, ak: '', atkHit: {}, hurtDur: 0, downDur: 36,
    juggle: 0, bounced: false, stagger: 0, summoned: false, dying: 0,
  };
  sim.enemies.push(e);
  return e;
}

function nearestPlayer(sim, e) {
  let best = null, bd = 1e9;
  for (const p of sim.players) {
    if (p.state === 'dead') continue;
    const d = Math.abs(p.x - e.x) + Math.abs(p.y - e.y) * 0.5;
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

function stepEnemy(sim, e) {
  const d = ENEMIES[e.type];
  if (e.flash > 0) e.flash--;
  if (e.inv > 0) e.inv--;
  for (const k in e.cd) if (e.cd[k] > 0) e.cd[k]--;
  if (e.hitstop > 0) { e.hitstop--; return; }
  e.st++;
  if (e.stagger > 0 && e.state !== 'launched') e.stagger = Math.max(0, e.stagger - 0.3);

  switch (e.state) {
    case 'spawn': if (e.st >= e.spawnDelay) { e.state = 'walk'; e.st = 0; } return;
    case 'hurt': { e.vx *= 0.85; if (e.st >= e.hurtDur) { e.state = 'idle'; e.st = 0; e.think = 12; } return; }
    case 'launched': return;
    case 'down': { if (e.st >= e.downDur) { e.state = 'getup'; e.st = 0; e.inv = 22; } return; }
    case 'getup': { if (e.st >= 18) { e.state = 'idle'; e.st = 0; e.think = 10; } return; }
    case 'buried': { if (e.st >= 110) { e.state = 'getup'; e.st = 0; e.inv = 24; sim.events.push({ e: 'unbury', x: e.x, y: e.y }); } return; }
    case 'dying': { e.dying++; if (e.dying > 110) finishKill(sim, e); return; }
    case 'gone': return;
    case 'windup': {
      const wu = e.ak === 'ranged' ? d.ranged.windup : e.ak === 'charge' ? d.charge.windup : e.ak === 'slam' ? d.slam.windup : d.melee.windup;
      if (e.st >= wu) {
        e.state = 'attack'; e.st = 0; e.atkHit = {};
        if (e.ak === 'charge') { e.vx = e.dir * d.charge.speed; sim.events.push({ e: 'echarge', x: e.x, y: e.y }); }
        if (e.ak === 'hop') { e.vz = d.hop.vz; e.z = 0.01; e.vx = e.dir * d.hop.speed; }
        if (e.ak === 'ranged') {
          const tp = sim.players.find(p => p.id === e.target);
          const vy = tp ? clamp((tp.y - e.y) / 40, -1.2, 1.2) : 0;
          sim.projs.push({ id: sim.nextId++, kind: 'proj', type: 'sushi', team: 'e', owner: e.id, x: e.x + e.dir * 8, y: e.y, z: 14,
            vx: e.dir * d.ranged.speed, vy, vz: 1.4, grav: 0.06, life: 120, t: 0, dir: e.dir, dmg: d.ranged.dmg, kbx: 2, kbz: 0, hs: 3, shake: 2, pow: 1, hitT: {} });
          sim.events.push({ e: 'shot', x: e.x, y: e.y, z: 14, dir: e.dir, type: 'sushi', n: 1, pow: 1 });
        }
        sim.events.push({ e: 'eattack', x: e.x, y: e.y, type: e.type, ak: e.ak });
      }
      return;
    }
    case 'attack': {
      if (e.ak === 'melee') { if (e.st >= d.melee.dur) { e.state = 'idle'; e.st = 0; e.think = 26; } }
      else if (e.ak === 'ranged') { if (e.st >= d.ranged.dur) { e.state = 'idle'; e.st = 0; e.think = 20; } }
      else if (e.ak === 'charge') {
        e.vx = e.dir * d.charge.speed;
        if (e.st >= d.charge.dur) { e.state = 'idle'; e.st = 0; e.think = 30; e.vx = 0; }
      }
      else if (e.ak === 'hop') { if (e.z <= 0 && e.st > 4) { e.state = 'idle'; e.st = 0; e.think = 24; e.vx = 0; } }
      else if (e.ak === 'slam') {
        if (e.st === 8) doSlam(sim, e, e.x + e.dir * 10, e.y, { r: d.slam.r, dmg: d.slam.dmg, kbz: d.slam.kbz, kbx: d.slam.kbx, hs: 8, shake: 12, bury: false, pow: 3 }, {});
        if (e.st >= d.slam.dur) { e.state = 'idle'; e.st = 0; e.think = 30; }
      }
      return;
    }
    default: break; // idle / walk
  }

  // ---- AI: idle / walk
  const tp = sim.players.find(p => p.id === e.target && p.state !== 'dead') || nearestPlayer(sim, e);
  if (!tp) { e.state = 'idle'; e.vx = 0; e.vy = 0; return; }
  e.target = tp.id;
  if (e.laneT-- <= 0) { e.laneT = sim.rng.int(60, 140); e.laneOff = sim.rng.range(-12, 12); }
  const dx = tp.x - e.x, dy = tp.y - e.y;
  e.dir = dx < 0 ? -1 : 1;
  const range = d.melee.range;
  const inRange = Math.abs(dx) <= range && Math.abs(dy) <= d.melee.d;
  if (e.think > 0) e.think--;

  // special abilities
  const adx = Math.abs(dx);
  if (e.think === 0) {
    if (d.ranged && !e.cd.ranged && adx >= d.ranged.range[0] && adx <= d.ranged.range[1] && Math.abs(dy) < 40 && sim.rng.next() < 0.5) {
      e.cd.ranged = d.ranged.cd; e.ak = 'ranged'; e.state = 'windup'; e.st = 0; e.vx = e.vy = 0; sim.events.push({ e: 'ewindup', x: e.x, y: e.y, type: e.type }); return;
    }
    if (d.charge && !e.cd.charge && adx >= d.charge.range[0] && adx <= d.charge.range[1] && Math.abs(dy) < 14 && sim.rng.next() < 0.6) {
      e.cd.charge = d.charge.cd; e.ak = 'charge'; e.state = 'windup'; e.st = 0; e.vx = e.vy = 0; sim.events.push({ e: 'ewindup', x: e.x, y: e.y, type: e.type }); return;
    }
    if (d.hop && !e.cd.hop && adx >= d.hop.range[0] && adx <= d.hop.range[1] && Math.abs(dy) < 16 && sim.rng.next() < 0.6) {
      e.cd.hop = d.hop.cd; e.ak = 'hop'; e.state = 'windup'; e.st = 0; e.vx = e.vy = 0; sim.events.push({ e: 'ewindup', x: e.x, y: e.y, type: e.type }); return;
    }
    if (d.blink && !e.cd.blink && adx < d.blink.dist && sim.rng.next() < 0.5) {
      e.cd.blink = d.blink.cd;
      sim.events.push({ e: 'blink', x: e.x, y: e.y });
      e.x = clamp(tp.x + (dx < 0 ? 1 : -1) * 26, sim.camX + 10, sim.camX + W - 10); e.y = tp.y; e.dir = tp.x < e.x ? -1 : 1;
      sim.events.push({ e: 'blink', x: e.x, y: e.y });
      e.ak = 'melee'; e.state = 'windup'; e.st = 0; e.vx = e.vy = 0; return;
    }
    if (d.slam && !e.cd.slam && adx <= d.slam.range[1] && Math.abs(dy) < 30 && sim.rng.next() < 0.5) {
      e.cd.slam = d.slam.cd; e.ak = 'slam'; e.state = 'windup'; e.st = 0; e.vx = e.vy = 0; sim.events.push({ e: 'ewindup', x: e.x, y: e.y, type: e.type, big: true }); return;
    }
  }
  if (d.summon && !e.summoned && e.hp < e.maxHp * d.summon.at) {
    e.summoned = true;
    for (let i = 0; i < d.summon.types.length; i++) spawnEnemy(sim, d.summon.types[i], sim.camX + (i ? W + 20 : -20), e.y + (i ? 10 : -10), 10);
    sim.events.push({ e: 'summon', x: e.x, y: e.y });
  }

  if (inRange) {
    e.vx = 0; e.vy = clamp(dy, -0.4, 0.4);
    if (e.think === 0) {
      if (sim.rng.next() < d.hesitate) { e.think = sim.rng.int(14, 36); e.state = 'idle'; }
      else { e.ak = 'melee'; e.state = 'windup'; e.st = 0; sim.events.push({ e: 'ewindup', x: e.x, y: e.y, type: e.type }); }
    } else e.state = 'idle';
    return;
  }
  // approach: stand at range*0.85 from the target on the side we're on, align lane
  const goalX = tp.x - sign(dx) * range * 0.85;
  const goalY = clamp(tp.y + e.laneOff, FLOOR_TOP, FLOOR_BOT);
  const sp = d.speed * (e.type === 'boss' ? 1 : (1 + sim.loop * 0.08));
  e.vx = clamp(goalX - e.x, -sp, sp);
  e.vy = clamp(goalY - e.y, -sp * 0.7, sp * 0.7);
  e.state = 'walk';
}

function separateEnemies(sim) {
  const es = sim.enemies;
  for (let i = 0; i < es.length; i++) {
    const a = es[i];
    if (a.state !== 'walk' && a.state !== 'idle') continue;
    for (let j = i + 1; j < es.length; j++) {
      const b = es[j];
      if (b.state !== 'walk' && b.state !== 'idle') continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      if (Math.abs(dx) < 12 && Math.abs(dy) < 7) {
        const s = dx < 0 ? -1 : 1;
        a.x -= s * 0.4; b.x += s * 0.4; a.y -= 0.2; b.y += 0.2;
      }
    }
  }
}

// ---------------------------------------------------------------- projectiles
function stepProj(sim, pr) {
  pr.t++; pr.life--;
  if (pr.type === 'meteor') {
    pr.vz -= SPECIAL.gravity; pr.z += pr.vz;
    if (pr.z <= 0) {
      pr.z = 0; pr.dead = true;
      const owner = sim.players.find(p => p.id === pr.owner);
      doSlam(sim, owner || { id: 0, kind: 'player' }, pr.x, pr.y, { ...SPECIAL.slam, pow: 3, meteor: true }, {});
    }
    return;
  }
  pr.x += pr.vx; pr.y += pr.vy;
  if (pr.roll) {
    pr.z = 0; pr.vx *= 0.985;
    if (Math.abs(pr.vx) < 1.2) pr.life = Math.min(pr.life, 6);
  } else {
    if (pr.grav) pr.vz -= pr.grav;
    pr.z += pr.vz;
    if (pr.z <= 0) {
      pr.z = 0;
      const owner = sim.players.find(p => p.id === pr.owner) || { id: pr.owner, kind: 'player' };
      if (pr.landSlam) { pr.dead = true; doSlam(sim, owner, pr.x, pr.y, { ...pr.landSlam, pow: pr.pow }, {}); sim.events.push({ e: 'splatfood', x: pr.x, y: pr.y, type: pr.type }); }
      else if (pr.rollOnLand) { pr.roll = true; pr.vz = 0; pr.vx = pr.dir * Math.max(3.5, Math.abs(pr.vx)); sim.events.push({ e: 'plop', x: pr.x, y: pr.y, type: pr.type }); }
      else if (pr.bounce && !pr.bounced) { pr.bounced = true; pr.vz = 2.6; pr.vx *= 0.7; sim.events.push({ e: 'plop', x: pr.x, y: pr.y, type: pr.type }); }
      else { pr.life = 0; sim.events.push({ e: 'splatfood', x: pr.x, y: pr.y, type: pr.type }); }
    }
  }
  if (pr.x < sim.camX - 40 || pr.x > sim.camX + W + 40) pr.life = 0;
  pr.y = clamp(pr.y, FLOOR_TOP - 4, FLOOR_BOT + 4);
}

// ---------------------------------------------------------------- physics
function physics(sim, e) {
  if (e.hitstop > 0) return;
  if (e.state === 'gone') return;
  e.x += e.vx; e.y += e.vy;
  const wasAir = e.z > 0;
  if (e.z > 0 || e.vz > 0) {
    if (!e.noGrav) e.vz -= GRAVITY;
    e.z += e.vz;
    if (e.z <= 0) { e.z = 0; land(sim, e); }
  }
  if (e.z <= 0 && (e.state === 'launched' || e.state === 'down' || e.state === 'hurt' || e.state === 'dying')) { e.vx *= 0.88; e.vy *= 0.8; }
  // bounds
  e.y = clamp(e.y, FLOOR_TOP, FLOOR_BOT);
  if (e.kind === 'player') {
    const lo = sim.camX + 6, hi = sim.camX + W - 6;
    if (e.state === 'launched' && (e.x < lo || e.x > hi) && Math.abs(e.vx) > 2.5) wallBounce(sim, e, lo, hi);
    e.x = clamp(e.x, lo, Math.min(hi, STAGE_LEN - 6));
  } else {
    const lo = sim.camX + 4, hi = sim.camX + W - 4;
    if (e.state === 'launched' || e.state === 'dying') {
      if ((e.x < lo || e.x > hi) && Math.abs(e.vx) > 2.5) wallBounce(sim, e, lo, hi);
      e.x = clamp(e.x, lo, hi);
    } else if (e.state !== 'spawn') {
      e.x = clamp(e.x, sim.camX - 36, sim.camX + W + 36);
    }
  }
  if (wasAir && e.z <= 0 && e.state === 'jump') { e.state = 'idle'; e.st = 0; }
}

function wallBounce(sim, e, lo, hi) {
  e.x = e.x < lo ? lo : hi;
  e.vx = -e.vx * 0.55;
  e.vz = Math.max(e.vz, 3.5);
  sim.events.push({ e: 'wall', x: e.x, y: e.y, z: e.z + 10, pow: 2, side: e.x <= lo ? -1 : 1 });
}

function land(sim, e) {
  e.z = 0;
  if (e.state === 'launched') {
    if (e.vz < -5.2 && !e.bounced) {
      e.bounced = true; const p = Math.min(3, Math.round(-e.vz / 3));
      e.vz = -e.vz * 0.45; e.z = 0.01;
      sim.events.push({ e: 'bounce', x: e.x, y: e.y, pow: p, kind: e.kind });
      return;
    }
    e.vz = 0; e.bounced = false; e.juggle = 0; e.state = 'down'; e.st = 0;
    sim.events.push({ e: 'thud', x: e.x, y: e.y, pow: 1, kind: e.kind });
    return;
  }
  if (e.state === 'dying') { finishKill(sim, e); return; }
  if (e.state === 'jump' || e.state === 'spawn') { e.vz = 0; if (e.state === 'jump') { e.state = 'idle'; e.st = 0; } sim.events.push({ e: 'land', x: e.x, y: e.y }); return; }
  if (e.kind === 'enemy' && e.state === 'attack' && e.ak === 'hop') {
    e.vz = 0;
    const d = ENEMIES[e.type];
    sim.events.push({ e: 'stomp', x: e.x, y: e.y, pow: 2 });
    for (const p of sim.players) {
      if (p.state === 'dead' || p.inv > 0 || p.state === 'special') continue;
      if (Math.abs(p.x - e.x) < 22 && Math.abs(p.y - e.y) < 12 && p.z < 20) hitPlayer(sim, e, p, { dmg: d.hop.dmg, kbx: d.hop.kbx, kbz: d.hop.kbz, hs: 5, shake: 4, pow: 2, kind: 'blunt' }, sign(p.x - e.x));
    }
    return;
  }
  e.vz = 0;
}

// ---------------------------------------------------------------- hits
function boxHit(a, hit, v, mirrored) {
  const dir = mirrored ? -a.dir : a.dir;
  const x0 = a.x + dir * hit.ox, x1 = a.x + dir * (hit.ox + hit.w);
  const lo = Math.min(x0, x1) - v.w / 2, hi = Math.max(x0, x1) + v.w / 2;
  if (v.x < lo || v.x > hi) return false;
  if (Math.abs(v.y - a.y) > hit.d) return false;
  const vz0 = v.z, vz1 = v.z + v.h;
  const hz0 = a.z + hit.zlo, hz1 = a.z + hit.zhi;
  return !(vz1 < hz0 || vz0 > hz1);
}

function resolveHits(sim) {
  const ev = sim.events;
  // player attacks → enemies
  for (const p of sim.players) {
    if (p.hitstop > 0) continue;
    let hits = null;
    if (p.state === 'attack' || p.state === 'airatk') { const m = moveDef(p); hits = m && m.hits; }
    else if (p.state === 'dash') hits = DASH.hits;
    if (!hits) continue;
    for (let hi = 0; hi < hits.length; hi++) {
      const h = hits[hi];
      if (p.st < h.from || p.st > h.to) continue;
      for (const e of sim.enemies) {
        if (!targetable(e)) continue;
        const key = hi + ':' + e.id;
        if (p.atkHit[key]) continue;
        const hitFront = boxHit(p, h, e, false);
        const hitBack = h.both && boxHit(p, h, e, true);
        if (!hitFront && !hitBack) continue;
        p.atkHit[key] = 1;
        const dir = hitFront ? p.dir : -p.dir;
        hitEnemy(sim, p, e, h, dir);
      }
    }
  }
  // enemy melee / charge → players
  for (const e of sim.enemies) {
    if (e.hitstop > 0 || e.state !== 'attack') continue;
    const d = ENEMIES[e.type];
    let h = null;
    if (e.ak === 'melee' && e.st >= d.melee.active[0] && e.st <= d.melee.active[1]) h = { ...d.melee, zlo: -4, zhi: d.h + 6, pow: d.boss ? 2 : 1, hs: 4, shake: 3, kind: 'blunt' };
    else if (e.ak === 'charge') h = { ox: -4, w: 24, d: d.charge.d, zlo: -4, zhi: d.h, dmg: d.charge.dmg, kbx: d.charge.kbx, kbz: d.charge.kbz, pow: 2, hs: 5, shake: 5, kind: 'blunt' };
    if (!h) continue;
    for (const p of sim.players) {
      if (p.state === 'dead' || p.inv > 0 || p.state === 'special') continue;
      if (e.atkHit[p.id]) continue;
      if (!boxHit(e, h, p, false)) continue;
      e.atkHit[p.id] = 1;
      hitPlayer(sim, e, p, h, e.dir);
    }
  }
  // projectiles
  for (const pr of sim.projs) {
    if (pr.dead || pr.type === 'meteor') continue;
    if (pr.team === 'p') {
      const owner = sim.players.find(p => p.id === pr.owner) || { id: pr.owner, kind: 'player', x: pr.x, y: pr.y, z: 0, hitstop: 0, meter: 0, hits: 0, comboT: 0, score: 0 };
      for (const e of sim.enemies) {
        if (!targetable(e)) continue;
        if (pr.landSlam && pr.vz > 0) continue; // still rising
        const last = pr.hitT[e.id];
        if (last !== undefined && (!pr.rehit || pr.t - last < pr.rehit)) continue;
        if (Math.abs(pr.x - e.x) > 7 + e.w / 2 || Math.abs(pr.y - e.y) > 11) continue;
        if (pr.z < e.z - 6 || pr.z > e.z + e.h + 4) continue;
        pr.hitT[e.id] = pr.t;
        hitEnemy(sim, owner, e, { dmg: pr.dmg, kbx: pr.kbx, kbz: pr.kbz, hs: pr.hs, shake: pr.shake, pow: pr.pow, kind: pr.type === 'friesdart' ? 'pierce' : 'blunt' }, sign(pr.vx || pr.dir), pr);
        if (!pr.pierce) { pr.dead = true; sim.events.push({ e: 'splatfood', x: pr.x, y: pr.y, type: pr.type, z: pr.z }); break; }
      }
    } else {
      for (const p of sim.players) {
        if (p.state === 'dead' || p.inv > 0 || p.state === 'special') continue;
        if (Math.abs(pr.x - p.x) > 9 || Math.abs(pr.y - p.y) > 10) continue;
        if (pr.z < p.z - 4 || pr.z > p.z + p.h + 4) continue;
        pr.dead = true;
        hitPlayer(sim, null, p, { dmg: pr.dmg, kbx: pr.kbx, kbz: pr.kbz, hs: pr.hs, shake: pr.shake, pow: pr.pow, kind: 'blunt' }, sign(pr.vx));
        break;
      }
    }
  }
}

function targetable(e) {
  return e.state !== 'dying' && e.state !== 'gone' && e.state !== 'spawn' && e.inv <= 0;
}

function hitEnemy(sim, atk, e, h, dir, proj) {
  const d = ENEMIES[e.type];
  const wt = e.weight || 1;
  let dmg = h.dmg;
  const buried = e.state === 'buried';
  if (buried) dmg = Math.round(dmg * 1.5);
  const airHit = e.z > 0;
  const crit = airHit && h.pow >= 2;
  if (crit) dmg = Math.round(dmg * 1.25);
  e.hp -= dmg;
  e.flash = 4 + h.pow * 2;
  e.hitstop = Math.max(e.hitstop, h.hs);
  if (atk && atk.kind === 'player' && !proj) atk.hitstop = Math.max(atk.hitstop, Math.round(h.hs * 0.85));
  e.target = atk ? atk.id : e.target;
  const kbx = (h.kbx / wt) * dir, kbz = h.kbz / wt;
  const cx = proj ? proj.x : (e.x - dir * 4);
  sim.events.push({ e: 'hit', x: cx, y: e.y, z: e.z + e.h * 0.55, dir, pow: h.pow, kind: h.kind, dmg, crit, vid: e.id, shake: h.shake, air: airHit, buried });

  if (atk && atk.kind === 'player') {
    atk.meter = Math.min(METER_MAX, atk.meter + dmg * 0.55 + 1);
    atk.hits++; atk.comboT = 100;
    const gain = Math.round(dmg * (1 + atk.hits * 0.05));
    atk.score += gain; sim.score += gain;
    if (atk.hits > 0 && atk.hits % 10 === 0) sim.events.push({ e: 'combo', id: atk.id, n: atk.hits, x: e.x, y: e.y, z: e.z + e.h });
  }

  if (e.hp <= 0) { kill(sim, e, kbx * 1.4 + dir * 1.5, Math.max(kbz, 5.5)); return; }
  if (buried) return;

  if (d.boss) {
    e.stagger += dmg;
    if (e.stagger >= 90) { e.stagger = 0; e.state = 'launched'; e.st = 0; e.vz = 6.5; e.vx = dir * 1.5; e.juggle = 0; sim.events.push({ e: 'stagger', x: e.x, y: e.y, z: e.h }); return; }
    if (e.state === 'launched') { e.vz = Math.max(e.vz, 2.5); e.vx = kbx * 0.3; e.juggle++; return; }
    if (h.pow >= 2 && e.state !== 'attack') { e.state = 'hurt'; e.st = 0; e.hurtDur = 10; e.vx = kbx * 0.5; }
    return;
  }

  if (e.state === 'launched' || e.z > 0) {
    // juggle: keep them up, diminishing so combos end eventually
    e.juggle++;
    const lift = Math.max(2.8, kbz > 0 ? kbz : 3.2) * Math.max(0.55, 1 - e.juggle * 0.07);
    e.vz = Math.max(e.vz * 0.3, lift);
    e.vx = kbx * 0.8; e.bounced = false; e.state = 'launched';
    return;
  }
  if (kbz >= 2.2) {
    e.state = 'launched'; e.st = 0; e.vz = kbz; e.vx = kbx; e.z = 0.01; e.bounced = false; e.juggle = 1;
    sim.events.push({ e: 'launch', x: e.x, y: e.y, pow: h.pow });
    return;
  }
  if (e.state === 'down' || e.state === 'getup') {
    // OTG pop-up
    e.state = 'launched'; e.st = 0; e.vz = 4.2; e.vx = kbx * 0.6; e.z = 0.01; e.bounced = false; e.juggle = 1;
    return;
  }
  e.state = 'hurt'; e.st = 0; e.hurtDur = 11 + h.pow * 5; e.vx = kbx; e.vy = 0;
}

function kill(sim, e, vx, vz) {
  const d = ENEMIES[e.type];
  e.state = 'dying'; e.st = 0; e.dying = 0; e.hp = 0; e.vx = vx; e.vz = Math.max(vz, 4); e.z = Math.max(e.z, 0.01);
  sim.events.push({ e: 'ko', x: e.x, y: e.y, z: e.z + 10, type: e.type, boss: !!d.boss, dir: sign(vx) });
  const bonus = Math.round(d.score * (1 + sim.loop * 0.5));
  sim.score += bonus;
  const lastHitter = sim.players.find(p => p.id === e.target);
  if (lastHitter) lastHitter.score += bonus;
  if (d.boss) { sim.slow = 90; sim.events.push({ e: 'bosskill', x: e.x, y: e.y }); }
  // drop
  const r = sim.rng.next();
  if (d.boss || r < 0.22) {
    const type = d.boss ? 'burger' : (r < 0.1 ? 'burger' : r < 0.17 ? 'fries' : 'cola');
    sim.pickups.push({ id: sim.nextId++, kind: 'pickup', type, x: clamp(e.x, sim.camX + 12, sim.camX + W - 12), y: e.y, z: 30, vz: 2, life: 720 });
  }
}

function finishKill(sim, e) {
  if (e.state === 'gone') return;
  e.state = 'gone';
  sim.events.push({ e: 'splat', x: e.x, y: e.y, z: e.z, type: e.type, boss: !!ENEMIES[e.type].boss });
}

function hitPlayer(sim, atk, p, h, dir) {
  if (p.inv > 0 || p.state === 'dead') return;
  p.hp -= h.dmg;
  p.flash = 6; p.hitstop = Math.max(p.hitstop, h.hs || 4);
  if (atk) atk.hitstop = Math.max(atk.hitstop, 3);
  p.hits = 0; p.comboT = 0;
  p.noGrav = false;
  sim.events.push({ e: 'phit', id: p.id, x: p.x, y: p.y, z: p.z + 14, dir, pow: h.pow || 1, dmg: h.dmg, shake: h.shake || 3 });
  if (p.hp <= 0) {
    p.hp = 0; p.state = 'dead'; p.st = 0; p.deadT = 0; p.vx = dir * 3; p.vz = 6; p.z = Math.max(p.z, 0.01);
    sim.events.push({ e: 'pdead', id: p.id, x: p.x, y: p.y });
    return;
  }
  if ((h.kbz || 0) >= 2 || p.z > 0) {
    p.state = 'launched'; p.st = 0; p.vz = Math.max(h.kbz || 0, 4); p.vx = (h.kbx || 2) * dir; p.z = Math.max(p.z, 0.01); p.bounced = false;
  } else {
    p.state = 'hurt'; p.st = 0; p.hurtDur = 16; p.vx = (h.kbx || 2) * dir; p.vy = 0;
  }
}

// AOE ground slam. `exclude` is the attacker's atkHit map (to avoid double hits with the direct hitbox).
function doSlam(sim, atk, x, y, slam, exclude) {
  const r = slam.r;
  sim.events.push({ e: 'slam', x, y, r, pow: slam.pow || 3, meteor: !!slam.meteor, by: atk.kind, fxKind: slam.fxKind || '' });
  if (atk.kind === 'player' || atk.id === 0) {
    for (const e of sim.enemies) {
      if (!targetable(e)) continue;
      const dx = (e.x - x) / r, dy = (e.y - y) / (r * 0.45);
      if (dx * dx + dy * dy > 1) continue;
      if (exclude && Object.keys(exclude).some(k => k.endsWith(':' + e.id))) continue;
      if (exclude) exclude['s:' + e.id] = 1;
      const dir = e.x < x ? -1 : 1;
      if (slam.bury && e.z <= 0 && (e.state === 'down' || e.state === 'getup' || e.state === 'buried')) {
        e.hp -= slam.dmg; e.flash = 8; e.hitstop = slam.hs;
        e.state = 'buried'; e.st = 0; e.inv = 0; e.vx = e.vy = 0; e.target = atk.id;
        sim.events.push({ e: 'buried', x: e.x, y: e.y, vid: e.id, dmg: slam.dmg });
        if (atk.kind === 'player' && atk.meter !== undefined) { atk.meter = Math.min(METER_MAX, atk.meter + 10); atk.hits++; atk.comboT = 100; atk.score += slam.dmg; sim.score += slam.dmg; }
        if (e.hp <= 0) kill(sim, e, dir * 2, 7);
        continue;
      }
      hitEnemy(sim, atk, e, { dmg: slam.dmg, kbx: slam.kbx, kbz: slam.kbz, hs: slam.hs, shake: slam.shake, pow: slam.pow || 3, kind: 'blunt' }, dir);
    }
  } else {
    for (const p of sim.players) {
      if (p.state === 'dead' || p.inv > 0 || p.state === 'special') continue;
      const dx = (p.x - x) / r, dy = (p.y - y) / (r * 0.45);
      if (dx * dx + dy * dy > 1 || p.z > 24) continue;
      hitPlayer(sim, atk, p, { dmg: slam.dmg, kbx: slam.kbx, kbz: slam.kbz, hs: 6, shake: 8, pow: 3, kind: 'blunt' }, p.x < x ? -1 : 1);
    }
  }
}

// ---------------------------------------------------------------- pickups
function stepPickups(sim) {
  for (const k of sim.pickups) {
    k.life--; if (k.life <= 0) { k.dead = true; continue; }
    if (k.z > 0 || k.vz > 0) { k.vz -= GRAVITY * 0.6; k.z += k.vz; if (k.z <= 0) { k.z = 0; k.vz = 0; } }
    for (const p of sim.players) {
      if (p.state === 'dead' || p.z > 10) continue;
      if (Math.abs(p.x - k.x) < 11 && Math.abs(p.y - k.y) < 9) {
        k.dead = true;
        if (k.type === 'burger') p.hp = Math.min(p.maxHp, p.hp + 35);
        else if (k.type === 'fries') p.meter = Math.min(METER_MAX, p.meter + 40);
        else { p.score += 500; sim.score += 500; }
        sim.events.push({ e: 'pickup', id: p.id, type: k.type, x: k.x, y: k.y });
        break;
      }
    }
  }
}

// ---------------------------------------------------------------- waves & camera
function avgPlayerX(sim) {
  const ps = sim.players.filter(p => p.state !== 'dead');
  if (!ps.length) return sim.camX + W / 2;
  return ps.reduce((s, p) => s + p.x, 0) / ps.length;
}

function stepWaves(sim) {
  const waves = STAGE.waves;
  if (sim.waveActive) {
    const alive = sim.enemies.some(e => e.state !== 'dying' && e.state !== 'gone');
    if (!alive) {
      sim.waveActive = false; sim.camLock = -1;
      if (waves[sim.wave].boss) { sim.phase = PHASE.CLEAR; sim.phaseT = 0; sim.events.push({ e: 'clear', loop: sim.loop }); }
      else sim.events.push({ e: 'go' });
    }
    return;
  }
  const next = sim.wave + 1;
  if (next >= waves.length) return;
  const wv = waves[next];
  if (sim.camX >= wv.x - 1) {
    sim.wave = next; sim.waveActive = true; sim.camLock = wv.x; sim.camX = wv.x;
    const pc = Math.max(1, sim.players.length);
    let i = 0;
    for (const [type, cnt] of wv.spawn) {
      const n = ENEMIES[type].boss ? 1 : Math.round(cnt * (1 + 0.45 * (pc - 1)));
      for (let k = 0; k < n; k++) {
        const side = (i % 2 === 0) ? 1 : -1;
        const x = side > 0 ? wv.x + W + 16 + k * 10 : wv.x - 16 - k * 10;
        const y = FLOOR_TOP + 6 + ((i * 37) % (FLOOR_BOT - FLOOR_TOP - 12));
        spawnEnemy(sim, type, ENEMIES[type].boss ? wv.x + W + 30 : x, y, 6 + i * 14);
        i++;
      }
    }
    sim.events.push({ e: 'wave', n: next + 1, boss: !!wv.boss, total: waves.length });
  }
}

function stepCamera(sim) {
  if (sim.camLock >= 0) { sim.camX = sim.camLock; return; }
  const target = clamp(avgPlayerX(sim) - W * 0.42, 0, STAGE_LEN - W);
  if (target > sim.camX) sim.camX = Math.min(target, sim.camX + 2.2);
}

// ---------------------------------------------------------------- snapshot (network)
const P_FIELDS = ['id', 'name', 'slot', 'x', 'y', 'z', 'dir', 'state', 'st', 'hp', 'maxHp', 'weapon', 'mv', 'alt', 'hitstop', 'flash', 'meter', 'inv', 'lives', 'hits', 'comboT', 'dashCd', 'score', 'vz'];
const E_FIELDS = ['id', 'type', 'x', 'y', 'z', 'dir', 'state', 'st', 'hp', 'maxHp', 'flash', 'hitstop', 'ak', 'inv', 'vz'];
const J_FIELDS = ['id', 'type', 'team', 'x', 'y', 'z', 'vx', 'vy', 'vz', 't', 'dir', 'roll'];
const K_FIELDS = ['id', 'type', 'x', 'y', 'z', 'life'];
const pick = (o, f) => { const r = {}; for (const k of f) r[k] = o[k]; return r; };

export function snapshot(sim) {
  return {
    tk: sim.tick, ph: sim.phase, pt: sim.phaseT, cam: Math.round(sim.camX * 10) / 10, wave: sim.wave, wa: sim.waveActive, loop: sim.loop, score: sim.score,
    P: sim.players.map(p => pick(p, P_FIELDS)),
    E: sim.enemies.map(e => pick(e, E_FIELDS)),
    J: sim.projs.map(j => pick(j, J_FIELDS)),
    K: sim.pickups.map(k => pick(k, K_FIELDS)),
    ev: sim.events,
  };
}

// Builds a render-view from a live sim (offline) in the same shape as a network snapshot.
export function view(sim) { return snapshot(sim); }

export { WEAPONS, ENEMIES, STAGE, DASH, SPECIAL };

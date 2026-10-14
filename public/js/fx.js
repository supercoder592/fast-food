// Client-side juice: particles, craters, shake, global freeze frames, floating numbers, banners.
// Consumes sim events and produces visuals + sound. World coords: (x, y=ground, z=height).
import { W, H } from '../sim/constants.js';
import { WEAPONS } from '../sim/weapons.js';
import { ENEMIES } from '../sim/enemies.js';
import { KO_COLORS } from './sprites.js';
import { play } from './sfx.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const pickc = (arr) => arr[(Math.random() * arr.length) | 0];
const SPARK = { blunt: ['#fff6e5', '#ffd23f', '#ff9a3a', '#ffffff'], slash: ['#ffffff', '#fff6e5', '#9adcff', '#ffd23f'], pierce: ['#ffffff', '#9adcff', '#fff6e5'] };

export class FX {
  constructor() {
    this.parts = []; this.decals = []; this.texts = []; this.warns = [];
    this.shake = 0; this.shakeX = 0; this.shakeY = 0; this.kickX = 0; this.kickY = 0;
    this.flash = 0; this.flashColor = '#ffffff';
    this.zoom = 1; this.freeze = 0; this.banner = null; this.goArrow = 0; this.time = 0;
    this.localIds = new Set();
    this.bossName = '';
  }
  shakeAdd(n, dx = 0, dy = 0) { this.shake = Math.min(22, this.shake + n); this.kickX += dx; this.kickY += dy; }
  freezeAdd(n) { this.freeze = Math.max(this.freeze, n); }
  zoomPunch(n) { this.zoom = Math.max(this.zoom, 1 + n); }
  flashAdd(a, color = '#ffffff') { this.flash = Math.max(this.flash, a); this.flashColor = color; }

  part(p) { this.parts.push(Object.assign({ vx: 0, vy: 0, vz: 0, grav: 0, life: 20, size: 1, kind: 'spark', bounce: 0, color: '#fff' }, p, { maxLife: p.life || 20 })); }

  sparks(x, y, z, n, kind, dir, speed = 3) {
    const cols = SPARK[kind] || SPARK.blunt;
    for (let i = 0; i < n; i++) {
      const a = rnd(-Math.PI, Math.PI); const s = rnd(0.5, speed);
      this.part({ x, y: y + rnd(-2, 2), z, vx: Math.cos(a) * s + dir * speed * 0.4, vz: Math.sin(a) * s, grav: 0.12, life: rnd(8, 18) | 0, size: Math.random() < 0.3 ? 2 : 1, color: pickc(cols), kind: kind === 'blunt' ? 'spark' : 'streak' });
    }
  }
  dust(x, y, n, spread = 10, color = '#c9b89a') {
    for (let i = 0; i < n; i++) this.part({ x: x + rnd(-spread, spread), y: y + rnd(-3, 3), z: rnd(0, 3), vx: rnd(-0.6, 0.6), vz: rnd(0.2, 0.9), grav: 0.01, life: rnd(14, 30) | 0, size: rnd(2, 5), kind: 'dust', color });
  }
  debris(x, y, n, power = 1) {
    for (let i = 0; i < n; i++) {
      const a = rnd(-Math.PI, Math.PI); const s = rnd(0.8, 3.2) * power;
      this.part({ x: x + rnd(-6, 6), y: y + rnd(-4, 4), z: 2, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.35, vz: rnd(2.5, 7) * Math.min(1.6, power), grav: 0.3, bounce: 2, life: rnd(50, 110) | 0, size: rnd(2, 4) | 0, kind: 'debris', color: pickc(['#8d8da0', '#b8b8c8', '#6a6a7a', '#5a4a3a', '#a08868']) });
    }
  }
  ring(x, y, r, life = 18, color = '#fff6e5', thick = 2) { this.part({ x, y, z: 0, r0: 4, r1: r, life, kind: 'ring', color, size: thick }); }
  slash(x, y, z, dir, color, big = false, pose = 'swing') { this.part({ x, y, z, dir, life: big ? 9 : 6, kind: 'slash', color, size: big ? 22 : 15, pose }); }
  bits(x, y, z, colors, n = 16, power = 1) {
    for (let i = 0; i < n; i++) {
      const a = rnd(-Math.PI, Math.PI); const s = rnd(0.6, 3) * power;
      this.part({ x, y, z: z + rnd(-4, 4), vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.3, vz: rnd(1.5, 6), grav: 0.28, bounce: 1, life: rnd(40, 80) | 0, size: rnd(2, 3) | 0, kind: 'bit', color: pickc(colors) });
    }
  }
  stars(x, y, z, n = 4) {
    for (let i = 0; i < n; i++) { const a = rnd(-Math.PI, Math.PI); this.part({ x, y, z, vx: Math.cos(a) * 1.5, vz: Math.sin(a) * 1.5 + 1, grav: 0.05, life: 16, size: 2, kind: 'star', color: pickc(['#ffd23f', '#ffffff']) }); }
  }
  text(x, y, z, str, color = '#fff', scale = 1, kind = 'num', life = 40) {
    this.texts.push({ x: x + rnd(-3, 3), y, z, str, color, scale, kind, life, maxLife: life, vz: 1.4, vx: rnd(-0.3, 0.3) });
  }
  crater(x, y, r) {
    const cracks = [];
    const n = 6 + ((r / 12) | 0);
    for (let i = 0; i < n; i++) { const a = rnd(-Math.PI, Math.PI); const len = rnd(r * 0.5, r * 1.1); cracks.push([a, len, rnd(-0.6, 0.6)]); }
    this.decals.push({ x, y, r, life: 520, maxLife: 520, cracks });
    if (this.decals.length > 10) this.decals.shift();
  }
  setBanner(str, sub = '', life = 150, color = '#ffd23f') { this.banner = { str, sub, life, maxLife: life, color }; }

  // ---------------------------------------------------------------- events
  handleEvents(evs, view) {
    for (const ev of evs) this.handleEvent(ev, view);
  }
  handleEvent(ev, view) {
    switch (ev.e) {
      case 'hit': {
        const n = ev.pow === 3 ? 26 : ev.pow === 2 ? 14 : 7;
        this.sparks(ev.x, ev.y, ev.z, n, ev.kind, ev.dir, 2 + ev.pow);
        if (ev.pow >= 2) { this.ring(ev.x, ev.y - ev.z, 10 + ev.pow * 4, 10, '#ffffff', 1); this.stars(ev.x, ev.y, ev.z, ev.pow * 2); }
        this.shakeAdd(Math.min(10, (ev.shake || 1) * 0.9), ev.dir * ev.pow * 1.2, 0);
        if (ev.pow === 3) this.freezeAdd(4); else if (ev.pow === 2) this.freezeAdd(2);
        if (ev.crit) { this.text(ev.x, ev.y, ev.z + 14, ev.dmg + '!', '#ffd23f', 2, 'num', 46); play('crit'); }
        else this.text(ev.x, ev.y, ev.z + 10, ev.dmg, ev.pow === 3 ? '#ff9a3a' : '#ffffff', ev.pow === 3 ? 2 : 1);
        play(ev.pow === 3 ? 'hit3' : ev.pow === 2 ? 'hit2' : 'hit1');
        if (ev.buried) this.dust(ev.x, ev.y, 6, 8, '#8a6a4a');
        break;
      }
      case 'slam': {
        const r = ev.r;
        if (ev.fxKind === 'cola') { this.dust(ev.x, ev.y, 30, r * 0.6, '#6b3a1a'); this.bits(ev.x, ev.y, 10, ['#fff6e5', '#6b3a1a', '#e23c2c'], 40, 1.6); this.text(ev.x, ev.y, 36, '曼陀珠爆炸!', '#fff6e5', 1, 'cjk', 60); }
        else if (ev.fxKind === 'fries') { this.bits(ev.x, ev.y, 10, ['#ffd23f', '#e8a92a'], 50, 1.3); this.dust(ev.x, ev.y, 10, r * 0.5, '#e8c060'); }
        else { this.crater(ev.x, ev.y, r); this.debris(ev.x, ev.y, Math.min(44, (r * 0.5) | 0), ev.meteor ? 1.5 : 1.1); this.dust(ev.x, ev.y, 24, r * 0.6, '#b8a888'); }
        this.ring(ev.x, ev.y, r * 1.1, 22, '#fff6e5', 2);
        this.ring(ev.x, ev.y, r * 0.7, 14, '#ffd23f', 1);
        this.shakeAdd(ev.meteor ? 22 : 14, 0, 4); this.flashAdd(ev.meteor ? 0.6 : 0.35, '#fff6e5'); this.zoomPunch(ev.meteor ? 0.09 : 0.05); this.freezeAdd(ev.meteor ? 9 : 6);
        play(ev.meteor ? 'meteor' : 'slam');
        if (ev.meteor) this.text(ev.x, ev.y, 40, '漢堡隕石!!', '#ffd23f', 1, 'cjk', 60);
        break;
      }
      case 'swing': {
        const w = WEAPONS.find(x => x.id === ev.w);
        const color = w ? w.color : '#fff';
        if (ev.pose === 'swing' || ev.pose === 'thrust' || ev.pose === 'slam') this.slash(ev.x + ev.dir * 10, ev.y, ev.z + 12, ev.dir, color, ev.pow >= 2, ev.pose);
        if (ev.pose === 'spin') this.ring(ev.x, ev.y - ev.z - 10, 18, 10, color, 1);
        play(ev.pose === 'thrust' ? 'thrust' : ev.pose === 'spin' ? 'saw' : ev.pose === 'slam' || ev.pow >= 2 ? 'swingHeavy' : ev.pose === 'throw' ? 'throw' : ev.pose === 'shoot' ? null : 'swing');
        break;
      }
      case 'shot': {
        if (ev.type === 'friesdart') { this.sparks(ev.x, ev.y, ev.z, 3, 'pierce', ev.dir, 2); play('thrust'); }
        else if (ev.type === 'bigburger' || ev.type === 'bucket' || ev.type === 'pizzaspin') { this.dust(ev.x, ev.y, 4, 5); play('swingHeavy'); }
        else if (ev.type === 'pizza') { this.dust(ev.x, ev.y, 3, 4); play('swing'); }
        else play('throw');
        break;
      }
      case 'splatfood': {
        const cols = ev.type === 'burger' || ev.type === 'bigburger' ? ['#e8a84a', '#6cc04a', '#e8503a', '#fff6e5', '#7a3e12'] : ev.type === 'bucket' || ev.type === 'friesdart' ? ['#ffd23f', '#e8a92a', '#e23c2c'] : ev.type === 'pizza' || ev.type === 'pizzaspin' ? ['#ffd23f', '#c8302a', '#d9892c'] : ['#fff6e5', '#ff8c5a'];
        this.bits(ev.x, ev.y, ev.z || 2, cols, ev.type === 'bigburger' ? 26 : ev.type === 'bucket' ? 30 : 8, ev.type === 'bigburger' ? 1.4 : 1);
        play('splat');
        break;
      }
      case 'launch': this.dust(ev.x, ev.y, 4, 6); break;
      case 'bounce': { this.dust(ev.x, ev.y, 8 + ev.pow * 3, 8); this.shakeAdd(2 + ev.pow * 2, 0, 2); this.ring(ev.x, ev.y, 14, 10, '#c9b89a', 1); play('bounce'); break; }
      case 'thud': this.dust(ev.x, ev.y, 5, 6); break;
      case 'wall': { this.sparks(ev.x, ev.y, ev.z, 12, 'blunt', -ev.side, 3); this.shakeAdd(6, ev.side * 3, 0); this.freezeAdd(2); play('wall'); break; }
      case 'ko': {
        const cols = KO_COLORS[ev.type] || KO_COLORS.sushi;
        this.bits(ev.x, ev.y, ev.z, cols, ev.boss ? 40 : 12, ev.boss ? 1.6 : 1);
        this.stars(ev.x, ev.y, ev.z, 5);
        this.text(ev.x, ev.y, ev.z + 16, 'K.O.', '#ff5a3a', 2, 'num', 50);
        this.shakeAdd(5, ev.dir * 3, 0); this.freezeAdd(3);
        play('ko');
        break;
      }
      case 'splat': { const cols = KO_COLORS[ev.type] || KO_COLORS.sushi; this.bits(ev.x, ev.y, 4, cols, ev.boss ? 50 : 14, ev.boss ? 1.5 : 1); this.dust(ev.x, ev.y, 10, 10); play('splat'); break; }
      case 'bosskill': { this.freezeAdd(16); this.flashAdd(0.8); this.shakeAdd(20, 0, 6); this.zoomPunch(0.12); play('bossko'); break; }
      case 'buried': { this.dust(ev.x, ev.y, 16, 10, '#8a6a4a'); this.debris(ev.x, ev.y, 8, 0.8); this.text(ev.x, ev.y, 30, '埋進土裡!', '#ffd23f', 1, 'cjk', 70); this.shakeAdd(5); play('buried'); break; }
      case 'unbury': this.dust(ev.x, ev.y, 10, 8, '#8a6a4a'); break;
      case 'jump': { this.dust(ev.x, ev.y, 3, 4); play('jump'); break; }
      case 'land': { this.dust(ev.x, ev.y, 4, 5); play('land'); break; }
      case 'dash': { for (let i = 0; i < 10; i++) this.part({ x: ev.x - ev.dir * rnd(0, 8), y: ev.y + rnd(-3, 3), z: ev.z + rnd(4, 16), vx: -ev.dir * rnd(1, 3), vz: rnd(-0.5, 1), life: rnd(10, 22) | 0, size: Math.random() < 0.4 ? 2 : 1, kind: 'fizz', color: pickc(['#ffb6c8', '#fff6e5', '#f08aa8']) }); play('dash'); break; }
      case 'phit': { this.sparks(ev.x, ev.y, ev.z, 10, 'blunt', ev.dir, 3); this.shakeAdd(Math.min(10, (ev.shake || 3) + 2), ev.dir * 3, 1); this.freezeAdd(2); this.text(ev.x, ev.y, ev.z + 10, '-' + ev.dmg, '#ff5a3a', 1); if (this.localIds.has(ev.id)) this.flashAdd(0.25, '#ff2a2a'); play('hurt'); break; }
      case 'pdead': { this.flashAdd(0.5, '#ff2a2a'); this.shakeAdd(10); this.freezeAdd(8); play('ko'); break; }
      case 'respawn': { this.dust(ev.x, ev.y, 6, 8); play('respawn'); break; }
      case 'special': { this.flashAdd(0.3, '#ffd23f'); this.zoomPunch(0.04); this.text(ev.x, ev.y, 34, '漢堡隕石!', '#ffd23f', 1, 'cjk', 50); play('special'); break; }
      case 'meteor_warn': { this.warns.push({ x: ev.x, y: ev.y, life: 34 }); play('warn'); break; }
      case 'catch': { this.stars(ev.x, ev.y, ev.z, 3); play('catch'); break; }
      case 'swap': { const w = WEAPONS[ev.w]; this.text(ev.x, ev.y, 34, w.name, w.color, 1, 'cjk', 50); play('swap'); break; }
      case 'pickup': { const s = ev.type === 'burger' ? '+35 HP' : ev.type === 'fries' ? '+SP' : '+500'; this.text(ev.x, ev.y, 20, s, '#6cf05a', 1, 'num', 50); this.stars(ev.x, ev.y, 10, 4); play('pickup'); break; }
      case 'wave': {
        if (ev.boss) { this.setBanner('WARNING', '火鍋大帝 現身！', 170, '#ff5a3a'); this.flashAdd(0.3, '#ff2a2a'); play('ewindupBig'); this.bossName = ENEMIES.boss.name; }
        else { this.setBanner('WAVE ' + ev.n, '慢食聯盟來襲', 110); play('wave'); }
        this.goArrow = 0;
        break;
      }
      case 'go': { this.goArrow = 240; play('go'); break; }
      case 'clear': { this.setBanner('STAGE CLEAR', '速食主義 萬歲！', 300, '#6cf05a'); this.goArrow = 0; play('clear'); break; }
      case 'stage': { this.setBanner('LOOP ' + (ev.loop + 1), '敵人變強了', 120, '#ff9a3a'); play('wave'); break; }
      case 'gameover': { this.setBanner('GAME OVER', '按攻擊鍵 再來一次', 100000, '#ff5a3a'); play('gameover'); break; }
      case 'start': { this.banner = null; this.setBanner('FIGHT!', '', 60, '#ffd23f'); this.decals = []; play('go'); break; }
      case 'combo': { this.text(ev.x, ev.y, ev.z + 10, ev.n + ' HITS!', '#ffd23f', 2, 'num', 50); play('combo'); break; }
      case 'ewindup': play(ev.big ? 'ewindupBig' : 'ewindup'); break;
      case 'echarge': this.dust(ev.x, ev.y, 6, 8); break;
      case 'blink': { this.dust(ev.x, ev.y, 8, 6, '#6b4a6a'); play('blink'); break; }
      case 'stomp': { this.dust(ev.x, ev.y, 10, 12); this.ring(ev.x, ev.y, 24, 12, '#c9b89a', 1); this.shakeAdd(5, 0, 2); play('stomp'); break; }
      case 'summon': { this.flashAdd(0.25, '#ff9a3a'); play('warn'); break; }
      case 'stagger': { this.text(ev.x, ev.y, ev.z + 10, 'STAGGER!', '#ff9a3a', 2, 'num', 50); this.stars(ev.x, ev.y, ev.z, 6); play('stagger'); break; }
      case 'plop': this.dust(ev.x, ev.y, 2, 3); break;
      default: break;
    }
  }

  // ---------------------------------------------------------------- update
  update(scale = 1) {
    this.time++;
    // shake: decaying random offset + directional kick
    if (this.shake > 0.1) {
      const a = Math.random() * Math.PI * 2;
      this.shakeX = Math.round(Math.cos(a) * this.shake * 0.7 + this.kickX);
      this.shakeY = Math.round(Math.sin(a) * this.shake * 0.5 + this.kickY);
      this.shake *= 0.82;
    } else { this.shake = 0; this.shakeX = 0; this.shakeY = 0; }
    this.kickX *= 0.6; this.kickY *= 0.6;
    this.zoom += (1 - this.zoom) * 0.18;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - 0.06);
    if (this.freeze > 0) { this.freeze--; return; }
    for (const p of this.parts) {
      p.life -= scale;
      if (p.kind === 'ring' || p.kind === 'slash') continue;
      p.x += p.vx * scale; p.y += p.vy * scale; p.z += p.vz * scale; p.vz -= p.grav * scale;
      if (p.kind === 'dust') { p.size += 0.08 * scale; p.vx *= 0.95; }
      if (p.z < 0) {
        if (p.bounce > 0) { p.bounce--; p.z = 0; p.vz = -p.vz * 0.45; p.vx *= 0.6; p.vy *= 0.6; }
        else { p.z = 0; p.vz = 0; p.vx *= 0.5; p.vy *= 0.5; if (p.kind === 'spark' || p.kind === 'streak') p.life = Math.min(p.life, 3); }
      }
    }
    this.parts = this.parts.filter(p => p.life > 0);
    if (this.parts.length > 900) this.parts.splice(0, this.parts.length - 900);
    for (const d of this.decals) d.life -= scale;
    this.decals = this.decals.filter(d => d.life > 0);
    for (const t of this.texts) { t.life -= scale; t.z += t.vz * scale; t.x += t.vx * scale; t.vz *= 0.93; }
    this.texts = this.texts.filter(t => t.life > 0);
    for (const w of this.warns) w.life -= scale;
    this.warns = this.warns.filter(w => w.life > 0);
    if (this.banner) { this.banner.life -= scale; if (this.banner.life <= 0) this.banner = null; }
    if (this.goArrow > 0) this.goArrow -= scale;
  }

  // ---------------------------------------------------------------- draw
  drawGround(g, camX) {
    for (const d of this.decals) {
      const a = Math.min(1, d.life / 120) * 0.9;
      const sx = d.x - camX, sy = d.y;
      g.globalAlpha = a;
      g.fillStyle = '#1e1a22';
      g.beginPath(); g.ellipse(sx, sy, d.r * 0.55, d.r * 0.2, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#3a3038';
      g.beginPath(); g.ellipse(sx, sy - 1, d.r * 0.42, d.r * 0.13, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#120e16'; g.lineWidth = 1;
      for (const [ang, len, bend] of d.cracks) {
        g.beginPath(); g.moveTo(sx, sy);
        const mx = sx + Math.cos(ang) * len * 0.5, my = sy + Math.sin(ang) * len * 0.2 + bend * 3;
        g.lineTo(Math.round(mx), Math.round(my)); g.lineTo(Math.round(sx + Math.cos(ang + bend * 0.5) * len), Math.round(sy + Math.sin(ang + bend * 0.5) * len * 0.22)); g.stroke();
      }
      g.globalAlpha = 1;
    }
    for (const w of this.warns) {
      const sx = w.x - camX, sy = w.y;
      const on = (this.time >> 2) & 1;
      g.strokeStyle = on ? '#ff5a3a' : '#ffd23f'; g.lineWidth = 1;
      g.beginPath(); g.ellipse(sx, sy, 30, 11, 0, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.ellipse(sx, sy, 14, 5, 0, 0, Math.PI * 2); g.stroke();
      g.fillStyle = on ? '#ff5a3a' : '#ffd23f'; g.fillRect(sx - 1, sy - 1, 3, 3);
    }
    for (const p of this.parts) {
      if (p.z > 0.5 || p.kind === 'ring' || p.kind === 'slash') continue;
      this.drawPart(g, p, camX);
    }
  }
  drawAir(g, camX) {
    for (const p of this.parts) {
      if (p.z <= 0.5 && p.kind !== 'ring' && p.kind !== 'slash') continue;
      this.drawPart(g, p, camX);
    }
  }
  drawPart(g, p, camX) {
    const sx = Math.round(p.x - camX), sy = Math.round(p.y - p.z);
    const t = p.life / p.maxLife;
    switch (p.kind) {
      case 'spark': case 'bit': case 'fizz': { g.fillStyle = p.color; g.fillRect(sx, sy, p.size, p.size); break; }
      case 'streak': { g.strokeStyle = p.color; g.lineWidth = 1; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx - p.vx * 2, sy + p.vz * 2); g.stroke(); break; }
      case 'debris': { g.fillStyle = '#1b1026'; g.fillRect(sx - 1, sy - 1, p.size + 1, p.size + 1); g.fillStyle = p.color; g.fillRect(sx, sy, p.size - 1, p.size - 1); break; }
      case 'dust': { g.globalAlpha = Math.min(0.7, t * 0.9); g.fillStyle = p.color; g.beginPath(); g.arc(sx, sy, p.size, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; break; }
      case 'star': { g.fillStyle = p.color; g.fillRect(sx - 1, sy, 3, 1); g.fillRect(sx, sy - 1, 1, 3); break; }
      case 'ring': { const r = p.r0 + (p.r1 - p.r0) * (1 - t); g.globalAlpha = t; g.strokeStyle = p.color; g.lineWidth = p.size; g.beginPath(); g.ellipse(sx, sy, r, r * 0.4, 0, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1; break; }
      case 'slash': {
        g.globalAlpha = Math.min(1, t * 1.5); g.strokeStyle = p.color; g.lineWidth = 2;
        const r = p.size * (1.2 - t * 0.4);
        g.beginPath();
        if (p.pose === 'thrust') { g.moveTo(sx - p.dir * 4, sy); g.lineTo(sx + p.dir * r, sy); g.stroke(); g.lineWidth = 1; g.beginPath(); g.moveTo(sx, sy - 2); g.lineTo(sx + p.dir * r * 0.8, sy - 2); g.moveTo(sx, sy + 2); g.lineTo(sx + p.dir * r * 0.8, sy + 2); }
        else if (p.pose === 'slam') { g.arc(sx, sy, r, p.dir > 0 ? -Math.PI * 0.9 : -Math.PI * 0.1, p.dir > 0 ? -0.1 : -Math.PI * 0.9 + Math.PI * 0.8, p.dir < 0); }
        else { g.arc(sx, sy, r, p.dir > 0 ? -1.3 : Math.PI - 1.3 + 2.6, p.dir > 0 ? 1.3 : Math.PI + 1.3 - 2.6 + 2.6, false); }
        g.stroke(); g.globalAlpha = 1; break;
      }
      default: break;
    }
  }
}

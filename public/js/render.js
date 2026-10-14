// Canvas renderer: draws a snapshot (offline or network) + FX at 320x180, upscaled by CSS with nearest-neighbor.
import { W, H, FLOOR_TOP, FLOOR_BOT, STAGE_LEN, METER_MAX } from '../sim/constants.js';
import { WEAPONS, DASH, SPECIAL } from '../sim/weapons.js';
import { ENEMIES, STAGE } from '../sim/enemies.js';
import { charSprite, bodySprite, weaponSprite, miscSprite, whiteOf, pixelText, pixelTextWidth } from './sprites.js';

const CJK = 'bold 8px "Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
const CJK_S = 'bold 7px "Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
const lerpAngle = (rot, t) => {
  if (!rot || !rot.length) return 0;
  if (t <= rot[0][0]) return rot[0][1];
  for (let i = 1; i < rot.length; i++) {
    if (t <= rot[i][0]) { const [t0, a0] = rot[i - 1], [t1, a1] = rot[i]; return a0 + (a1 - a0) * ((t - t0) / Math.max(1, t1 - t0)); }
  }
  return rot[rot.length - 1][1];
};
// seeded tiny rng for background generation
function srand(seed) { let s = seed; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

export class Renderer {
  constructor(canvas) {
    this.c = canvas; canvas.width = W; canvas.height = H;
    this.g = canvas.getContext('2d', { alpha: false });
    this.g.imageSmoothingEnabled = false;
    this.buildBackground();
    this.tint = new Map();
    this.frame = 0;
  }

  // ---------------------------------------------------------------- background
  buildBackground() {
    const r = srand(7);
    // far: skyline (parallax 0.35)
    const farW = Math.ceil(STAGE_LEN * 0.35) + W + 64;
    const far = document.createElement('canvas'); far.width = farW; far.height = H;
    const fg = far.getContext('2d');
    for (let i = 0; i < 28; i++) { fg.fillStyle = r() < 0.7 ? '#fff6e5' : '#ffd23f'; fg.fillRect((r() * farW) | 0, (r() * 30) | 0, 1, 1); }
    let x = 0;
    while (x < farW) {
      const bw = 14 + ((r() * 30) | 0), bh = 70 + ((r() * 56) | 0);
      fg.fillStyle = r() < 0.5 ? '#1a1230' : '#160f2a';
      fg.fillRect(x, 100 - bh, bw, bh);
      fg.fillStyle = '#2a2044'; fg.fillRect(x, 100 - bh, bw, 1);
      for (let wy = 100 - bh + 4; wy < 36; wy += 6) for (let wx = x + 3; wx < x + bw - 3; wx += 5) if (r() < 0.1) { fg.fillStyle = r() < 0.7 ? '#ffd23f' : '#9adcff'; fg.fillRect(wx, wy, 2, 2); }
      if (r() < 0.2) { fg.fillStyle = '#ff5a3a'; fg.fillRect(x + ((bw / 2) | 0), 100 - bh - 6, 1, 6); fg.fillRect(x + ((bw / 2) | 0) - 1, 100 - bh - 7, 3, 1); }
      x += bw + 1 + ((r() * 3) | 0);
    }
    this.far = far;

    // near: storefronts (parallax 1)
    const near = document.createElement('canvas'); near.width = STAGE_LEN + W; near.height = H;
    const ng = near.getContext('2d');
    const shops = [
      { name: 'BURGER', cjk: '漢堡', col: '#e23c2c', acc: '#ffd23f' }, { name: 'CHICKEN', cjk: '炸雞', col: '#e07a1f', acc: '#fff6e5' },
      { name: 'COLA', cjk: '可樂', col: '#b02030', acc: '#fff6e5' }, { name: 'PIZZA', cjk: '披薩', col: '#2f7a3a', acc: '#ffd23f' },
      { name: 'FRIES', cjk: '薯條', col: '#d9a020', acc: '#e23c2c' }, { name: 'HOTDOG', cjk: '熱狗', col: '#6a3a9a', acc: '#ffd23f' },
      { name: '24H', cjk: '速食', col: '#1f6fb0', acc: '#fff6e5' }, { name: 'DONUT', cjk: '甜甜圈', col: '#d04a8a', acc: '#fff6e5' },
    ];
    x = 0; let si = 0;
    while (x < near.width) {
      const sw = 96 + ((r() * 40) | 0);
      const s = shops[si++ % shops.length];
      // wall
      ng.fillStyle = (si % 2) ? '#5a4a6a' : '#4e4260'; ng.fillRect(x, 34, sw, 72);
      ng.fillStyle = '#3c3350'; ng.fillRect(x, 34, sw, 3);
      // brick texture
      ng.fillStyle = 'rgba(0,0,0,0.12)';
      for (let by = 40; by < 60; by += 4) for (let bx = x + ((by / 4) % 2) * 3; bx < x + sw; bx += 7) ng.fillRect(bx, by, 5, 2);
      // sign board
      ng.fillStyle = '#1b1026'; ng.fillRect(x + 6, 40, sw - 12, 20);
      ng.fillStyle = s.col; ng.fillRect(x + 8, 42, sw - 16, 16);
      pixelText(ng, s.name, x + sw / 2, 46, s.acc, 2, 'center', true);
      // neon cjk on the side
      ng.font = CJK; ng.textAlign = 'left'; ng.fillStyle = '#1b1026'; ng.fillText(s.cjk, x + 9, 72); ng.fillStyle = s.acc; ng.fillText(s.cjk, x + 8, 71);
      // awning
      for (let ax = x + 4; ax < x + sw - 4; ax += 6) { ng.fillStyle = ((ax - x) / 6) % 2 ? s.col : '#fff6e5'; ng.fillRect(ax, 62, 6, 7); }
      ng.fillStyle = '#1b1026'; ng.fillRect(x + 4, 69, sw - 8, 1);
      // window + door
      ng.fillStyle = '#1b1026'; ng.fillRect(x + 10, 74, sw - 44, 28); ng.fillStyle = '#2a3a6a'; ng.fillRect(x + 12, 76, sw - 48, 24);
      ng.fillStyle = 'rgba(255,255,255,0.15)'; ng.fillRect(x + 14, 78, 6, 20);
      ng.fillStyle = '#1b1026'; ng.fillRect(x + sw - 30, 74, 20, 32); ng.fillStyle = s.col; ng.fillRect(x + sw - 28, 76, 16, 30); ng.fillStyle = '#ffd23f'; ng.fillRect(x + sw - 16, 90, 2, 2);
      // occasional lamp post / trash can
      if (r() < 0.6) { ng.fillStyle = '#1b1026'; ng.fillRect(x + sw - 3, 50, 2, 56); ng.fillStyle = '#ffd23f'; ng.fillRect(x + sw - 5, 47, 6, 4); }
      x += sw;
    }
    // sidewalk
    ng.fillStyle = '#9a8ea8'; ng.fillRect(0, 100, near.width, 7);
    ng.fillStyle = '#7d7290'; for (let sx = 0; sx < near.width; sx += 16) ng.fillRect(sx, 100, 1, 7);
    ng.fillStyle = '#b8adc6'; ng.fillRect(0, 100, near.width, 1);
    ng.fillStyle = '#5f5572'; ng.fillRect(0, 106, near.width, 1);
    this.near = near;
  }

  tintOf(spr, color) {
    const key = spr.img.width + ':' + spr.img.height + ':' + color;
    let m = this.tint.get(spr); if (!m) { m = new Map(); this.tint.set(spr, m); }
    if (m.has(color)) return m.get(color);
    const mk = (src) => { const c = document.createElement('canvas'); c.width = src.width; c.height = src.height; const g = c.getContext('2d'); g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height); return c; };
    const r = { img: mk(spr.img), flip: mk(spr.flip), w: spr.w, h: spr.h };
    m.set(color, r); return r;
  }

  // ---------------------------------------------------------------- frame
  draw(view, fx, opts) {
    const g = this.g; this.frame++;
    const camX = view.cam;
    g.imageSmoothingEnabled = false;
    // sky
    const sky = g.createLinearGradient(0, 0, 0, 100);
    sky.addColorStop(0, '#2a1a4e'); sky.addColorStop(0.4, '#5a2a66'); sky.addColorStop(0.75, '#b84a52'); sky.addColorStop(1, '#f0a040');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    // chunky sun
    g.fillStyle = '#ffd23f'; g.fillRect(226, 58, 24, 4); g.fillRect(222, 62, 32, 4); g.fillRect(220, 66, 36, 6); g.fillRect(222, 72, 32, 4); g.fillRect(226, 76, 24, 4);
    g.fillStyle = '#ff9a3a'; g.fillRect(222, 70, 32, 2); g.fillRect(226, 78, 24, 2);

    g.save();
    // camera: zoom punch + shake
    g.translate(W / 2, H / 2); g.scale(fx.zoom, fx.zoom); g.translate(-W / 2 + fx.shakeX, -H / 2 + fx.shakeY);

    g.drawImage(this.far, -Math.round(camX * 0.35) % (this.far.width - W) - 0, 0);
    g.drawImage(this.near, -Math.round(camX), 0);
    // road
    g.fillStyle = '#3b3548'; g.fillRect(-8, FLOOR_TOP + 1, W + 16, H - FLOOR_TOP);
    g.fillStyle = '#332d40'; g.fillRect(-8, FLOOR_TOP + 1, W + 16, 1);
    g.fillStyle = '#4a4458'; for (let i = -1; i < 12; i++) { const lx = ((i * 48 - (camX % 48)) | 0); g.fillRect(lx, 140, 22, 2); }
    g.fillStyle = '#2b2636'; g.fillRect(-8, FLOOR_BOT + 4, W + 16, H);
    g.fillStyle = '#ffd23f'; for (let i = -1; i < 12; i++) { const lx = ((i * 48 - (camX % 48)) | 0); g.fillRect(lx + 10, FLOOR_BOT + 6, 20, 1); }

    fx.drawGround(g, camX);

    // entities sorted by ground y
    const ents = [];
    for (const p of view.P) ents.push({ k: 'p', e: p, y: p.y });
    for (const e of view.E) ents.push({ k: 'e', e, y: e.y });
    for (const j of view.J) ents.push({ k: 'j', e: j, y: j.y });
    for (const k of view.K) ents.push({ k: 'k', e: k, y: k.y });
    ents.sort((a, b) => a.y - b.y);
    // shadows first
    for (const it of ents) this.drawShadow(g, it, camX);
    for (const it of ents) {
      if (it.k === 'p') this.drawPlayer(g, it.e, camX, fx, opts);
      else if (it.k === 'e') this.drawEnemy(g, it.e, camX, fx);
      else if (it.k === 'j') this.drawProj(g, it.e, camX, fx);
      else this.drawPickup(g, it.e, camX);
    }
    fx.drawAir(g, camX);
    this.drawTexts(g, fx, camX);
    g.restore();

    // screen flash
    if (fx.flash > 0) { g.globalAlpha = Math.min(1, fx.flash); g.fillStyle = fx.flashColor; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
    this.drawHud(g, view, fx, opts);
  }

  drawShadow(g, it, camX) {
    const e = it.e;
    if (it.k === 'p' && e.state === 'dead' && e.z <= 0) return;
    if (it.k === 'e' && (e.state === 'gone')) return;
    const w = it.k === 'j' ? (e.type === 'meteor' ? 30 : 5) : it.k === 'k' ? 6 : (ENEMIES[e.type] ? ENEMIES[e.type].w : 12) * 0.8;
    const sx = Math.round(e.x - camX), sy = Math.round(e.y);
    const sc = Math.max(0.35, 1 - e.z / 160);
    g.globalAlpha = 0.35 * sc + 0.1; g.fillStyle = '#120c18';
    g.beginPath(); g.ellipse(sx, sy, w * sc + 2, 2.5 * sc + 1, 0, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
  }

  blit(g, spr, sx, sy, dir, rot = 0, alpha = 1) {
    const img = dir < 0 ? spr.flip : spr.img;
    if (alpha !== 1) g.globalAlpha = alpha;
    if (rot) { g.save(); g.translate(sx, sy - spr.h / 2); g.rotate(rot); g.drawImage(img, -spr.w / 2, -spr.h / 2); g.restore(); }
    else g.drawImage(img, Math.round(sx - spr.w / 2), Math.round(sy - spr.h));
    if (alpha !== 1) g.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- player
  drawPlayer(g, p, camX, fx, opts) {
    const sx = Math.round(p.x - camX), sy = Math.round(p.y - p.z);
    const w = WEAPONS[p.weapon];
    let pose = 'idle0', rot = 0, mdef = null;
    const st = p.st;
    switch (p.state) {
      case 'idle': pose = ((st / 30) | 0) % 2 ? 'idle1' : 'idle0'; break;
      case 'walk': pose = 'walk' + (((st / 6) | 0) % 4); break;
      case 'jump': case 'spawn': pose = 'jump'; break;
      case 'attack': { mdef = p.mv >= 0 ? w.combo[p.mv] : null; if (mdef && p.alt && mdef.alt) mdef = mdef.alt; if (mdef) { const first = mdef.hits ? mdef.hits[0].from : (mdef.proj ? mdef.proj.at : 0); pose = (st < first - 2 && (mdef.pose === 'swing' || mdef.pose === 'slam')) ? 'windup' : mdef.pose; } break; }
      case 'airatk': mdef = w.air; pose = mdef.pose; break;
      case 'dash': pose = 'dash'; break;
      case 'hurt': pose = 'hurt'; break;
      case 'launched': pose = 'hurt'; rot = (p.vz > 0 ? -0.5 : 0.6) * p.dir; break;
      case 'down': case 'dead': pose = 'hurt'; rot = -Math.PI / 2 * p.dir; break;
      case 'getup': pose = 'getup'; break;
      case 'special': pose = 'raise'; break;
      case 'recover': pose = 'slam'; break;
      default: pose = 'idle0';
    }
    if (p.state === 'down' || p.state === 'dead') { const spr = charSprite('player', 'hurt'); this.blit(g, spr, sx, sy + 8, p.dir, rot); }
    else {
      const spr = charSprite('player', pose);
      const blink = p.inv > 0 && p.state !== 'special' && p.state !== 'spawn' && ((this.frame >> 2) & 1);
      const rest = p.state === 'idle' || p.state === 'walk' || p.state === 'jump' || p.state === 'spawn' || p.state === 'getup' || p.state === 'recover';
      const drawBody = () => {
        if (blink) return;
        if (p.flash > 0 && (p.flash & 1)) this.blit(g, whiteOf(spr), sx, sy, p.dir, rot);
        else this.blit(g, spr, sx, sy, p.dir, rot, p.state === 'dash' ? 0.85 : 1);
      };
      if (!rest) drawBody();
      // weapon
      if (p.state !== 'special') {
        const ws = weaponSprite(w.id);
        let ang, ax = (w.id === 'shotgun' || w.id === 'pizza') ? 5 : -3, az = 12;
        if (mdef && mdef.rot) ang = lerpAngle(mdef.rot, st);
        else if (p.state === 'dash') ang = w.id === 'shotgun' ? 90 : 120;
        else if (p.state === 'hurt' || p.state === 'launched') ang = -60;
        else ang = w.id === 'shotgun' ? 80 : w.id === 'pizza' ? 20 : -42 + ((pose.startsWith('walk')) ? Math.sin(st * 0.5) * 5 : 0);
        if (pose === 'swing' || pose === 'throw') { ax = 7; az = 13; } else if (pose === 'thrust' || pose === 'shoot' || pose === 'dash') { ax = 8; az = 11; } else if (pose === 'windup') { ax = -3; az = 14; } else if (pose === 'spin') { ax = 0; az = 13; } else if (pose === 'slam') { ax = 4; az = 9; }
        const hideSaw = w.id === 'pizza' && p.alt; // pizza is in flight
        if (!hideSaw || (mdef && mdef.pose !== 'throw')) {
          if (!(w.id === 'pizza' && p.alt && p.state === 'attack')) {
            g.save(); g.translate(sx + p.dir * ax, sy - az); g.scale(p.dir, 1); g.rotate(ang * Math.PI / 180);
            if (p.flash > 0 && (p.flash & 1)) g.drawImage(whiteOf(ws).img, -ws.pivot[0], -ws.pivot[1]); else g.drawImage(ws.img, -ws.pivot[0], -ws.pivot[1]);
            g.restore();
          }
        }
        if (rest) drawBody();
      } else {
        drawBody();
        // special pose: giant pointing finger / burger halo
        const bs = miscSprite('burger'); const bob = Math.sin(st * 0.4) * 2;
        this.blit(g, bs, sx, sy - 30 + bob, 1);
      }
      // dash cola jet trail
      if (p.state === 'dash' && fx) fx.part({ x: p.x - p.dir * 8, y: p.y, z: p.z + 8 + Math.random() * 8, vx: -p.dir * 2, vz: Math.random(), life: 12, size: 2, kind: 'fizz', color: Math.random() < 0.5 ? '#6b3a1a' : '#fff6e5' });
    }
    // name tag (dim), SP ready marker
    const local = opts.localId === p.id;
    g.font = CJK_S; g.textAlign = 'center';
    const tag = (local ? '▶' : '') + p.name;
    g.fillStyle = '#1b1026'; g.fillText(tag, sx + 1, sy - 28 + 1); g.fillStyle = local ? '#ffd23f' : '#fff6e5'; g.fillText(tag, sx, sy - 28);
    if (p.meter >= METER_MAX && ((this.frame >> 3) & 1)) pixelText(g, 'SP!', sx, sy - 37, '#ffd23f', 1, 'center');
  }

  // ---------------------------------------------------------------- enemies
  drawEnemy(g, e, camX, fx) {
    if (e.state === 'gone' || e.state === 'spawn') return;
    const d = ENEMIES[e.type];
    const sx = Math.round(e.x - camX), sy = Math.round(e.y - e.z);
    let pose = 'idle0', rot = 0;
    const st = e.st;
    switch (e.state) {
      case 'idle': pose = ((st / 30) | 0) % 2 ? 'idle1' : 'idle0'; break;
      case 'walk': pose = 'walk' + (((st / 7) | 0) % 4); break;
      case 'windup': pose = e.ak === 'slam' ? 'raise' : 'windup'; break;
      case 'attack': pose = e.ak === 'ranged' ? 'throw' : e.ak === 'slam' ? 'slam' : e.ak === 'hop' ? 'jump' : e.ak === 'charge' ? 'dash' : 'swing'; break;
      case 'hurt': pose = 'hurt'; break;
      case 'launched': pose = 'hurt'; rot = (e.vz > 0 ? -0.6 : 0.7) * -e.dir; break;
      case 'dying': pose = 'hurt'; rot = (st * 0.35) * -e.dir; break;
      case 'down': pose = 'hurt'; rot = Math.PI / 2 * e.dir; break;
      case 'getup': pose = 'getup'; break;
      case 'buried': pose = 'hurt'; break;
      default: pose = 'idle0';
    }
    const spr = bodySprite(e.type, e.type === 'roll' ? (e.state === 'attack' && e.ak === 'charge' ? 'roll' : 'idle') : pose);
    const flashOn = e.flash > 0 && (e.flash & 1);
    const windupOn = e.state === 'windup' && ((this.frame >> 2) & 1);
    const img = flashOn ? whiteOf(spr) : windupOn ? this.tintOf(spr, '#ff3a2a') : spr;
    if (e.state === 'buried') {
      // half sunk into the ground: clip the bottom half and draw a dirt mound
      g.save(); g.beginPath(); g.rect(sx - 20, sy - spr.h, 40, spr.h * 0.55); g.clip();
      const wob = Math.sin(st * 0.6) * 1.5;
      this.blit(g, img, sx + wob, sy + spr.h * 0.45, e.dir, 0);
      g.restore();
      g.fillStyle = '#5a4a3a'; g.beginPath(); g.ellipse(sx, sy - spr.h * 0.42, 12, 4, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#7a6a4a'; g.beginPath(); g.ellipse(sx, sy - spr.h * 0.42 - 1, 9, 2.5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#3a3038'; g.fillRect(sx - 14, sy - spr.h * 0.42 + 2, 28, 1);
      g.font = CJK_S; g.textAlign = 'center'; g.fillStyle = '#1b1026'; g.fillText('埋進土裡!', sx + 1, sy - spr.h * 0.42 - 8 + 1); g.fillStyle = '#ffd23f'; g.fillText('埋進土裡!', sx, sy - spr.h * 0.42 - 8);
    } else if (e.state === 'down') {
      this.blit(g, img, sx, sy + spr.h * 0.3, e.dir, rot);
    } else if (e.state === 'dying') {
      this.blit(g, img, sx, sy + spr.h * 0.5, e.dir, rot);
      if (fx && (this.frame & 1)) fx.part({ x: e.x, y: e.y, z: e.z + 10, vx: 0, vz: 0.5, life: 10, size: 2, kind: 'star', color: '#ffd23f' });
    } else {
      this.blit(g, img, sx, sy, e.dir, rot);
    }
    // monk staff / boss ladle hint, charge trail
    if (e.type === 'roll' && e.state === 'attack' && e.ak === 'charge' && fx && (this.frame & 1)) fx.part({ x: e.x - e.dir * 8, y: e.y, z: 2, vx: -e.dir, vz: 0.6, life: 12, size: 3, kind: 'dust', color: '#c9b89a' });
    if (e.state === 'windup' && e.ak === 'slam') { g.fillStyle = ((this.frame >> 2) & 1) ? '#ff3a2a' : '#ffd23f'; pixelText(g, '!', sx, sy - spr.h - 10, g.fillStyle, 2, 'center'); }
    // name + hp bar
    if (e.state !== 'dying' && e.state !== 'buried') {
      const top = sy - spr.h - 3 - (e.state === 'down' ? -spr.h * 0.6 : 0);
      const showName = d.boss || e.hp < e.maxHp || e.state === 'windup' || e.state === 'attack';
      if (showName) { g.font = CJK_S; g.textAlign = 'center'; g.fillStyle = '#1b1026'; g.fillText(d.name, sx + 1, top - 3); g.fillStyle = d.boss ? '#ff9a3a' : e.state === 'windup' ? '#ff5a3a' : '#f3d9ff'; g.fillText(d.name, sx, top - 4); }
      if (e.hp < e.maxHp && !d.boss) {
        const bw = 16; const f = Math.max(0, e.hp / e.maxHp);
        g.fillStyle = '#1b1026'; g.fillRect(sx - bw / 2 - 1, top - 2, bw + 2, 4);
        g.fillStyle = '#5a1a1a'; g.fillRect(sx - bw / 2, top - 1, bw, 2);
        g.fillStyle = f > 0.5 ? '#6cf05a' : f > 0.25 ? '#ffd23f' : '#ff5a3a'; g.fillRect(sx - bw / 2, top - 1, Math.round(bw * f), 2);
      }
    }
  }

  // ---------------------------------------------------------------- projectiles / pickups
  drawProj(g, j, camX, fx) {
    const sx = Math.round(j.x - camX), sy = Math.round(j.y - j.z);
    if (j.type === 'nugget') { this.blit(g, miscSprite('nugget'), sx, sy + 2, 1); }
    else if (j.type === 'sushi') { this.blit(g, miscSprite('sushi'), sx, sy + 2, 1, j.t * 0.3); }
    else if (j.type === 'pizza') {
      const ws = weaponSprite('pizza');
      g.save(); g.translate(sx, sy); g.rotate(j.t * 0.5 * (j.dir || 1)); g.drawImage(ws.img, -7, -7); g.restore();
      if (fx && (this.frame & 1)) fx.part({ x: j.x, y: j.y, z: j.z + Math.random() * 6 - 3, vx: -(j.vx || 0) * 0.2, life: 8, size: 1, kind: 'spark', color: '#ffd23f' });
    }
    else if (j.type === 'meteor') {
      const ms = miscSprite('meteor');
      this.blit(g, ms, sx, sy + 8, 1);
      if (fx) for (let i = 0; i < 3; i++) fx.part({ x: j.x + (Math.random() * 20 - 10), y: j.y + (Math.random() * 6 - 3), z: j.z + 12 + Math.random() * 10, vx: Math.random() - 0.5, vz: Math.random() * 2 + 1, life: 10 + Math.random() * 8, size: 2 + (Math.random() * 2 | 0), kind: 'spark', color: Math.random() < 0.5 ? '#ff9a3a' : '#ffd23f' });
    }
  }
  drawPickup(g, k, camX) {
    const sx = Math.round(k.x - camX), sy = Math.round(k.y - k.z - 2 - Math.abs(Math.sin(this.frame * 0.08)) * 3);
    const spr = miscSprite(k.type);
    if (k.life < 120 && ((this.frame >> 2) & 1)) return;
    this.blit(g, spr, sx, sy, 1);
  }

  drawTexts(g, fx, camX) {
    for (const t of fx.texts) {
      const sx = Math.round(t.x - camX), sy = Math.round(t.y - t.z);
      const a = Math.min(1, t.life / 12);
      g.globalAlpha = a;
      if (t.kind === 'cjk') { g.font = CJK; g.textAlign = 'center'; g.fillStyle = '#1b1026'; g.fillText(t.str, sx + 1, sy + 1); g.fillStyle = t.color; g.fillText(t.str, sx, sy); }
      else { const wob = t.scale > 1 ? Math.round(Math.sin(t.life * 0.8) * 1) : 0; pixelText(g, t.str, sx + wob, sy, t.color, t.scale, 'center'); }
      g.globalAlpha = 1;
    }
  }

  // ---------------------------------------------------------------- HUD
  drawHud(g, view, fx, opts) {
    const ps = view.P;
    const corners = [[4, 4], [W - 4, 4], [4, 40], [W - 4, 40]];
    ps.forEach((p, i) => {
      const slot = Math.min(3, p.slot);
      const [cx, cy] = corners[slot]; const right = slot % 2 === 1;
      const x0 = right ? cx - 78 : cx;
      const local = opts.localId === p.id;
      g.fillStyle = 'rgba(18,12,36,0.72)'; g.fillRect(x0 - 3, cy - 2, 86, 32);
      // name + lives
      pixelText(g, p.name, x0, cy, local ? '#ffd23f' : '#fff6e5', 1);
      const cap = miscSprite('cap');
      for (let l = 0; l < p.lives; l++) g.drawImage(cap.img, x0 + 44 + l * 8, cy - 1);
      // hp bar (chunky, segmented)
      const bw = 64, bh = 5; const f = Math.max(0, p.hp / p.maxHp);
      g.fillStyle = '#1b1026'; g.fillRect(x0 - 1, cy + 7, bw + 2, bh + 2);
      g.fillStyle = '#4a1a1a'; g.fillRect(x0, cy + 8, bw, bh);
      g.fillStyle = f > 0.5 ? '#6cf05a' : f > 0.25 ? '#ffd23f' : ((this.frame >> 3) & 1 ? '#ff5a3a' : '#ff9a3a');
      g.fillRect(x0, cy + 8, Math.round(bw * f), bh);
      g.fillStyle = 'rgba(0,0,0,0.25)'; for (let s = 8; s < bw; s += 8) g.fillRect(x0 + s, cy + 8, 1, bh);
      // meter
      const mf = p.meter / METER_MAX;
      g.fillStyle = '#1b1026'; g.fillRect(x0 - 1, cy + 14, bw + 2, 4);
      g.fillStyle = '#3a3020'; g.fillRect(x0, cy + 15, bw, 2);
      g.fillStyle = mf >= 1 ? ((this.frame >> 2) & 1 ? '#ffffff' : '#ffd23f') : '#e8a020'; g.fillRect(x0, cy + 15, Math.round(bw * mf), 2);
      // weapon icon + name
      const w = WEAPONS[p.weapon]; const ws = weaponSprite(w.id);
      g.fillStyle = '#1b1026'; g.fillRect(x0 + bw + 3, cy + 6, 13, 13); g.fillStyle = '#2a2238'; g.fillRect(x0 + bw + 4, cy + 7, 11, 11);
      const sc = Math.min(11 / ws.w, 11 / ws.h);
      g.drawImage(ws.img, Math.round(x0 + bw + 4 + (11 - ws.w * sc) / 2), Math.round(cy + 7 + (11 - ws.h * sc) / 2), Math.round(ws.w * sc), Math.round(ws.h * sc));
      g.font = CJK; g.textAlign = 'left'; g.fillStyle = '#1b1026'; g.fillText(w.name, x0 + 1, cy + 28); g.fillStyle = w.color; g.fillText(w.name, x0, cy + 27);
      // combo
      if (p.hits >= 2 && p.comboT > 0) {
        const cxx = right ? x0 - 6 : x0 + bw + 24;
        const scale = p.hits >= 20 ? 2 : p.hits >= 8 ? 2 : 1;
        const col = p.hits >= 30 ? '#ff5a3a' : p.hits >= 15 ? '#ff9a3a' : p.hits >= 8 ? '#ffd23f' : '#fff6e5';
        const wob = p.comboT > 94 ? Math.round(Math.random() * 2 - 1) : 0;
        pixelText(g, p.hits + ' HITS', cxx + wob, cy + 8 + wob, col, scale, right ? 'right' : 'left');
      }
    });
    // score / wave top center
    g.fillStyle = 'rgba(18,12,36,0.6)'; g.fillRect(W / 2 - 34, 2, 68, 18);
    pixelText(g, 'SCORE ' + String(view.score).padStart(6, '0'), W / 2, 4, '#fff6e5', 1, 'center');
    if (view.ph === 'play' || view.ph === 'clear') pixelText(g, 'WAVE ' + Math.max(1, view.wave + 1) + '/' + STAGE.waves.length + (view.loop ? ' LOOP' + (view.loop + 1) : ''), W / 2, 12, '#b8adc6', 1, 'center');
    if (view.ph === 'lobby') pixelText(g, 'WARM UP', W / 2, 12, '#b8adc6', 1, 'center');
    // boss bar
    const boss = view.E.find(e => e.type === 'boss' && e.state !== 'gone');
    if (boss) {
      const bw = 160, x0 = W / 2 - bw / 2, y0 = H - 14; const f = Math.max(0, boss.hp / boss.maxHp);
      g.font = CJK_S; g.textAlign = 'center'; g.fillStyle = '#1b1026'; g.fillText(ENEMIES.boss.name, W / 2 + 1, y0 - 2); g.fillStyle = '#ff9a3a'; g.fillText(ENEMIES.boss.name, W / 2, y0 - 3);
      g.fillStyle = '#1b1026'; g.fillRect(x0 - 1, y0, bw + 2, 6);
      g.fillStyle = '#4a1a1a'; g.fillRect(x0, y0 + 1, bw, 4);
      g.fillStyle = boss.flash > 0 ? '#ffffff' : '#ff3a2a'; g.fillRect(x0, y0 + 1, Math.round(bw * f), 4);
      g.fillStyle = 'rgba(0,0,0,0.3)'; for (let s = 16; s < bw; s += 16) g.fillRect(x0 + s, y0 + 1, 1, 4);
    }
    // GO arrow
    if (fx.goArrow > 0 && ((this.frame >> 4) & 1)) { pixelText(g, 'GO', W - 36, H / 2 - 6, '#ffd23f', 2, 'left'); pixelText(g, '>>', W - 16, H / 2 - 6, '#ff9a3a', 2, 'left'); }
    // banner
    if (fx.banner) {
      const b = fx.banner; const age = b.maxLife - b.life;
      const slide = age < 10 ? (10 - age) * 8 : 0;
      const alpha = b.life < 15 ? b.life / 15 : 1;
      g.globalAlpha = alpha * 0.75; g.fillStyle = '#1b1026'; g.fillRect(0, H / 2 - 22, W, 36); g.globalAlpha = alpha;
      pixelText(g, b.str, W / 2 - slide, H / 2 - 16, b.color, 3, 'center');
      if (b.sub) { g.font = CJK; g.textAlign = 'center'; g.fillStyle = '#1b1026'; g.fillText(b.sub, W / 2 + 1, H / 2 + 10); g.fillStyle = '#fff6e5'; g.fillText(b.sub, W / 2, H / 2 + 9); }
      g.globalAlpha = 1;
    }
    if (view.ph === 'over' && !fx.banner) fx.setBanner('GAME OVER', '按攻擊鍵 再來一次', 100000, '#ff5a3a');
  }
}

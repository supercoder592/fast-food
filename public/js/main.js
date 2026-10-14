// Bootstrap: menus, offline loop, online loop, HUD overlays.
import { IN, PHASE, W, H } from '../sim/constants.js';
import { createSim, addPlayer, startGame, step, snapshot } from '../sim/sim.js';
import { WEAPONS } from '../sim/weapons.js';
import { Renderer } from './render.js';
import { FX } from './fx.js';
import { Input } from './input.js';
import { Net } from './net.js';
import { initAudio, play, startBgm, toggleBgm, setMuted, isMuted, bgmEnabled } from './sfx.js';
import { weaponSprite, miscSprite, charSprite } from './sprites.js';

const $ = (s) => document.querySelector(s);
const canvas = $('#game');
const renderer = new Renderer(canvas);
const fx = new FX();
const input = new Input();
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
if (isTouch) { input.buildTouch($('#touch')); }

const S = { mode: null, sim: null, net: null, localId: 0, weapon: 0, name: '', last: 0, acc: 0, view: null, sendTimer: null, running: false };
let audioReady = false;
const ensureAudio = () => { if (!audioReady) { initAudio(); audioReady = true; } };
input.onAny = ensureAudio;
window.addEventListener('pointerdown', ensureAudio, { once: true });

// ---------------------------------------------------------------- menu
function buildWeaponCards() {
  const root = $('#weapons'); root.innerHTML = '';
  WEAPONS.forEach((w, i) => {
    const el = document.createElement('div'); el.className = 'card' + (i === S.weapon ? ' on' : '');
    const c = document.createElement('canvas'); c.width = 32; c.height = 32;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    const ws = charSprite(w.hero.skin, 'idle0'); const sc = Math.min(30 / ws.w, 30 / ws.h);
    g.drawImage(ws.img, Math.round((32 - ws.w * sc) / 2), Math.round((32 - ws.h * sc) / 2), Math.round(ws.w * sc), Math.round(ws.h * sc));
    el.appendChild(c);
    const hero = document.createElement('div'); hero.className = 'n'; hero.textContent = w.hero.name; el.insertBefore(hero, c);
    const n = document.createElement('div'); n.className = 'n'; n.textContent = w.name; n.style.color = w.color; el.appendChild(n);
    const d = document.createElement('div'); d.className = 'd'; d.textContent = w.hero.blurb + ' ' + w.desc; el.appendChild(d);
    el.addEventListener('click', () => { S.weapon = i; buildWeaponCards(); play('ui'); });
    root.appendChild(el);
  });
}
buildWeaponCards();
$('#name').value = localStorage.getItem('ffa_name') || '';
function getName() { const n = $('#name').value.trim() || '玩家'; localStorage.setItem('ffa_name', n); return n; }

const screens = ['menu', 'online', 'lobby'];
function show(name) {
  for (const s of screens) $('#' + s).classList.toggle('hidden', s !== name);
  $('#overlay').classList.toggle('hidden', !name);
  $('#btnLeave').classList.toggle('hidden', !S.mode);
}

$('#btnSolo').addEventListener('click', () => { ensureAudio(); startOffline(); });
$('#btnOnline').addEventListener('click', () => { ensureAudio(); $('#onlineMsg').textContent = ''; show('online'); });
$('#btnBack').addEventListener('click', () => show('menu'));
$('#btnCreate').addEventListener('click', () => startOnline(''));
$('#btnJoin').addEventListener('click', () => { const c = $('#roomCode').value.trim(); if (c.length < 4) { $('#onlineMsg').textContent = '請輸入 4 碼房間代碼'; return; } startOnline(c); });
$('#roomCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#btnJoin').click(); });
$('#btnStart').addEventListener('click', () => { if (S.net) S.net.start(); });
$('#btnLobbyLeave').addEventListener('click', leave);
$('#btnLeave').addEventListener('click', leave);
$('#btnMute').addEventListener('click', () => { ensureAudio(); setMuted(!isMuted()); $('#btnMute').classList.toggle('off', isMuted()); $('#btnMute').textContent = isMuted() ? '🔇' : '🔊'; });
$('#btnBgm').addEventListener('click', () => { ensureAudio(); const on = toggleBgm(); $('#btnBgm').classList.toggle('off', !on); });
$('#btnFull').addEventListener('click', goFullscreen);

function goFullscreen() {
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (req && !document.fullscreenElement) { try { req.call(el).catch(() => {}); } catch (e) {} }
  try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) {}
}

// ---------------------------------------------------------------- offline
function startOffline() {
  S.name = getName();
  S.mode = 'offline';
  S.sim = createSim((Math.random() * 1e9) | 0);
  const p = addPlayer(S.sim, { name: S.name, weapon: S.weapon });
  S.localId = p.id; fx.localIds = new Set([p.id]);
  startGame(S.sim);
  fx.handleEvents(S.sim.events);
  show(null);
  $('#touch').classList.toggle('hidden', !isTouch);
  $('#netInfo').textContent = '單人';
  if (isTouch) goFullscreen();
  startBgm();
  S.running = true; S.acc = 0; S.last = performance.now();
}

// ---------------------------------------------------------------- online
function wsUrl() { const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'; return proto + '//' + location.host; }
async function startOnline(code) {
  S.name = getName();
  const msg = $('#onlineMsg'); msg.textContent = '連線中…';
  const net = new Net();
  try { await net.connect(wsUrl()); }
  catch (e) { msg.textContent = '無法連上伺服器。請用 `npm start` 啟動伺服器後，從伺服器網址開啟遊戲（file:// 或純靜態網頁無法連線）。'; return; }
  S.net = net; S.mode = 'online';
  net.on('err', (m) => { msg.textContent = m; });
  net.on('closed', () => { if (S.mode === 'online') { leave(); $('#onlineMsg').textContent = '連線中斷'; show('online'); } });
  net.on('joined', (d) => {
    S.localId = d.id; fx.localIds = new Set([d.id]);
    $('#lobbyCode').textContent = d.room;
    $('#netInfo').textContent = '房間 ' + d.room;
    updateLobby({ host: d.host ? d.id : 0, players: d.players, phase: d.phase });
    show(d.phase === PHASE.LOBBY ? 'lobby' : null);
    $('#touch').classList.toggle('hidden', !isTouch);
    if (isTouch) goFullscreen();
    startBgm();
    S.running = true; S.last = performance.now();
    S.sendTimer = setInterval(() => { const { held, pressed } = input.consume(); net.sendInput(held, pressed); }, 1000 / 30);
  });
  net.on('lobby', (d) => updateLobby(d));
  net.join(code, S.name, S.weapon);
}
function updateLobby(d) {
  const ul = $('#lobbyPlayers'); ul.innerHTML = '';
  for (const p of d.players) {
    const li = document.createElement('li');
    li.innerHTML = `<span>${esc(p.name)}</span><span class="w">${WEAPONS[p.weapon] ? WEAPONS[p.weapon].hero.name + '·' + WEAPONS[p.weapon].name : ''}</span>` + (p.id === d.host ? '<span class="h">房主</span>' : '') + (p.id === S.localId ? '<span class="h">(你)</span>' : '');
    ul.appendChild(li);
  }
  const host = d.host === S.localId;
  $('#btnStart').classList.toggle('hidden', !host);
  $('#lobbyHint').textContent = host ? (d.players.length > 1 ? '大家到齊了就按開始！' : '可以一個人先開始，朋友之後也能中途加入。') : '等待房主開始…';
  if (d.phase && d.phase !== PHASE.LOBBY) show(null);
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function leave() {
  if (S.sendTimer) { clearInterval(S.sendTimer); S.sendTimer = null; }
  if (S.net) { S.net.close(); S.net = null; }
  S.mode = null; S.sim = null; S.running = false; S.view = null;
  fx.banner = null; fx.parts = []; fx.decals = []; fx.texts = []; fx.goArrow = 0;
  $('#touch').classList.add('hidden');
  $('#netInfo').textContent = '';
  show('menu');
}

// ---------------------------------------------------------------- main loop
const STEP = 1000 / 60;
let lobbyShown = false;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(50, now - S.last); S.last = now;
  if (!S.running) { drawIdle(now); return; }
  let scale = 1;
  if (S.mode === 'offline') {
    const sim = S.sim;
    if (sim.slow > 0) { scale = 0.3; sim.slow -= 1; }
    if (fx.freeze > 0) { S.acc = 0; }
    else {
      S.acc += dt * scale;
      let n = 0;
      while (S.acc >= STEP && n < 4) {
        const inp = input.consume();
        const ev = step(sim, { [S.localId]: inp });
        if (ev.length) fx.handleEvents(ev, null);
        S.acc -= STEP; n++;
        if (fx.freeze > 0) { S.acc = 0; break; }
      }
    }
    S.view = snapshot(sim);
  } else if (S.mode === 'online' && S.net) {
    const net = S.net;
    if (fx.freeze > 0) net.pausedMs += dt; else net.pausedMs = Math.max(0, net.pausedMs - dt * 0.35);
    const ev = net.drainEvents();
    if (ev.length) fx.handleEvents(ev, null);
    const v = net.getView(now);
    if (v) S.view = v;
    if (S.view) {
      const inLobby = S.view.ph === PHASE.LOBBY;
      if (inLobby !== lobbyShown) { lobbyShown = inLobby; show(inLobby ? 'lobby' : null); }
      $('#netInfo').textContent = '房間 ' + net.room + ' · ' + net.rtt + 'ms';
    }
  }
  fx.update(scale);
  if (S.view) renderer.draw(S.view, fx, { localId: S.localId, mode: S.mode });
}
// attract-mode background while in menus
let idleView = null, idleSim = null, idleAcc = 0;
function drawIdle(now) {
  if (!idleSim) { idleSim = createSim(7); const p = addPlayer(idleSim, { name: 'DEMO', weapon: 0 }); idleSim.phase = PHASE.LOBBY; p.state = 'idle'; p.z = 0; }
  idleAcc += 16;
  while (idleAcc >= STEP) { step(idleSim, {}); idleAcc -= STEP; }
  idleView = snapshot(idleSim);
  fx.update(1);
  renderer.draw(idleView, fx, { localId: 0, mode: null });
}
requestAnimationFrame((t) => { S.last = t; loop(t); });

// keep the keyboard from scrolling the page on space/arrows
window.addEventListener('keydown', (e) => { if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key) && S.running) e.preventDefault(); });
// auto-join via ?room=CODE
const qp = new URLSearchParams(location.search);
if (qp.get('room')) { $('#roomCode').value = qp.get('room').toUpperCase(); show('online'); }
window.__S = S; window.__fx = fx; window.__input = input;

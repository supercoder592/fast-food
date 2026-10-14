// Authoritative game server: serves ./public and runs one simulation per room over WebSocket.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { createSim, addPlayer, removePlayer, startGame, step, snapshot } from './public/sim/sim.js';
import { TICK_RATE, SNAPSHOT_EVERY, MAX_PLAYERS, PHASE } from './public/sim/constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, 'public');
const PORT = process.env.PORT || 3000;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

const server = http.createServer((req, res) => {
  let url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/') url = '/index.html';
  if (url === '/health') { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok'); return; }
  const file = path.normalize(path.join(PUBLIC, url));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });
const rooms = new Map();
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeCode = () => { let c = ''; for (let i = 0; i < 4; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]; return rooms.has(c) ? makeCode() : c; };

function getRoom(code) {
  let r = rooms.get(code);
  if (r) return r;
  r = { code, sim: createSim((Math.random() * 1e9) | 0), clients: new Map(), inputs: {}, pendingEv: [], acc: 0, last: Date.now(), hostId: 0, tickN: 0 };
  r.timer = setInterval(() => tickRoom(r), 1000 / TICK_RATE);
  rooms.set(code, r);
  console.log('[room] created', code);
  return r;
}

function tickRoom(r) {
  const now = Date.now();
  r.acc += Math.min(250, now - r.last); r.last = now;
  const dt = 1000 / TICK_RATE;
  let n = 0;
  while (r.acc >= dt && n < 6) {
    r.acc -= dt; n++;
    const inputs = {};
    for (const [ws, c] of r.clients) { inputs[c.id] = { held: c.held, pressed: c.pressed }; c.pressed = 0; }
    const ev = step(r.sim, inputs);
    if (ev.length) r.pendingEv.push(...ev);
    r.tickN++;
    if (r.tickN % SNAPSHOT_EVERY === 0) {
      const snap = snapshot(r.sim); snap.ev = r.pendingEv; r.pendingEv = [];
      const msg = JSON.stringify({ t: 's', ...snap });
      for (const ws of r.clients.keys()) if (ws.readyState === 1) ws.send(msg);
    }
  }
}

function lobbyMsg(r) {
  return JSON.stringify({ t: 'lobby', host: r.hostId, phase: r.sim.phase, players: r.sim.players.map(p => ({ id: p.id, name: p.name, weapon: p.weapon, slot: p.slot })) });
}
function broadcastLobby(r) { const m = lobbyMsg(r); for (const ws of r.clients.keys()) if (ws.readyState === 1) ws.send(m); }

wss.on('connection', (ws) => {
  let room = null, me = null;
  ws.on('message', (raw) => {
    let d; try { d = JSON.parse(raw); } catch (e) { return; }
    if (d.t === 'ping') { ws.send(JSON.stringify({ t: 'pong', at: d.at })); return; }
    if (d.t === 'join') {
      if (room) return;
      let code = String(d.room || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
      if (!code) code = makeCode();
      const r = getRoom(code);
      if (r.clients.size >= MAX_PLAYERS) { ws.send(JSON.stringify({ t: 'err', msg: '房間已滿 (最多 4 人)' })); return; }
      const name = String(d.name || 'P').replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 8) || 'P' + (r.clients.size + 1);
      const p = addPlayer(r.sim, { name, weapon: d.weapon | 0 });
      if (!p) { ws.send(JSON.stringify({ t: 'err', msg: '房間已滿' })); return; }
      me = { id: p.id, held: 0, pressed: 0, name };
      room = r; r.clients.set(ws, me);
      if (!r.hostId) r.hostId = p.id;
      ws.send(JSON.stringify({ t: 'joined', id: p.id, room: code, host: r.hostId === p.id, phase: r.sim.phase, players: r.sim.players.map(q => ({ id: q.id, name: q.name, weapon: q.weapon })) }));
      broadcastLobby(r);
      console.log('[room]', code, 'join', name, '(' + r.clients.size + ')');
      return;
    }
    if (!room || !me) return;
    if (d.t === 'i') { me.held = d.h | 0; me.pressed |= d.p | 0; return; }
    if (d.t === 'weapon') { const p = room.sim.players.find(q => q.id === me.id); if (p && room.sim.phase === PHASE.LOBBY) { p.weapon = Math.max(0, Math.min(4, d.w | 0)); broadcastLobby(room); } return; }
    if (d.t === 'start') {
      if (room.hostId !== me.id) return;
      if (room.sim.phase === PHASE.LOBBY || room.sim.phase === PHASE.OVER) { startGame(room.sim); room.pendingEv.push(...room.sim.events); broadcastLobby(room); console.log('[room]', room.code, 'start'); }
      return;
    }
  });
  ws.on('close', () => {
    if (!room || !me) return;
    room.clients.delete(ws);
    removePlayer(room.sim, me.id);
    delete room.inputs[me.id];
    if (room.hostId === me.id) { const first = room.clients.values().next().value; room.hostId = first ? first.id : 0; }
    console.log('[room]', room.code, 'leave', me.name, '(' + room.clients.size + ')');
    if (room.clients.size === 0) { clearInterval(room.timer); rooms.delete(room.code); console.log('[room] closed', room.code); }
    else broadcastLobby(room);
  });
});

server.listen(PORT, () => console.log(`FAST FOOD ARCADE server → http://localhost:${PORT}`));

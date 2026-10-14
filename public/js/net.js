// WebSocket client with snapshot interpolation for online co-op.
export class Net {
  constructor() {
    this.ws = null; this.id = 0; this.room = ''; this.host = false; this.players = [];
    this.buf = []; this.evQueue = []; this.handlers = {}; this.delay = 90; this.pausedMs = 0; this.connected = false; this.rtt = 0;
  }
  on(t, fn) { this.handlers[t] = fn; }
  emit(t, d) { if (this.handlers[t]) this.handlers[t](d); }
  connect(url) {
    return new Promise((resolve, reject) => {
      let ws;
      try { ws = new WebSocket(url); } catch (e) { reject(e); return; }
      this.ws = ws;
      const timer = setTimeout(() => { if (!this.connected) { reject(new Error('timeout')); try { ws.close(); } catch (e) {} } }, 6000);
      ws.onopen = () => { this.connected = true; clearTimeout(timer); resolve(); this.pingLoop(); };
      ws.onerror = () => { if (!this.connected) { clearTimeout(timer); reject(new Error('connect failed')); } };
      ws.onclose = () => { const was = this.connected; this.connected = false; if (was) this.emit('closed'); };
      ws.onmessage = (m) => { let d; try { d = JSON.parse(m.data); } catch (e) { return; } this.handle(d); };
    });
  }
  pingLoop() { this.pingTimer = setInterval(() => { if (this.connected) this.send({ t: 'ping', at: performance.now() }); }, 2000); }
  close() { if (this.pingTimer) clearInterval(this.pingTimer); if (this.ws) { try { this.ws.close(); } catch (e) {} } this.ws = null; this.connected = false; }
  send(o) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); }
  join(room, name, weapon, mode = 'coop') { this.send({ t: 'join', room, name, weapon, mode }); }
  start() { this.send({ t: 'start' }); }
  sendInput(held, pressed) { this.send({ t: 'i', h: held, p: pressed }); }
  setWeapon(w) { this.send({ t: 'weapon', w }); }
  handle(d) {
    switch (d.t) {
      case 'joined': this.id = d.id; this.room = d.room; this.host = d.host; this.players = d.players; this.emit('joined', d); break;
      case 'lobby': this.players = d.players; this.host = d.host === this.id; this.emit('lobby', d); break;
      case 's': {
        const now = performance.now();
        d.time = now;
        this.buf.push(d);
        if (this.buf.length > 12) this.buf.shift();
        if (d.ev && d.ev.length) this.evQueue.push(...d.ev);
        break;
      }
      case 'pong': this.rtt = Math.round(performance.now() - d.at); break;
      case 'err': this.emit('err', d.msg); break;
      default: break;
    }
  }
  drainEvents() { const e = this.evQueue; this.evQueue = []; return e; }
  // Interpolated view at render time (now - delay - pausedMs). pausedMs grows while the client freezes frames.
  getView(now) {
    const b = this.buf;
    if (!b.length) return null;
    const rt = now - this.delay - this.pausedMs;
    let a = null, c = null;
    for (let i = b.length - 1; i >= 0; i--) { if (b[i].time <= rt) { a = b[i]; c = b[i + 1] || null; break; } }
    if (!a) return b[0];
    if (!c) return a;
    const t = Math.max(0, Math.min(1, (rt - a.time) / Math.max(1, c.time - a.time)));
    const lerpList = (la, lc) => {
      const map = new Map(la.map(e => [e.id, e]));
      return lc.map(e => {
        const o = map.get(e.id); if (!o || e.hitstop > 0) return e;
        return { ...e, x: o.x + (e.x - o.x) * t, y: o.y + (e.y - o.y) * t, z: o.z + (e.z - o.z) * t };
      });
    };
    return { ...c, cam: a.cam + (c.cam - a.cam) * t, P: lerpList(a.P, c.P), E: lerpList(a.E, c.E), J: lerpList(a.J, c.J), K: c.K };
  }
}

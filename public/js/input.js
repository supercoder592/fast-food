// Keyboard + multi-touch virtual pad + gamepad → input masks.
import { IN } from '../sim/constants.js';

const KEYS = {
  ArrowLeft: IN.L, KeyA: IN.L, ArrowRight: IN.R, KeyD: IN.R, ArrowUp: IN.U, KeyW: IN.U, ArrowDown: IN.D, KeyS: IN.D,
  KeyJ: IN.ATK, KeyZ: IN.ATK, Space: IN.ATK, KeyK: IN.JUMP, KeyX: IN.JUMP, KeyL: IN.DASH, KeyC: IN.DASH, ShiftLeft: IN.DASH,
  KeyI: IN.SPEC, KeyV: IN.SPEC, 
};

export class Input {
  constructor() {
    this.keyHeld = 0; this.touchHeld = 0; this.padHeld = 0;
    this.pressedAcc = 0; this.prevHeld = 0;
    this.enabled = true;
    this.onAny = null;
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const b = KEYS[e.code]; if (!b) return;
      if (this.enabled) { this.keyHeld |= b; this.pressedAcc |= b; e.preventDefault(); }
      if (this.onAny) this.onAny();
    });
    window.addEventListener('keyup', (e) => { const b = KEYS[e.code]; if (b) this.keyHeld &= ~b; });
    window.addEventListener('blur', () => { this.keyHeld = 0; this.touchHeld = 0; });
  }
  get held() { return this.keyHeld | this.touchHeld | this.padHeld; }
  // Called once per sim tick (offline) or per network send (online): returns held + edge-pressed since last call.
  consume() {
    this.pollGamepad();
    const held = this.held;
    const pressed = this.pressedAcc | (held & ~this.prevHeld);
    this.pressedAcc = 0; this.prevHeld = held;
    return { held, pressed };
  }
  pollGamepad() {
    const gps = navigator.getGamepads ? navigator.getGamepads() : [];
    let m = 0;
    for (const gp of gps) {
      if (!gp) continue;
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      if (ax < -0.4 || (gp.buttons[14] && gp.buttons[14].pressed)) m |= IN.L;
      if (ax > 0.4 || (gp.buttons[15] && gp.buttons[15].pressed)) m |= IN.R;
      if (ay < -0.4 || (gp.buttons[12] && gp.buttons[12].pressed)) m |= IN.U;
      if (ay > 0.4 || (gp.buttons[13] && gp.buttons[13].pressed)) m |= IN.D;
      const b = (i) => gp.buttons[i] && gp.buttons[i].pressed;
      if (b(2) || b(0)) m |= IN.ATK;   // X / A
      if (b(1)) m |= IN.JUMP;          // B
      if (b(5) || b(7)) m |= IN.DASH;  // RB / RT
      if (b(3)) m |= IN.SPEC;          // Y
    }
    if (m && this.onAny) this.onAny();
    this.pressedAcc |= m & ~this.padHeld;
    this.padHeld = m;
  }

  // ------------------------------------------------------------ touch pad
  buildTouch(root) {
    root.innerHTML = `
      <div class="tp-stick" id="tpStick"><div class="tp-base"></div><div class="tp-knob" id="tpKnob"></div></div>
      <div class="tp-btns">
        <button class="tp-btn tp-spec" data-bit="${IN.SPEC}"><span>必殺</span><small>漢堡隕石</small></button>
        <button class="tp-btn tp-dash" data-bit="${IN.DASH}"><span>衝刺</span><small>奶昔滑步</small></button>
        <button class="tp-btn tp-jump" data-bit="${IN.JUMP}"><span>跳</span></button>
        <button class="tp-btn tp-atk" data-bit="${IN.ATK}"><span>攻擊</span></button>
      </div>
`;
    const stick = root.querySelector('#tpStick'), knob = root.querySelector('#tpKnob');
    let stickId = null, sx = 0, sy = 0;
    const R = 34;
    const setDir = (dx, dy) => {
      let m = this.touchHeld & ~(IN.L | IN.R | IN.U | IN.D);
      const d = Math.hypot(dx, dy);
      if (d > 8) {
        const a = Math.atan2(dy, dx);
        if (Math.cos(a) > 0.38) m |= IN.R; if (Math.cos(a) < -0.38) m |= IN.L;
        if (Math.sin(a) > 0.38) m |= IN.D; if (Math.sin(a) < -0.38) m |= IN.U;
      }
      this.pressedAcc |= m & ~this.touchHeld;
      this.touchHeld = m;
      const k = Math.min(d, R);
      const a = Math.atan2(dy, dx);
      knob.style.transform = `translate(${d ? Math.cos(a) * k : 0}px, ${d ? Math.sin(a) * k : 0}px)`;
    };
    const zone = root; // whole left half acts as stick origin
    zone.addEventListener('pointerdown', (e) => {
      if (this.onAny) this.onAny();
      if (e.target.closest('.tp-btn')) return;
      if (e.clientX > window.innerWidth * 0.5) return;
      if (stickId !== null) return;
      stickId = e.pointerId; sx = e.clientX; sy = e.clientY;
      stick.style.left = (sx - 60) + 'px'; stick.style.top = (sy - 60) + 'px'; stick.classList.add('on');
      setDir(0, 0);
      e.preventDefault();
    });
    const move = (e) => { if (e.pointerId !== stickId) return; setDir(e.clientX - sx, e.clientY - sy); e.preventDefault(); };
    const up = (e) => { if (e.pointerId !== stickId) return; stickId = null; this.touchHeld &= ~(IN.L | IN.R | IN.U | IN.D); knob.style.transform = ''; stick.classList.remove('on'); };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);

    for (const btn of root.querySelectorAll('.tp-btn')) {
      const bit = +btn.dataset.bit;
      const ids = new Set();
      btn.addEventListener('pointerdown', (e) => { ids.add(e.pointerId); btn.setPointerCapture(e.pointerId); this.touchHeld |= bit; this.pressedAcc |= bit; btn.classList.add('on'); if (this.onAny) this.onAny(); e.preventDefault(); });
      const rel = (e) => { ids.delete(e.pointerId); if (!ids.size) { this.touchHeld &= ~bit; btn.classList.remove('on'); } };
      btn.addEventListener('pointerup', rel); btn.addEventListener('pointercancel', rel); btn.addEventListener('lostpointercapture', rel);
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    root.addEventListener('contextmenu', (e) => e.preventDefault());
  }
}

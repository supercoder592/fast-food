// Weapon definitions. Shared by sim (hit logic) and client (animation keyframes).
//
// Move fields:
//   dur      total ticks of the move
//   fwd      forward impulse applied at move start (px/tick, decays)
//   cancel   tick after which an ATK press chains into the next combo step
//   hits[]   active hit windows: {from,to, ox,w, zlo,zhi, d, dmg, kbx,kbz, hs, shake, kind, pow, both}
//              ox/w   : hitbox from x+dir*ox to x+dir*(ox+w)   (both=true mirrors to the other side too)
//              zlo/zhi: vertical (height) range relative to attacker z
//              d      : lane tolerance (|dy|)
//              hs     : hitstop ticks applied to attacker & victim
//              pow    : 1 light, 2 heavy, 3 massive (client fx scale)
//   slam     ground AOE triggered at tick `at`: {at, r, dmg, kbz, kbx, hs, shake, bury}
//   proj     spawns projectiles at tick `at`
//   rot      weapon rotation keyframes [[tick, deg], ...] (0 = up, 90 = forward, 180 = down)
//   pose     body pose hint for client: 'windup' | 'swing' | 'thrust' | 'spin' | 'shoot' | 'slam' | 'throw'

export const WEAPONS = [
  {
    id: 'hammer', name: '炸雞大錘', en: 'CHICKEN HAMMER', speed: 0.82, color: '#e8a040',
    desc: '慢但毀天滅地。第三下砸地：地裂、擊飛、把倒地敵人砸進土裡。',
    combo: [
      { name: '重揮', dur: 36, fwd: 1.6, cancel: 24, pose: 'swing',
        hits: [{ from: 14, to: 19, ox: 2, w: 34, zlo: -4, zhi: 30, d: 14, dmg: 18, kbx: 5, kbz: 6, hs: 9, shake: 5, kind: 'blunt', pow: 2 }],
        rot: [[0, -40], [10, -130], [13, -130], [17, 95], [22, 110], [36, -30]] },
      { name: '橫掃', dur: 34, fwd: 2.2, cancel: 24, pose: 'swing',
        hits: [{ from: 12, to: 18, ox: -2, w: 42, zlo: -4, zhi: 24, d: 18, dmg: 16, kbx: 8, kbz: 3, hs: 8, shake: 5, kind: 'blunt', pow: 2 }],
        rot: [[0, -30], [8, -160], [11, -160], [15, 70], [20, 120], [34, -30]] },
      { name: '炸雞隕落', dur: 64, fwd: 3, cancel: 56, pose: 'slam',
        hits: [{ from: 26, to: 30, ox: 4, w: 38, zlo: -6, zhi: 44, d: 16, dmg: 40, kbx: 3, kbz: 13, hs: 16, shake: 12, kind: 'blunt', pow: 3 }],
        slam: { at: 27, r: 66, dmg: 20, kbz: 10, kbx: 2, hs: 10, shake: 14, bury: true },
        rot: [[0, -30], [14, -170], [22, -175], [26, 150], [30, 165], [48, 165], [64, -30]] },
    ],
    air: { name: '墜落錘', dur: 60, pose: 'slam', plunge: -9,
      hits: [{ from: 2, to: 60, ox: -4, w: 26, zlo: -22, zhi: 10, d: 14, dmg: 14, kbx: 2, kbz: 8, hs: 8, shake: 5, kind: 'blunt', pow: 2 }],
      landSlam: { r: 50, dmg: 22, kbz: 9, kbx: 2, hs: 10, shake: 12, bury: true },
      rot: [[0, -150], [4, 160], [60, 160]] },
  },
  {
    id: 'fries', name: '薯條劍', en: 'FRIES RAPIER', speed: 1.12, color: '#f6d02a',
    desc: '快速連刺。第四下昇龍把敵人挑上天，空中還能繼續戳。',
    combo: [
      { name: '刺', dur: 14, fwd: 2.2, cancel: 8, pose: 'thrust',
        hits: [{ from: 5, to: 8, ox: 6, w: 28, zlo: -2, zhi: 22, d: 10, dmg: 6, kbx: 1.5, kbz: 0, hs: 3, shake: 1, kind: 'pierce', pow: 1 }],
        rot: [[0, 40], [4, 20], [5, 92], [9, 92], [14, 40]] },
      { name: '刺', dur: 14, fwd: 2.2, cancel: 8, pose: 'thrust',
        hits: [{ from: 5, to: 8, ox: 6, w: 28, zlo: 0, zhi: 26, d: 10, dmg: 6, kbx: 1.5, kbz: 0, hs: 3, shake: 1, kind: 'pierce', pow: 1 }],
        rot: [[0, 40], [4, 10], [5, 80], [9, 80], [14, 40]] },
      { name: '三連刺', dur: 22, fwd: 2.5, cancel: 15, pose: 'thrust',
        hits: [
          { from: 4, to: 6, ox: 6, w: 28, zlo: -2, zhi: 24, d: 10, dmg: 5, kbx: 1, kbz: 0, hs: 2, shake: 1, kind: 'pierce', pow: 1 },
          { from: 9, to: 11, ox: 6, w: 28, zlo: -2, zhi: 24, d: 10, dmg: 5, kbx: 1, kbz: 0, hs: 2, shake: 1, kind: 'pierce', pow: 1 },
          { from: 14, to: 17, ox: 8, w: 30, zlo: -2, zhi: 24, d: 10, dmg: 7, kbx: 3, kbz: 2, hs: 4, shake: 2, kind: 'pierce', pow: 1 },
        ],
        rot: [[0, 40], [3, 20], [4, 95], [7, 60], [9, 90], [12, 60], [14, 100], [18, 100], [22, 40]] },
      { name: '薯條昇龍', dur: 32, fwd: 3, cancel: 26, pose: 'swing', hop: 3,
        hits: [{ from: 8, to: 13, ox: 0, w: 30, zlo: -4, zhi: 38, d: 12, dmg: 14, kbx: 2, kbz: 10.5, hs: 7, shake: 3, kind: 'slash', pow: 2 }],
        rot: [[0, 40], [6, 150], [8, 150], [12, -20], [16, -40], [32, 40]] },
    ],
    air: { name: '空中連刺', dur: 24, pose: 'thrust',
      hits: [
        { from: 4, to: 6, ox: 4, w: 26, zlo: -8, zhi: 20, d: 10, dmg: 5, kbx: 0.5, kbz: 3.5, hs: 3, shake: 1, kind: 'pierce', pow: 1 },
        { from: 10, to: 12, ox: 4, w: 26, zlo: -8, zhi: 20, d: 10, dmg: 5, kbx: 0.5, kbz: 3.5, hs: 3, shake: 1, kind: 'pierce', pow: 1 },
        { from: 16, to: 19, ox: 6, w: 28, zlo: -8, zhi: 20, d: 10, dmg: 7, kbx: 1, kbz: 5, hs: 4, shake: 2, kind: 'pierce', pow: 1 },
      ],
      rot: [[0, 40], [4, 95], [8, 60], [10, 95], [14, 60], [16, 100], [24, 40]] },
  },
  {
    id: 'nunchaku', name: '熱狗雙節棍', en: 'HOTDOG NUNCHAKU', speed: 1.0, color: '#d9553a',
    desc: '雙面範圍連打。旋風把敵人吊在空中，終結鞭狠狠轟出去。',
    combo: [
      { name: '甩', dur: 16, fwd: 1.6, cancel: 10, pose: 'swing',
        hits: [{ from: 5, to: 9, ox: 0, w: 30, zlo: -2, zhi: 26, d: 12, dmg: 6, kbx: 1, kbz: 1, hs: 3, shake: 1, kind: 'blunt', pow: 1 }],
        rot: [[0, -60], [4, -90], [5, 60], [9, 120], [16, -60]] },
      { name: '回甩', dur: 16, fwd: 1.6, cancel: 10, pose: 'swing',
        hits: [{ from: 5, to: 9, ox: 0, w: 30, zlo: -2, zhi: 26, d: 12, dmg: 6, kbx: 1, kbz: 1, hs: 3, shake: 1, kind: 'blunt', pow: 1 }],
        rot: [[0, 120], [4, 150], [5, -20], [9, -80], [16, -60]] },
      { name: '熱狗旋風', dur: 52, fwd: 0.8, cancel: 46, pose: 'spin', spin: true,
        hits: [
          { from: 8, to: 10, ox: -8, w: 32, zlo: -2, zhi: 30, d: 14, dmg: 4, kbx: 0.8, kbz: 4.6, hs: 2, shake: 2, kind: 'blunt', pow: 1, both: true },
          { from: 16, to: 18, ox: -8, w: 32, zlo: -2, zhi: 30, d: 14, dmg: 4, kbx: 0.8, kbz: 4.6, hs: 2, shake: 2, kind: 'blunt', pow: 1, both: true },
          { from: 24, to: 26, ox: -8, w: 32, zlo: -2, zhi: 30, d: 14, dmg: 4, kbx: 0.8, kbz: 4.6, hs: 2, shake: 2, kind: 'blunt', pow: 1, both: true },
          { from: 32, to: 34, ox: -8, w: 32, zlo: -2, zhi: 30, d: 14, dmg: 4, kbx: 0.8, kbz: 4.6, hs: 2, shake: 2, kind: 'blunt', pow: 1, both: true },
          { from: 40, to: 42, ox: -8, w: 32, zlo: -2, zhi: 30, d: 14, dmg: 5, kbx: 1, kbz: 5, hs: 3, shake: 2, kind: 'blunt', pow: 1, both: true },
        ],
        rot: [[0, 0], [52, 1800]] },
      { name: '終結鞭', dur: 28, fwd: 3, cancel: 22, pose: 'swing',
        hits: [{ from: 10, to: 14, ox: 2, w: 34, zlo: -2, zhi: 30, d: 12, dmg: 14, kbx: 9, kbz: 4, hs: 8, shake: 5, kind: 'blunt', pow: 2 }],
        rot: [[0, -60], [8, -150], [10, 60], [14, 130], [28, -60]] },
    ],
    air: { name: '空中旋', dur: 30, pose: 'spin', spin: true,
      hits: [
        { from: 4, to: 6, ox: -8, w: 32, zlo: -10, zhi: 22, d: 12, dmg: 4, kbx: 0.5, kbz: 4, hs: 2, shake: 1, kind: 'blunt', pow: 1, both: true },
        { from: 12, to: 14, ox: -8, w: 32, zlo: -10, zhi: 22, d: 12, dmg: 4, kbx: 0.5, kbz: 4, hs: 2, shake: 1, kind: 'blunt', pow: 1, both: true },
        { from: 20, to: 22, ox: -8, w: 32, zlo: -10, zhi: 22, d: 12, dmg: 5, kbx: 0.5, kbz: 4.5, hs: 3, shake: 1, kind: 'blunt', pow: 1, both: true },
      ],
      rot: [[0, 0], [30, 1080]] },
  },
  {
    id: 'shotgun', name: '雞塊霰彈槍', en: 'NUGGET SHOTGUN', speed: 0.95, color: '#c98a2e',
    desc: '近距離雞塊爆射，後座力超大。第三發全開把人轟上牆。',
    combo: [
      { name: '開火', dur: 26, fwd: -0.8, cancel: 16, pose: 'shoot',
        proj: { at: 4, type: 'nugget', n: 5, spread: 0.34, speed: 6, dmg: 5, life: 16, kbx: 5, kbz: 2, hs: 4, shake: 3, pow: 1 },
        rot: [[0, 90], [4, 60], [8, 70], [26, 90]] },
      { name: '連發', dur: 24, fwd: -0.8, cancel: 15, pose: 'shoot',
        proj: { at: 4, type: 'nugget', n: 5, spread: 0.34, speed: 6, dmg: 5, life: 16, kbx: 5, kbz: 2, hs: 4, shake: 3, pow: 1 },
        rot: [[0, 90], [4, 55], [8, 70], [24, 90]] },
      { name: '雞塊全開', dur: 42, fwd: -3.5, cancel: 32, pose: 'shoot',
        proj: { at: 8, type: 'nugget', n: 9, spread: 0.5, speed: 7, dmg: 6, life: 18, kbx: 8.5, kbz: 7, hs: 5, shake: 7, pow: 2 },
        rot: [[0, 90], [6, 100], [8, 40], [14, 60], [42, 90]] },
    ],
    air: { name: '空中射擊', dur: 26, pose: 'shoot',
      proj: { at: 4, type: 'nugget', n: 4, spread: 0.3, speed: 6, vz: -2.5, dmg: 5, life: 18, kbx: 3, kbz: 3, hs: 3, shake: 2, pow: 1 },
      rot: [[0, 110], [4, 90], [26, 110]] },
  },
  {
    id: 'pizza', name: '披薩圓鋸', en: 'PIZZA BUZZSAW', speed: 1.0, color: '#e0462a',
    desc: '丟出去會回來的旋轉鋸。穿透、連續切割，接住回補能量。',
    combo: [
      { name: '擲鋸', dur: 22, fwd: 1, cancel: 14, pose: 'throw',
        proj: { at: 6, type: 'pizza', n: 1, spread: 0, speed: 5.5, dmg: 7, life: 140, kbx: 1, kbz: 2.5, hs: 3, shake: 2, pow: 1, boomerang: true, returnAt: 40, rehit: 9, pierce: true },
        rot: [[0, -60], [5, -120], [6, 90], [10, 100], [22, -60]],
        alt: { name: '切', dur: 14, fwd: 2, cancel: 9, pose: 'swing',
          hits: [{ from: 4, to: 7, ox: 4, w: 22, zlo: -2, zhi: 24, d: 10, dmg: 6, kbx: 2, kbz: 1, hs: 3, shake: 1, kind: 'slash', pow: 1 }],
          rot: [[0, -40], [3, -80], [4, 100], [7, 130], [14, -40]] } },
      { name: '切', dur: 14, fwd: 2, cancel: 9, pose: 'swing',
        hits: [{ from: 4, to: 7, ox: 4, w: 22, zlo: -2, zhi: 24, d: 10, dmg: 6, kbx: 2, kbz: 1, hs: 3, shake: 1, kind: 'slash', pow: 1 }],
        rot: [[0, -40], [3, -80], [4, 100], [7, 130], [14, -40]] },
      { name: '切', dur: 14, fwd: 2, cancel: 9, pose: 'swing',
        hits: [{ from: 4, to: 7, ox: 4, w: 22, zlo: 0, zhi: 26, d: 10, dmg: 6, kbx: 2, kbz: 1, hs: 3, shake: 1, kind: 'slash', pow: 1 }],
        rot: [[0, 130], [3, 160], [4, -60], [7, -90], [14, -40]] },
      { name: '披薩迴旋', dur: 28, fwd: 3, cancel: 22, pose: 'spin', spin: true,
        hits: [{ from: 8, to: 13, ox: -6, w: 36, zlo: -2, zhi: 30, d: 12, dmg: 12, kbx: 6, kbz: 6, hs: 7, shake: 4, kind: 'slash', pow: 2, both: true }],
        rot: [[0, 0], [28, 720]] },
    ],
    air: { name: '空中擲', dur: 20, pose: 'throw',
      proj: { at: 5, type: 'pizza', n: 1, spread: 0, speed: 5, vz: -1.8, dmg: 7, life: 70, kbx: 2, kbz: 3, hs: 3, shake: 2, pow: 1, pierce: true, rehit: 9 },
      rot: [[0, -60], [4, -120], [5, 90], [20, 60]] },
  },
];

export const WEAPON_BY_ID = Object.fromEntries(WEAPONS.map(w => [w.id, w]));

// Cola Jet dash (可樂噴射)
export const DASH = { dur: 14, speed: 6.5, inv: 11, cd: 18,
  hits: [{ from: 2, to: 12, ox: -4, w: 22, zlo: -4, zhi: 26, d: 10, dmg: 3, kbx: 3.5, kbz: 1, hs: 2, shake: 1, kind: 'blunt', pow: 1 }] };

// Burger Meteor special (漢堡隕石)
export const SPECIAL = { dur: 58, spawnAt: 12, dist: 56, startZ: 170, gravity: 0.55,
  slam: { r: 84, dmg: 60, kbz: 15, kbx: 4, hs: 14, shake: 18, bury: false } };

export const JUMP_VZ = 7.6;

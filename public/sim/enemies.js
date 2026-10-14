// Enemy archetypes. "慢食聯盟" (Slow Food League) — the rivals of the Fast Food-ist.
export const ENEMIES = {
  sushi: {
    name: '壽司老闆', hp: 42, speed: 0.95, weight: 1, w: 12, h: 26, score: 100,
    melee: { range: 24, windup: 22, active: [3, 8], dur: 30, dmg: 8, kbx: 3, kbz: 0, ox: 2, w: 22, d: 12 },
    ranged: { cd: 170, range: [60, 200], windup: 26, proj: 'sushi', speed: 2.8, dmg: 6, dur: 40 },
    hesitate: 0.45,
  },
  roll: {
    name: '飯卷老闆', hp: 80, speed: 0.72, weight: 1.6, w: 16, h: 24, score: 150,
    melee: { range: 22, windup: 26, active: [4, 9], dur: 34, dmg: 10, kbx: 4, kbz: 2, ox: 0, w: 24, d: 12 },
    charge: { cd: 200, range: [50, 180], windup: 38, speed: 5.2, dur: 36, dmg: 13, kbx: 6, kbz: 4, d: 12 },
    hesitate: 0.3,
  },
  monk: {
    name: '糖葫蘆武僧', hp: 36, speed: 1.4, weight: 0.9, w: 12, h: 28, score: 120,
    melee: { range: 32, windup: 16, active: [3, 6], dur: 24, dmg: 7, kbx: 2.5, kbz: 0, ox: 4, w: 30, d: 10 },
    hop: { cd: 150, range: [40, 140], vz: 7, speed: 3.2, dmg: 9, kbx: 3, kbz: 3 },
    hesitate: 0.35,
  },
  boba: {
    name: '珍奶忍者', hp: 26, speed: 1.85, weight: 0.8, w: 11, h: 24, score: 90,
    melee: { range: 20, windup: 12, active: [2, 5], dur: 20, dmg: 6, kbx: 2, kbz: 0, ox: 2, w: 20, d: 10 },
    blink: { cd: 120, dist: 70 },
    hesitate: 0.5,
  },
  boss: {
    name: '火鍋大帝', hp: 560, speed: 0.62, weight: 4.2, w: 26, h: 42, score: 2000, boss: true,
    melee: { range: 36, windup: 30, active: [4, 10], dur: 44, dmg: 14, kbx: 6, kbz: 4, ox: 0, w: 40, d: 16 },
    slam: { cd: 260, range: [0, 120], windup: 46, dur: 70, r: 70, dmg: 22, kbz: 11, kbx: 4 },
    summon: { at: 0.5, types: ['boba', 'sushi'] },
    hesitate: 0.2,
  },
};

// Stage: 速食大道 (Fast Food Boulevard)
export const STAGE = {
  name: '速食大道',
  waves: [
    { x: 150, spawn: [['sushi', 2]] },
    { x: 520, spawn: [['sushi', 2], ['monk', 1]] },
    { x: 900, spawn: [['roll', 1], ['boba', 2], ['sushi', 1]] },
    { x: 1300, spawn: [['monk', 2], ['boba', 2], ['roll', 1]] },
    { x: 1720, spawn: [['sushi', 2], ['monk', 2], ['roll', 2], ['boba', 1]] },
    { x: 2200, spawn: [['boss', 1]], boss: true },
  ],
};

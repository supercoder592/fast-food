// Weapon definitions: the food itself is the attack (thrown, sprayed, rolled, slammed).
// Shared by sim (hit logic) and client (animation hints).
//
// Move fields:
//   dur, fwd, cancel, pose   as before (pose: windup|swing|slam|throw|spray|spin|dump)
//   hits[]   melee-style active windows (used by the drumstick slam and the cola jet stream)
//   slam     ground AOE at tick `at`: {at, r, dmg, kbz, kbx, hs, shake, bury, fxKind}
//   proj     food projectile spawned at tick `at`:
//              type, n, spread, speed, vz, grav, life, dmg, kbx, kbz, hs, shake, pow,
//              pierce, rehit, roll (stays on the ground), bounce (bounces once then explodes),
//              landSlam {r,dmg,kbz,kbx,hs,shake,bury,fxKind} (AOE when it lands)
//   rot      rotation keyframes for the held item (drumstick only)
//   hold     'keep' = item stays in hand through the move, 'gone' = hidden after proj.at

export const WEAPONS = [
  {
    id: 'drumstick', name: '巨大炸雞腿', en: 'GIANT DRUMSTICK', speed: 0.82, color: '#e8a040', item: 'drumstick',
    desc: '雙手抱著整隻炸雞腿掄下去。第三下砸地：地裂、全場擊飛、把倒地敵人砸進土裡。',
    combo: [
      { name: '重砸', dur: 36, fwd: 1.6, cancel: 24, pose: 'swing', hold: 'keep',
        hits: [{ from: 14, to: 19, ox: 2, w: 34, zlo: -4, zhi: 30, d: 14, dmg: 18, kbx: 5, kbz: 6, hs: 9, shake: 5, kind: 'blunt', pow: 2 }],
        rot: [[0, -40], [10, -130], [13, -130], [17, 95], [22, 110], [36, -30]] },
      { name: '橫掃', dur: 34, fwd: 2.2, cancel: 24, pose: 'swing', hold: 'keep',
        hits: [{ from: 12, to: 18, ox: -2, w: 42, zlo: -4, zhi: 24, d: 18, dmg: 16, kbx: 8, kbz: 3, hs: 8, shake: 5, kind: 'blunt', pow: 2 }],
        rot: [[0, -30], [8, -160], [11, -160], [15, 70], [20, 120], [34, -30]] },
      { name: '炸雞隕落', dur: 64, fwd: 3, cancel: 56, pose: 'slam', hold: 'keep',
        hits: [{ from: 26, to: 30, ox: 4, w: 38, zlo: -6, zhi: 44, d: 16, dmg: 40, kbx: 3, kbz: 13, hs: 16, shake: 12, kind: 'blunt', pow: 3 }],
        slam: { at: 27, r: 66, dmg: 20, kbz: 10, kbx: 2, hs: 10, shake: 14, bury: true },
        rot: [[0, -30], [14, -170], [22, -175], [26, 150], [30, 165], [48, 165], [64, -30]] },
    ],
    air: { name: '墜落雞腿', dur: 60, pose: 'slam', plunge: -9, hold: 'keep',
      hits: [{ from: 2, to: 60, ox: -4, w: 26, zlo: -22, zhi: 10, d: 14, dmg: 14, kbx: 2, kbz: 8, hs: 8, shake: 5, kind: 'blunt', pow: 2 }],
      landSlam: { r: 50, dmg: 22, kbz: 9, kbx: 2, hs: 10, shake: 12, bury: true },
      rot: [[0, -150], [4, 160], [60, 160]] },
  },
  {
    id: 'burger', name: '漢堡投擲', en: 'BURGER TOSS', speed: 1.05, color: '#e8a84a', item: 'bag',
    desc: '從紙袋掏漢堡連丟，落地彈跳再炸開。第三下丟出三層巨無霸，砸地炸出小坑。',
    combo: [
      { name: '丟漢堡', dur: 18, fwd: 1, cancel: 10, pose: 'throw', hold: 'gone',
        proj: { at: 5, type: 'burger', n: 1, speed: 4.2, vz: 3.2, grav: 0.22, life: 120, dmg: 9, kbx: 3, kbz: 2.5, hs: 4, shake: 2, pow: 1, bounce: true } },
      { name: '雙漢堡', dur: 20, fwd: 1, cancel: 12, pose: 'throw', hold: 'gone',
        proj: { at: 5, type: 'burger', n: 2, spread: 0.5, speed: 4.4, vz: 3.6, grav: 0.22, life: 120, dmg: 9, kbx: 3, kbz: 2.5, hs: 4, shake: 2, pow: 1, bounce: true } },
      { name: '巨無霸', dur: 36, fwd: -1, cancel: 28, pose: 'throw', hold: 'gone',
        proj: { at: 12, type: 'bigburger', n: 1, speed: 3.4, vz: 5.5, grav: 0.26, life: 160, dmg: 22, kbx: 5, kbz: 8, hs: 10, shake: 8, pow: 3,
          landSlam: { r: 44, dmg: 14, kbz: 7, kbx: 3, hs: 8, shake: 10, bury: false } } },
    ],
    air: { name: '空中丟', dur: 20, pose: 'throw', hold: 'gone',
      proj: { at: 5, type: 'burger', n: 2, spread: 0.6, speed: 4, vz: -1.5, grav: 0.2, life: 90, dmg: 9, kbx: 3, kbz: 3, hs: 4, shake: 2, pow: 1, bounce: true } },
  },
  {
    id: 'cola', name: '可樂噴射', en: 'COLA JET', speed: 1.0, color: '#e23c2c', item: 'cola',
    desc: '搖罐後噴出高壓可樂水柱，把敵人沖起來吊在空中。第三下加曼陀珠，整罐爆炸。',
    combo: [
      { name: '搖罐噴射', dur: 34, fwd: -0.6, cancel: 28, pose: 'spray', hold: 'keep', stream: [8, 30],
        hits: [
          { from: 8, to: 10, ox: 6, w: 54, zlo: -2, zhi: 22, d: 12, dmg: 3, kbx: 1.4, kbz: 3.8, hs: 2, shake: 1, kind: 'pierce', pow: 1 },
          { from: 14, to: 16, ox: 6, w: 58, zlo: -2, zhi: 24, d: 12, dmg: 3, kbx: 1.4, kbz: 3.8, hs: 2, shake: 1, kind: 'pierce', pow: 1 },
          { from: 20, to: 22, ox: 6, w: 62, zlo: -2, zhi: 26, d: 12, dmg: 3, kbx: 1.4, kbz: 3.8, hs: 2, shake: 1, kind: 'pierce', pow: 1 },
          { from: 26, to: 28, ox: 6, w: 62, zlo: -2, zhi: 28, d: 12, dmg: 4, kbx: 1.8, kbz: 4.2, hs: 3, shake: 2, kind: 'pierce', pow: 1 },
        ] },
      { name: '持續噴射', dur: 34, fwd: -0.6, cancel: 28, pose: 'spray', hold: 'keep', stream: [4, 30],
        hits: [
          { from: 4, to: 6, ox: 6, w: 62, zlo: -2, zhi: 28, d: 12, dmg: 3, kbx: 1.4, kbz: 3.8, hs: 2, shake: 1, kind: 'pierce', pow: 1 },
          { from: 10, to: 12, ox: 6, w: 62, zlo: -2, zhi: 28, d: 12, dmg: 3, kbx: 1.4, kbz: 3.8, hs: 2, shake: 1, kind: 'pierce', pow: 1 },
          { from: 16, to: 18, ox: 6, w: 62, zlo: -2, zhi: 28, d: 12, dmg: 3, kbx: 1.4, kbz: 3.8, hs: 2, shake: 1, kind: 'pierce', pow: 1 },
          { from: 22, to: 24, ox: 6, w: 62, zlo: -2, zhi: 28, d: 12, dmg: 3, kbx: 1.4, kbz: 3.8, hs: 2, shake: 1, kind: 'pierce', pow: 1 },
          { from: 28, to: 30, ox: 6, w: 62, zlo: -2, zhi: 30, d: 12, dmg: 5, kbx: 2.5, kbz: 5, hs: 4, shake: 2, kind: 'pierce', pow: 2 },
        ] },
      { name: '曼陀珠爆炸', dur: 50, fwd: 0, cancel: 42, pose: 'raise', hold: 'keep',
        slam: { at: 22, r: 58, dmg: 26, kbz: 11, kbx: 5, hs: 12, shake: 14, bury: false, fxKind: 'cola', self: true } },
    ],
    air: { name: '空中噴射', dur: 26, pose: 'spray', hold: 'keep', stream: [4, 22],
      hits: [
        { from: 4, to: 6, ox: 2, w: 50, zlo: -16, zhi: 16, d: 12, dmg: 3, kbx: 1, kbz: 3.5, hs: 2, shake: 1, kind: 'pierce', pow: 1 },
        { from: 10, to: 12, ox: 2, w: 50, zlo: -16, zhi: 16, d: 12, dmg: 3, kbx: 1, kbz: 3.5, hs: 2, shake: 1, kind: 'pierce', pow: 1 },
        { from: 16, to: 18, ox: 2, w: 50, zlo: -16, zhi: 16, d: 12, dmg: 4, kbx: 1.5, kbz: 4, hs: 3, shake: 1, kind: 'pierce', pow: 1 },
      ] },
  },
  {
    id: 'fries', name: '薯條飛鏢', en: 'FRIES DARTS', speed: 1.12, color: '#f6d02a', item: 'fries',
    desc: '抓一把薯條快速甩出去當飛鏢。終結技：整桶薯條倒在敵人頭上。',
    combo: [
      { name: '甩薯條', dur: 12, fwd: 1.5, cancel: 7, pose: 'throw', hold: 'keep',
        proj: { at: 3, type: 'friesdart', n: 3, spread: 0.3, speed: 7, vz: 0.4, grav: 0.03, life: 40, dmg: 4, kbx: 1, kbz: 0, hs: 2, shake: 1, pow: 1 } },
      { name: '甩薯條', dur: 12, fwd: 1.5, cancel: 7, pose: 'throw', hold: 'keep',
        proj: { at: 3, type: 'friesdart', n: 3, spread: 0.3, speed: 7, vz: 0.6, grav: 0.03, life: 40, dmg: 4, kbx: 1, kbz: 0, hs: 2, shake: 1, pow: 1 } },
      { name: '薯條彈幕', dur: 18, fwd: 1.5, cancel: 12, pose: 'throw', hold: 'keep',
        proj: { at: 3, type: 'friesdart', n: 6, spread: 0.7, speed: 7.5, vz: 1.2, grav: 0.04, life: 40, dmg: 4, kbx: 1.5, kbz: 2.5, hs: 3, shake: 2, pow: 1 } },
      { name: '整桶倒頭', dur: 40, fwd: 2, cancel: 32, pose: 'dump', hold: 'gone',
        proj: { at: 10, type: 'bucket', n: 1, speed: 2.6, vz: 7, grav: 0.3, life: 120, dmg: 10, kbx: 2, kbz: 6, hs: 8, shake: 6, pow: 2,
          landSlam: { r: 40, dmg: 16, kbz: 5, kbx: 2, hs: 8, shake: 9, bury: false, fxKind: 'fries' } } },
    ],
    air: { name: '空中灑薯條', dur: 22, pose: 'throw', hold: 'keep',
      proj: { at: 4, type: 'friesdart', n: 5, spread: 0.8, speed: 6, vz: -2.5, grav: 0.05, life: 40, dmg: 4, kbx: 1, kbz: 3, hs: 2, shake: 1, pow: 1 } },
  },
  {
    id: 'pizza', name: '披薩滾球', en: 'PIZZA BOWLING', speed: 1.0, color: '#e0462a', item: 'pizzabox',
    desc: '把整個披薩當保齡球滾出去，撞倒一整排。終結技：披薩拋上天旋轉再砸下來。',
    combo: [
      { name: '滾披薩', dur: 22, fwd: 1.5, cancel: 14, pose: 'swing', hold: 'keep',
        proj: { at: 7, type: 'pizza', n: 1, speed: 4.5, vz: 0, grav: 0, life: 70, dmg: 8, kbx: 3, kbz: 3.2, hs: 4, shake: 2, pow: 1, roll: true, pierce: true, rehit: 12 } },
      { name: '雙球', dur: 24, fwd: 1.5, cancel: 16, pose: 'swing', hold: 'keep',
        proj: { at: 7, type: 'pizza', n: 2, spread: 0.5, speed: 4.5, vz: 0, grav: 0, life: 70, dmg: 8, kbx: 3, kbz: 3.2, hs: 4, shake: 2, pow: 1, roll: true, pierce: true, rehit: 12 } },
      { name: '披薩砸落', dur: 40, fwd: 2, cancel: 32, pose: 'spin', hold: 'gone', spin: true,
        proj: { at: 12, type: 'pizzaspin', n: 1, speed: 2.4, vz: 8.5, grav: 0.34, life: 140, dmg: 16, kbx: 4, kbz: 8, hs: 9, shake: 7, pow: 2, pierce: true, rehit: 10,
          landSlam: { r: 42, dmg: 14, kbz: 7, kbx: 3, hs: 8, shake: 10, bury: false } } },
    ],
    air: { name: '空中滾球', dur: 20, pose: 'swing', hold: 'keep',
      proj: { at: 5, type: 'pizza', n: 1, speed: 4, vz: -1, grav: 0.2, life: 80, dmg: 8, kbx: 3, kbz: 3, hs: 4, shake: 2, pow: 1, pierce: true, rehit: 12, rollOnLand: true } },
  },
];

export const WEAPON_BY_ID = Object.fromEntries(WEAPONS.map(w => [w.id, w]));

// Milkshake Slide dash (奶昔滑步)
export const DASH = { dur: 14, speed: 6.5, inv: 11, cd: 18,
  hits: [{ from: 2, to: 12, ox: -4, w: 22, zlo: -4, zhi: 26, d: 10, dmg: 3, kbx: 3.5, kbz: 1, hs: 2, shake: 1, kind: 'blunt', pow: 1 }] };

// Burger Meteor special (漢堡隕石)
export const SPECIAL = { dur: 58, spawnAt: 12, dist: 56, startZ: 170, gravity: 0.55,
  slam: { r: 84, dmg: 60, kbz: 15, kbx: 4, hs: 14, shake: 18, bury: false } };

export const JUMP_VZ = 7.6;

// 8-bit sprite factory. Sprites are authored as rows of palette letters and baked to canvases once.
// '.' = transparent. Each character has its own letter→color map so bodies can be shared.

export const PAL = {
  o: '#1b1026', // outline
  w: '#fff6e5', // white
  k: '#141018', // near-black
};

const cache = new Map();

export function bake(rows, map, key) {
  const k = key || (rows.join('|') + JSON.stringify(map));
  if (cache.has(k)) return cache.get(k);
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  for (let y = 0; y < h; y++) for (let x = 0; x < rows[y].length; x++) {
    const ch = rows[y][x]; if (ch === '.' || ch === ' ') continue;
    g.fillStyle = map[ch] || PAL[ch] || '#f0f';
    g.fillRect(x, y, 1, 1);
  }
  const f = document.createElement('canvas'); f.width = w; f.height = h;
  const fg = f.getContext('2d'); fg.translate(w, 0); fg.scale(-1, 1); fg.drawImage(c, 0, 0);
  const s = { img: c, flip: f, w, h };
  cache.set(k, s);
  return s;
}

// Solid white silhouette (for hit flash)
const whiteCache = new Map();
export function whiteOf(spr) {
  if (whiteCache.has(spr)) return whiteCache.get(spr);
  const mk = (src) => {
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    const g = c.getContext('2d'); g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-in'; g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height);
    return c;
  };
  const r = { img: mk(spr.img), flip: mk(spr.flip), w: spr.w, h: spr.h };
  whiteCache.set(spr, r);
  return r;
}

// ------------------------------------------------------------------ humanoid parts
// letters: o outline, x shirt, a accent (apron/belt), s skin, p pants, f shoes, h hat, H hat accent, e eye, g glasses, b hair/extra
const TORSO = {
  idle: [
    '...oxxxxxxo...',
    '..oxxaaaaxxo..',
    '..oxxaaaaxxo..',
    '.osxxaaaaxxso.',
    '.osxxaaaaxxso.',
    '..oxxaaaaxxo..',
    '...oaaaaaao...',
  ],
  windup: [
    '...oxxxxxxo...',
    '.ooxxaaaaxxo..',
    'osxxxaaaaxxo..',
    'os.xxaaaaxxso.',
    '.o.xxaaaaxxso.',
    '..oxxaaaaxxo..',
    '...oaaaaaao...',
  ],
  swing: [
    '...oxxxxxxo...',
    '..oxxaaaaxxoo.',
    '..oxxaaaaxxxso',
    '.osxxaaaaxxxso',
    '.osxxaaaaxxo..',
    '..oxxaaaaxxo..',
    '...oaaaaaao...',
  ],
  thrust: [
    '...oxxxxxxo...',
    '..oxxaaaaxxo..',
    '..oxxaaaaxxoo.',
    '..oxxaaaaxxxso',
    '.osxxaaaaxxxso',
    '.osxxaaaaxxo..',
    '...oaaaaaao...',
  ],
  shoot: [
    '...oxxxxxxo...',
    '..oxxaaaaxxoo.',
    '..oxxaaaaxxxso',
    '..oxxaaaaxxxso',
    '..oxxaaaaxxxso',
    '..oxxaaaaxxo..',
    '...oaaaaaao...',
  ],
  spin: [
    'oo.oxxxxxxo.oo',
    'osoxxaaaaxxoso',
    'osxxxaaaaxxxso',
    '.o.xxaaaaxx.o.',
    '...xxaaaaxx...',
    '..oxxaaaaxxo..',
    '...oaaaaaao...',
  ],
  slam: [
    '...oxxxxxxo...',
    '..oxxaaaaxxo..',
    '..oxxaaaaxxo..',
    '..oxxaaaaxxo..',
    '.osxxaaaaxxso.',
    '.osxxaaaaxxso.',
    '...oaaaaaao...',
  ],
  hurt: [
    'oo.oxxxxxxo.oo',
    'oso.xxaaaxx.so',
    '.osxxxaaaxxso.',
    '..oxxaaaaxxo..',
    '..oxxaaaaxxo..',
    '..oxxaaaaxxo..',
    '...oaaaaaao...',
  ],
  raise: [
    '.oo.oxxxxo.oo.',
    '.osoxxaaxxoso.',
    '.osxxxaaaxxso.',
    '..oxxaaaaxxo..',
    '..oxxaaaaxxo..',
    '..oxxaaaaxxo..',
    '...oaaaaaao...',
  ],
};
const LEGS = {
  stand: [
    '...opppppo....',
    '...oppppppo...',
    '...opp.oppo...',
    '...opp..ppo...',
    '...off..ffo...',
    '...off..ffo...',
    '...ooo..ooo...',
  ],
  walkA: [
    '...opppppo....',
    '..opppppppo...',
    '..opp..opppo..',
    '.opp....oppo..',
    '.off.....ffo..',
    '.off.....ffo..',
    '.ooo.....ooo..',
  ],
  walkB: [
    '...opppppo....',
    '...oppppppo...',
    '...opppoppo...',
    '....opp.pp....',
    '....off.ff....',
    '....offoff....',
    '....ooo.oo....',
  ],
  walkC: [
    '...opppppo....',
    '..opppppppo...',
    '..oppo..ppo...',
    '..oppo...ppo..',
    '..off....ffo..',
    '..off.....fo..',
    '..ooo.....oo..',
  ],
  jump: [
    '...opppppo....',
    '..opppppppo...',
    '..opp.o.ppo...',
    '..off...ffo...',
    '..ooo...ooo...',
    '..............',
    '..............',
  ],
  crouch: [
    '..oppppppppo..',
    '..opp.oo.ppo..',
    '..off....ffo..',
    '..ooo....ooo..',
    '..............',
    '..............',
    '..............',
  ],
  lunge: [
    '...opppppo....',
    '..oppppppppo..',
    '.oppp.....ppo.',
    '.opp.......ppo',
    '.off.......ffo',
    '.off.......ffo',
    '.ooo.......ooo',
  ],
};

export const HEADS = {
  player: [ // red cap, shades
    '....oooooo....',
    '...ohhhhhho...',
    '..ohhhHHhhho..',
    '..ohhhhhhhho..',
    '.oHHHHHHHHHHo.',
    '..ossssssso...',
    '..osggggggso..',
    '..osssssssso..',
    '...osssssso...',
  ],
  sushi: [ // tall chef hat + headband
    '...oooooooo...',
    '..ohhhhhhhho..',
    '..ohhhhhhhho..',
    '..ohhhhhhhho..',
    '.oHHHHHHHHHHo.',
    '..ossssssso...',
    '..oseesseeso..',
    '..osssssssso..',
    '...osssssso...',
  ],
  monk: [ // bald with scars, bushy brows
    '..............',
    '....oooooo....',
    '...osssssso...',
    '..osssHssHso..',
    '..ossssssso...',
    '..obbsbbsbbo..',
    '..oseesseeso..',
    '..osssssssso..',
    '...osssssso...',
  ],
  boba: [ // ninja hood
    '....oooooo....',
    '...ohhhhhho...',
    '..ohhhhhhhho..',
    '..ohhhhhhhho..',
    '..ohhhhhhhho..',
    '..ohssssssho..',
    '..oheesseeho..',
    '..ohhhhhhhho..',
    '...ohhhhhho...',
  ],
};

export const CHARS = {
  player: { o: PAL.o, x: '#e23c2c', a: '#fff1d6', s: '#f7c59b', p: '#2f4fb3', f: '#1b1026', h: '#e23c2c', H: '#ffd23f', g: '#1b1026', e: '#1b1026', b: '#1b1026' },
  sushi:  { o: PAL.o, x: '#2a4a9c', a: '#f2f2f2', s: '#f3cfa8', p: '#1b2a5a', f: '#1b1026', h: '#ffffff', H: '#d93a3a', e: '#1b1026', b: '#1b1026' },
  monk:   { o: PAL.o, x: '#e07a1f', a: '#f0b23c', s: '#e9b98a', p: '#b05a16', f: '#4a2a12', h: '#e9b98a', H: '#b03030', e: '#1b1026', b: '#3a2416' },
  boba:   { o: PAL.o, x: '#2b2238', a: '#6b4a2c', s: '#f0c9a0', p: '#1e1828', f: '#1b1026', h: '#2b2238', H: '#2b2238', e: '#f2f2f2', b: '#1b1026' },
};

function humanoid(head, torso, legs) { return head.concat(torso, legs); }

export const POSES = {
  idle0: ['idle', 'stand'], idle1: ['idle', 'stand'],
  walk0: ['idle', 'walkA'], walk1: ['idle', 'walkB'], walk2: ['idle', 'walkC'], walk3: ['idle', 'walkB'],
  jump: ['idle', 'jump'], windup: ['windup', 'stand'], swing: ['swing', 'lunge'], thrust: ['thrust', 'lunge'],
  shoot: ['shoot', 'lunge'], spin: ['spin', 'stand'], slam: ['slam', 'crouch'], hurt: ['hurt', 'walkA'], raise: ['raise', 'stand'],
  dash: ['thrust', 'lunge'], throw: ['swing', 'lunge'], getup: ['slam', 'crouch'], spray: ['shoot', 'lunge'], dump: ['raise', 'stand'],
};

export function charSprite(charId, pose) {
  const head = HEADS[charId] || HEADS.player;
  const [t, l] = POSES[pose] || POSES.idle0;
  const rows = humanoid(head, TORSO[t], LEGS[l]);
  return bake(rows, CHARS[charId] || CHARS.player, 'c:' + charId + ':' + pose);
}

// ------------------------------------------------------------------ custom bodies
const ROLL_MAP = { o: PAL.o, n: '#1a2a1e', N: '#2f4a33', r: '#fff6e5', c: '#e24b3a', g: '#6cc04a', e: '#fff6e5', s: '#f3cfa8', f: '#1b1026', y: '#ffd23f' };
const ROLL = {
  idle: [
    '....oooooooo....',
    '..oorrrrrrrroo..',
    '.orrrrccggrrrro.',
    '.orrrccccggrrro.',
    '.onnnnnnnnnnnno.',
    '.onnnnnnnnnnnno.',
    'osnnNeeNNeeNnnso',
    'osnnNNNNNNNNnnso',
    '.onnnNnnnnNnnno.',
    '.onnnnNNNNnnnno.',
    '.onnnnnnnnnnnno.',
    '.onnnnnnnnnnnno.',
    '.onnnnnnnnnnnno.',
    '.onnnnnnnnnnnno.',
    '..oonnnnnnnnoo..',
    '...offo..offo...',
    '...offo..offo...',
    '...oooo..oooo...',
  ],
  roll: [
    '.....oooooo.....',
    '...oonnnnnnoo...',
    '..onnnrrrrnnno..',
    '.onnnrrccgrrnno.',
    '.onnrrcccggrrno.',
    'onnnrrcccgrrnnno',
    'onnnrrrrrrrrnnno',
    'onnnnrrrrrrnnnno',
    'onnnnnnnnnnnnnno',
    'onnnNeeNNeeNnnno',
    '.onnNNNNNNNNnno.',
    '.onnnnNNNNnnnno.',
    '..onnnnnnnnnno..',
    '...oonnnnnnoo...',
    '.....oooooo.....',
    '................',
    '................',
    '................',
  ],
};
const BOSS_MAP = { o: PAL.o, m: '#8a2d1f', M: '#c04a30', r: '#e8503a', s: '#f4c542', S: '#ff9a3a', y: '#ffd23f', w: '#fff6e5', g: '#4f9b3a', e: '#fff6e5', E: '#1b1026', f: '#ff6a1a', F: '#ffd23f', k: '#3a2a26', l: '#c9c9c9' };
const BOSS = {
  idle: [
    '...........yyyyyy...........',
    '..........yywyywyy..........',
    '..........yyyyyyyy..........',
    '........ooooooooooooo.......',
    '.......oSSSSrrggSSSSSo......',
    '......ooSSrrSSSSggrrSoo.....',
    '.....oMMoooooooooooooMMo....',
    '....oMMMMMMMMMMMMMMMMMMMo...',
    '...oMMMMMMMMMMMMMMMMMMMMMo..',
    '..ooMMmEEmMMMMMMMMmEEmMMoo..',
    '.okoMMmEEmMMMMMMMMmEEmMMoko.',
    '.okoMMMMMMMMMMMMMMMMMMMMoko.',
    '.okoMMMMMmmmmmmmmmMMMMMMoko.',
    '..ooMMMMMMmmmmmmmMMMMMMMoo..',
    '...oMMMMMMMMMMMMMMMMMMMMo...',
    '...oMMMMMMMMMMMMMMMMMMMMo...',
    '...oMmmmmmmmmmmmmmmmmmmMo...',
    '...oMMMMMMMMMMMMMMMMMMMMo...',
    '...oMMMMMMMMMMMMMMMMMMMMo...',
    '....oMMMMMMMMMMMMMMMMMMo....',
    '....oommmmmmmmmmmmmmmmoo....',
    '.....ooooooooooooooooo......',
    '......f..fFf..fFf..f........',
    '.....fFf.FfF.fFfF.fFf.......',
    '....fFFFfFFFfFFFFfFFFf......',
    '.....fFFffFFfFFFFfFFf.......',
    '......ffffffffffffff........',
    '.......o..oooooo..o.........',
    '......okko.kkkk.okko........',
    '......okko......okko........',
    '......oooo......oooo........',
    '............................',
    '............................',
    '............................',
    '............................',
    '............................',
    '............................',
    '............................',
    '............................',
    '............................',
  ],
};

export function bodySprite(type, pose) {
  if (type === 'roll') return bake(pose === 'roll' ? ROLL.roll : ROLL.idle, ROLL_MAP, 'roll:' + pose);
  if (type === 'boss') return bake(BOSS.idle, BOSS_MAP, 'boss');
  return charSprite(type, pose);
}

// ------------------------------------------------------------------ weapons (upright, pivot = handle)
const WPN = {
  drumstick: { pivot: [6, 27], map: { o: PAL.o, b: '#fff6e5', B: '#e9dcc6', c: '#d9892c', C: '#b5641b', d: '#f2b24a', k: '#7a3e12' }, rows: [
    '....oooo....',
    '..oocccdoo..',
    '.ocdcccccco.',
    '.occCccdcco.',
    'ocdcccCcccco',
    'occccdccCcco',
    'ocCccccccdco',
    'occcdccCccco',
    'ocdccCccccco',
    '.occccdcCco.',
    '.ocCcccccco.',
    '..occdccco..',
    '..oocCcoo...',
    '...okkko....',
    '...okkko....',
    '....obo.....',
    '....obo.....',
    '....obo.....',
    '....obo.....',
    '....obo.....',
    '....obo.....',
    '....obo.....',
    '....obo.....',
    '...oBbBo....',
    '..oBbbbBo...',
    '..obb.bbo...',
    '..oooooooo..',
    '............',
  ] },
  pizza: { pivot: [7, 7], map: { o: PAL.o, c: '#d9892c', C: '#b5641b', y: '#ffd23f', r: '#c8302a', g: '#4f9b3a' }, rows: [
    '.....oooo.....',
    '...ooccccoo...',
    '..oCyyyyyyCo..',
    '.ocyyryyyyyco.',
    '.ocyyyyyryyco.',
    'oCyyyyyyyyyyCo',
    'ocyryyygyyyyco',
    'ocyyyyyyyyyrco',
    'ocyyyyryyyyyco',
    '.ocyryyyyryco.',
    '.ocyyyygyyyco.',
    '..oCyyyyyyCo..',
    '...ooccccoo...',
    '.....oooo.....',
  ] },
};
export function weaponSprite(id) { const d = WPN[id]; return Object.assign(bake(d.rows, d.map, 'w:' + id), { pivot: d.pivot }); }

// ------------------------------------------------------------------ projectiles / pickups / misc
const MISC = {
  bag: { map: { o: PAL.o, b: '#d9a060', B: '#b8803a', r: '#e23c2c', y: '#ffd23f' }, rows: ['.oooooo.', 'obbbbbbo', 'obbyybbo', 'obyrrybo', 'obbyybbo', 'obbbbbbo', 'oBBBBBBo', '.oooooo.'] },
  pizzabox: { map: { o: PAL.o, b: '#e8c890', B: '#c9a060', r: '#e23c2c' }, rows: ['oooooooooooo', 'obbbbbbbbbbo', 'obbrrrrrrbbo', 'obbbbbbbbbbo', 'oBBBBBBBBBBo', 'oooooooooooo'] },
  bigburger: { map: { o: PAL.o, b: '#e8a84a', B: '#c9842c', s: '#fff6e5', l: '#6cc04a', t: '#e8503a', c: '#ffd23f', m: '#7a3e12' }, rows: [
    '....oooooooo....', '..oobbbbbbbboo..', '.obbsbbbbsbbbbo.', 'obbbbbsbbbbbsbbo', 'oBBBBBBBBBBBBBBo', 'ollllllllllllllo', 'otttttttttttttto', 'occcccccccccccco', 'ommmmmmmmmmmmmmo', 'oBBBBBBBBBBBBBBo', 'ollllllllllllllo', 'ommmmmmmmmmmmmmo', 'oBBBBBBBBBBBBBBo', '.obbbbbbbbbbbbo.', '..oooooooooooo..'] },
  friesdart: { map: { o: PAL.o, y: '#ffd23f', Y: '#e8a92a' }, rows: ['oyyyyYo'] },
  bucket: { map: { o: PAL.o, y: '#ffd23f', Y: '#e8a92a', r: '#e23c2c', w: '#fff6e5', R: '#b52a1c' }, rows: ['.o.o.o.o.o.o.', 'oyoYoyoYoyoYo', 'oyyyyyyyyyyyo', '.oyyYyyyYyyo.', '.orrrrrrrrro.', '.orrwwrrwwro.', '.orrrwwwrrro.', '.oRrrrrrrrRo.', '.oRRRRRRRRRo.', '..ooooooooo..'] },
  nugget: { map: { o: PAL.o, n: '#e8a84a', N: '#c9842c' }, rows: ['.oooo.', 'onnNno', 'oNnnno', '.oooo.'] },
  sushi: { map: { o: PAL.o, w: '#fff6e5', s: '#ff8c5a', S: '#e05a3a', g: '#2a4a2a' }, rows: ['.oooooo.', 'osSsSsso', 'owwgwwwo', '.oooooo.'] },
  meteor: { map: { o: PAL.o, b: '#e8a84a', B: '#c9842c', s: '#fff6e5', l: '#6cc04a', t: '#e8503a', c: '#ffd23f', m: '#7a3e12' }, rows: [
    '.......oooooooooooooo.......',
    '.....oobbbbbbbbbbbbbboo.....',
    '....obbbsbbbsbbbbsbbbbbo....',
    '...obbbbbbbbbbsbbbbbsbbbo...',
    '...obbsbbbbsbbbbbbbbbbbbo...',
    '..oBBBBBBBBBBBBBBBBBBBBBBo..',
    '..ollllllllllllllllllllllo..',
    '.oltttttttttttttttttttttlo..',
    '.occccccccccccccccccccccco..',
    '.ommmmmmmmmmmmmmmmmmmmmmmo..',
    '.ommmmmmmmmmmmmmmmmmmmmmmo..',
    '..ottttttttttttttttttttto...',
    '..oBBBBBBBBBBBBBBBBBBBBBo...',
    '...obbbbbbbbbbbbbbbbbbbo....',
    '....ooooooooooooooooooo.....',
  ] },
  burger: { map: { o: PAL.o, b: '#e8a84a', B: '#c9842c', l: '#6cc04a', t: '#e8503a', m: '#7a3e12', s: '#fff6e5' }, rows: ['..oooooo..', '.obbsbbsbo', 'oBBBBBBBBo', 'ollllllllo', 'otttttttto', 'ommmmmmmmo', 'oBBBBBBBBo', '.oooooooo.'] },
  fries: { map: { o: PAL.o, y: '#ffd23f', r: '#e23c2c', w: '#fff6e5' }, rows: ['.o.o.o.o', 'oyoyoyoy', 'oyyyyyyo', 'orrrrrro', 'orwrrwro', 'orrwwrro', 'orrrrrro', '.oooooo.'] },
  cola: { map: { o: PAL.o, r: '#e23c2c', w: '#fff6e5', k: '#3a1a1a', s: '#9adcff' }, rows: ['..oso.', '..oso.', '.oooo.', 'orrrro', 'orwwro', 'orwrro', 'orrrro', 'okkkko', 'orrrro', '.oooo.'] },
  cap: { map: { o: PAL.o, h: '#e23c2c', H: '#ffd23f' }, rows: ['.oooo.', 'ohhhho', 'oHHHHo'] },
  debris: { map: { o: PAL.o, g: '#8d8da0', G: '#b8b8c8' }, rows: ['oGo', 'ogo', 'ooo'] },
};
export function miscSprite(id) { const d = MISC[id]; return bake(d.rows, d.map, 'm:' + id); }

// Palette of "food bits" each enemy explodes into on KO
export const KO_COLORS = {
  sushi: ['#fff6e5', '#ff8c5a', '#2a4a2a', '#e05a3a'],
  roll: ['#1a2a1e', '#fff6e5', '#e24b3a', '#6cc04a'],
  monk: ['#e07a1f', '#b03030', '#ffd23f', '#e9b98a'],
  boba: ['#6b4a2c', '#2b2238', '#3a2416', '#f0c9a0'],
  boss: ['#c04a30', '#ff9a3a', '#ffd23f', '#4f9b3a', '#fff6e5'],
};

// ------------------------------------------------------------------ 3x5 pixel font (A-Z 0-9 and a few symbols)
const FONT = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'], B: ['##.', '#.#', '##.', '#.#', '##.'], C: ['.##', '#..', '#..', '#..', '.##'], D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'], F: ['###', '#..', '##.', '#..', '#..'], G: ['.##', '#..', '#.#', '#.#', '.##'], H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'], J: ['..#', '..#', '..#', '#.#', '.#.'], K: ['#.#', '#.#', '##.', '#.#', '#.#'], L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '###', '#.#', '#.#'], N: ['##.', '#.#', '#.#', '#.#', '#.#'], O: ['.#.', '#.#', '#.#', '#.#', '.#.'], P: ['##.', '#.#', '##.', '#..', '#..'],
  Q: ['.#.', '#.#', '#.#', '.#.', '..#'], R: ['##.', '#.#', '##.', '#.#', '#.#'], S: ['.##', '#..', '.#.', '..#', '##.'], T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'], V: ['#.#', '#.#', '#.#', '#.#', '.#.'], W: ['#.#', '#.#', '###', '###', '#.#'], X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'], Z: ['###', '..#', '.#.', '#..', '###'],
  0: ['###', '#.#', '#.#', '#.#', '###'], 1: ['.#.', '##.', '.#.', '.#.', '###'], 2: ['##.', '..#', '.#.', '#..', '###'], 3: ['###', '..#', '.##', '..#', '###'],
  4: ['#.#', '#.#', '###', '..#', '..#'], 5: ['###', '#..', '##.', '..#', '##.'], 6: ['.##', '#..', '###', '#.#', '###'], 7: ['###', '..#', '.#.', '.#.', '.#.'],
  8: ['###', '#.#', '###', '#.#', '###'], 9: ['###', '#.#', '###', '..#', '##.'],
  ' ': ['...', '...', '...', '...', '...'], '!': ['.#.', '.#.', '.#.', '...', '.#.'], '-': ['...', '...', '###', '...', '...'], '.': ['...', '...', '...', '...', '.#.'],
  ':': ['...', '.#.', '...', '.#.', '...'], '>': ['#..', '.#.', '..#', '.#.', '#..'], '<': ['..#', '.#.', '#..', '.#.', '..#'], '+': ['...', '.#.', '###', '.#.', '...'],
  '/': ['..#', '..#', '.#.', '#..', '#..'], '%': ['#.#', '..#', '.#.', '#..', '#.#'], '×': ['...', '#.#', '.#.', '#.#', '...'], '♥': ['#.#', '###', '###', '.#.', '...'],
};
// draws pixel text; scale = integer pixel size
export function pixelText(g, str, x, y, color, scale = 1, align = 'left', shadow = true) {
  const s = String(str).toUpperCase();
  const w = s.length * 4 * scale - scale;
  let cx = align === 'center' ? Math.round(x - w / 2) : align === 'right' ? Math.round(x - w) : Math.round(x);
  for (const ch of s) {
    const gl = FONT[ch] || FONT[' '];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (gl[r][c] === '#') {
      if (shadow) { g.fillStyle = '#1b1026'; g.fillRect(cx + c * scale + scale, y + r * scale + scale, scale, scale); }
      g.fillStyle = color; g.fillRect(cx + c * scale, y + r * scale, scale, scale);
    }
    cx += 4 * scale;
  }
  return w;
}
export function pixelTextWidth(str, scale = 1) { return String(str).length * 4 * scale - scale; }

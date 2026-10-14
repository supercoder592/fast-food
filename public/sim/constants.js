// Shared constants for the simulation (used by both browser client and Node server).
export const W = 320;            // internal render width
export const H = 180;            // internal render height
export const TICK_RATE = 60;     // simulation ticks per second
export const SNAPSHOT_EVERY = 3; // server broadcasts every N ticks (20 Hz)

export const FLOOR_TOP = 106;    // walkable band (feet y)
export const FLOOR_BOT = 170;
export const GRAVITY = 0.42;     // z gravity per tick
export const STAGE_LEN = 2560;   // stage width in px

// input bits
export const IN = {
  L: 1, R: 2, U: 4, D: 8,
  ATK: 16, JUMP: 32, DASH: 64, SPEC: 128, SWAP: 256,
};

export const MAX_PLAYERS = 4;
export const PLAYER_HP = 120;
export const START_LIVES = 3;
export const METER_MAX = 100;

export const PHASE = { LOBBY: 'lobby', PLAY: 'play', CLEAR: 'clear', OVER: 'over' };

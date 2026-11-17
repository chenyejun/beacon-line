// Beacon Line — every tuning number, colour and wave table in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The last wave. Clearing it wins the game. */
export const FINAL_WAVE = 10;

export const LIGHTHOUSE = {
  x: FIELD.width / 2,
  y: FIELD.height / 2,
  radius: 46,
  maxHp: 220,
};

export const PLAYER = {
  radius: 16,
  speed: 265,
  maxHp: 100,
  /** Seconds of dashing; dash speed is a multiple of walk speed. */
  dashTime: 0.18,
  dashSpeed: 3.4,
  dashCooldown: 2.2,
  /** Brief protection right after a dash ends. */
  dashGrace: 0.12,
  /** Seconds of mercy after any hit, so one touch is not a stunlock. */
  hurtGrace: 0.7,
  fireRate: 5,
  bulletDamage: 10,
  bulletSpeed: 720,
  bulletRadius: 5,
  magnetRadius: 90,
  critChance: 0.05,
  critMultiplier: 2,
};

export const BULLET = { life: 1.1 };

/** How long a kill keeps the combo alive, and how much each combo step is worth. */
export const COMBO = { window: 3, perKill: 0.05, cap: 3 };

/**
 * The five enemy kinds. `split` names the kind (and count) born when one dies.
 * Speeds are px/s; hp scales with the wave.
 */
export const ENEMIES = {
  glimmer: {
    name: '微光', hp: 12, speed: 135, radius: 12, damage: 6, score: 10,
    color: '#7ef0ff', dark: '#1e7f96', attackInterval: 0.9, target: 'nearest',
  },
  crawler: {
    name: '爬行者', hp: 65, speed: 55, radius: 18, damage: 12, score: 25,
    color: '#8ac926', dark: '#3f6b12', attackInterval: 1.1, target: 'lighthouse',
  },
  splitter: {
    name: '分裂体', hp: 42, speed: 82, radius: 16, damage: 8, score: 30,
    color: '#b388ff', dark: '#5b3a9e', attackInterval: 1, target: 'nearest',
    split: { kind: 'mite', count: 2 },
  },
  mite: {
    name: '微芒', hp: 8, speed: 155, radius: 8, damage: 4, score: 5,
    color: '#d9b8ff', dark: '#7a5bb0', attackInterval: 0.7, target: 'nearest',
  },
  brute: {
    name: '蛮兽', hp: 240, speed: 42, radius: 27, damage: 20, score: 80,
    color: '#ff5964', dark: '#8f1d2c', attackInterval: 1.4, target: 'lighthouse',
  },
  dasher: {
    name: '突袭者', hp: 32, speed: 72, radius: 13, damage: 10, score: 50,
    color: '#ffb703', dark: '#8a5c00', attackInterval: 1, target: 'nearest',
    /** Seconds of flashing warning, then the charge. */
    telegraph: 0.7, chargeSpeed: 430, chargeTime: 0.5, recoverTime: 0.6, chargeRange: 330,
  },
};

/** Enemy counts per wave: [glimmer, crawler, splitter, dasher, brute]. */
export const WAVE_TABLE = [
  [8, 0, 0, 0, 0],
  [8, 3, 0, 0, 0],
  [10, 5, 2, 0, 0],
  [12, 7, 4, 2, 0],
  [12, 8, 6, 4, 2],
  [14, 9, 7, 5, 3],
  [16, 11, 8, 6, 4],
  [18, 13, 9, 7, 5],
  [20, 15, 11, 8, 6],
  [22, 17, 13, 9, 8],
];

export const WAVE = {
  hpScalePerWave: 0.1,
  speedScalePerWave: 0.03,
  maxSpeedScale: 1.25,
  /** Seconds between spawns at wave 1, shrinking each wave to a floor. */
  spawnInterval: 1.0,
  spawnStep: 0.05,
  minSpawnInterval: 0.4,
};

/** A light shard: what dead enemies sometimes drop. Collecting one heals and scores. */
export const SHARD = { radius: 9, heal: 2, score: 5, dropChance: 0.35, life: 12 };

export const PALETTE = {
  backdrop: '#070b1d',
  sea: '#0d1533',
  seaDeep: '#0a0f26',
  island: '#232a4a',
  islandEdge: '#39406b',
  sand: '#6b5f45',
  tower: '#f4ede0',
  towerBand: '#c0392b',
  lamp: '#ffd166',
  beam: '#ffe9a8',
  player: '#2ec4b6',
  playerDark: '#0f766e',
  bullet: '#ffe66d',
  text: '#eef1f5',
  muted: '#9aa3b8',
  panel: 'rgba(13, 20, 44, 0.92)',
  panelEdge: '#3d4a75',
  danger: '#ff5964',
  heal: '#7ee081',
  gold: '#ffd166',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'beacon-line.best';

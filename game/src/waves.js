// Waves and upgrades. A wave is a shuffled queue of enemy kinds with spawn delays;
// between waves the keeper picks one of three upgrades. Upgrades are data plus one
// small `apply` each, so the pool is easy to read and to extend.

import { FIELD, LIGHTHOUSE, PLAYER, WAVE, WAVE_TABLE } from './config.js';

const WAVE_KINDS = ['glimmer', 'crawler', 'splitter', 'dasher', 'brute'];

/** The spawn queue for a wave: kinds in a shuffled order, each with its delay. */
export function buildWaveQueue(wave, rng) {
  const counts = WAVE_TABLE[wave - 1];
  const kinds = [];
  for (let i = 0; i < counts.length; i += 1) {
    for (let n = 0; n < counts[i]; n += 1) kinds.push(WAVE_KINDS[i]);
  }
  // Shuffle, but keep the first spawn a glimmer so wave 1 never opens with a brute.
  for (let i = kinds.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng.next() * (i + 1));
    [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
  }
  if (kinds[0] !== 'glimmer') {
    const first = kinds.indexOf('glimmer');
    if (first > 0) [kinds[0], kinds[first]] = [kinds[first], kinds[0]];
  }
  const interval = Math.max(WAVE.minSpawnInterval, WAVE.spawnInterval - (wave - 1) * WAVE.spawnStep);
  return kinds.map((kind, i) => ({ kind, at: 0.5 + i * interval }));
}

/** A spawn point on the sea's edge, away from the keeper so nothing pops in on top of them. */
export function spawnPoint(rng, player) {
  for (let tries = 0; tries < 8; tries += 1) {
    const side = rng.int(0, 3);
    let x;
    let y;
    if (side === 0) { x = rng.range(30, FIELD.width - 30); y = 30; }
    else if (side === 1) { x = rng.range(30, FIELD.width - 30); y = FIELD.height - 30; }
    else if (side === 2) { x = 30; y = rng.range(30, FIELD.height - 30); }
    else { x = FIELD.width - 30; y = rng.range(30, FIELD.height - 30); }
    if (Math.hypot(x - player.x, y - player.y) > 260) return { x, y };
  }
  return { x: 40, y: 40 };
}

/** How many enemies a wave holds in total (for the "remaining" counter). */
export function waveTotal(wave) {
  return WAVE_TABLE[wave - 1].reduce((sum, count) => sum + count, 0);
}

// ---------------------------------------------------------------------------
// Upgrades. `max` is how many times one can be taken; `apply` mutates the game.
// ---------------------------------------------------------------------------

export const UPGRADES = [
  {
    id: 'lens', name: '聚光透镜', max: 99,
    desc: '子弹伤害 +25%',
    apply(game) { game.player.damage *= 1.25; },
  },
  {
    id: 'rapid', name: '速射机括', max: 99,
    desc: '射速 +20%',
    apply(game) { game.player.fireRate *= 1.2; },
  },
  {
    id: 'prism', name: '三叉光束', max: 3,
    desc: '每次开火多射出一发子弹',
    apply(game) { game.player.projectiles += 1; },
  },
  {
    id: 'boots', name: '疾行之靴', max: 99,
    desc: '移动速度 +15%',
    apply(game) { game.player.speed *= 1.15; },
  },
  {
    id: 'vigor', name: '守夜人体魄', max: 99,
    desc: '生命上限 +25，并完全恢复',
    apply(game) {
      game.player.maxHp += 25;
      game.player.hp = game.player.maxHp;
    },
  },
  {
    id: 'repair', name: '灯塔修缮', max: 99,
    desc: '灯塔恢复 40 点耐久',
    apply(game) {
      game.lighthouse.hp = Math.min(game.lighthouse.maxHp, game.lighthouse.hp + 40);
    },
  },
  {
    id: 'pierce', name: '穿透光矢', max: 3,
    desc: '子弹可再穿透 1 个敌人',
    apply(game) { game.player.pierce += 1; },
  },
  {
    id: 'magnet', name: '引力灯芯', max: 3,
    desc: '拾取范围 +140',
    apply(game) { game.player.magnetRadius += 140; },
  },
  {
    id: 'swift', name: '轻身冲刺', max: 3,
    desc: '冲刺冷却 -30%',
    apply(game) { game.dashCooldownMax = Math.max(0.8, game.dashCooldownMax * 0.7); },
  },
  {
    id: 'crit', name: '致命闪光', max: 4,
    desc: '暴击率 +10%（暴击造成双倍伤害）',
    apply(game) { game.player.critChance += 0.1; },
  },
];

export function upgradeById(id) {
  return UPGRADES.find((upgrade) => upgrade.id === id);
}

/** Three different upgrades the keeper has not maxed out yet. */
export function rollUpgrades(rng, stacks) {
  const available = UPGRADES.filter((upgrade) => (stacks[upgrade.id] || 0) < upgrade.max);
  const picks = [];
  while (picks.length < 3 && available.length > 0) {
    const index = Math.floor(rng.next() * available.length);
    picks.push(available.splice(index, 1)[0]);
  }
  return picks;
}

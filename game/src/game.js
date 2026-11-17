// The game itself: one state object, one fixed step, and every rule that is not
// about drawing or input. The keeper, the lighthouse, the bullets, the enemies, the
// shards, the combo and the waves all live here, so the loop in main.js only has to
// feed it input and the renderer only has to read it.

import {
  BULLET, COMBO, ENEMIES, FIELD, FINAL_WAVE, LIGHTHOUSE, PLAYER, SHARD,
} from './config.js';
import { createPlayer, hurtPlayer, updatePlayer } from './player.js';
import { clampEnemy, createEnemy, updateEnemy } from './enemies.js';
import { buildWaveQueue, rollUpgrades, spawnPoint, waveTotal } from './waves.js';

export const PHASE_TITLE = 'title';
export const PHASE_PLAY = 'play';
export const PHASE_UPGRADE = 'upgrade';
export const PHASE_PAUSED = 'paused';
export const PHASE_WIN = 'win';
export const PHASE_OVER = 'over';

const SILENT_AUDIO = {
  shoot() {}, hit() {}, explode() {}, split() {}, pickup() {}, hurt() {},
  dash() {}, upgrade() {}, horn() {}, win() {}, lose() {},
};

const MAX_PARTICLES = 400;
const MAX_FLOATERS = 24;

/** A fresh game: title screen, no run started yet. */
export function createGame(rng, audio) {
  const game = {
    rng,
    audio: audio || SILENT_AUDIO,
    phase: PHASE_TITLE,
    time: 0,
    beamAngle: 0,
    player: createPlayer(),
    lighthouse: { x: LIGHTHOUSE.x, y: LIGHTHOUSE.y, hp: LIGHTHOUSE.maxHp, maxHp: LIGHTHOUSE.maxHp, flash: 0 },
    dashCooldownMax: PLAYER.dashCooldown,
    bullets: [],
    enemies: [],
    shards: [],
    particles: [],
    floaters: [],
    wave: 0,
    spawnQueue: [],
    spawnIndex: 0,
    waveTime: 0,
    score: 0,
    kills: 0,
    combo: 0,
    comboTimer: 0,
    upgradeStacks: {},
    choices: [],
    banner: null,
    shake: 0,
    overReason: null,
    runTime: 0,
  };
  return bindGameHelpers(game);
}

/** Start (or restart) a run from wave 1. */
export function startRun(game) {
  game.player = createPlayer();
  game.lighthouse.hp = game.lighthouse.maxHp;
  game.lighthouse.flash = 0;
  game.dashCooldownMax = PLAYER.dashCooldown;
  game.bullets = [];
  game.enemies = [];
  game.shards = [];
  game.particles = [];
  game.floaters = [];
  game.wave = 0;
  game.score = 0;
  game.kills = 0;
  game.combo = 0;
  game.comboTimer = 0;
  game.upgradeStacks = {};
  game.choices = [];
  game.banner = null;
  game.shake = 0;
  game.overReason = null;
  game.runTime = 0;
  beginWave(game, 1);
  game.phase = PHASE_PLAY;
}

function beginWave(game, wave) {
  game.wave = wave;
  game.spawnQueue = buildWaveQueue(wave, game.rng);
  game.spawnIndex = 0;
  game.waveTime = 0;
  game.banner = { text: `第 ${wave} 波`, sub: wave === FINAL_WAVE ? '最后一波 —— 守住灯塔！' : `${waveTotal(wave)} 个敌人来袭`, time: 2.2 };
  game.audio.horn();
}

/** The keeper picks one of the three offered upgrades. */
export function applyUpgrade(game, upgrade) {
  upgrade.apply(game);
  game.upgradeStacks[upgrade.id] = (game.upgradeStacks[upgrade.id] || 0) + 1;
  game.choices = [];
  game.audio.upgrade();
  game.addFloatText(game.player.x, game.player.y - 30, upgrade.name, '#ffd166');
  game.spawnParticles(game.player.x, game.player.y, 24, '#ffd166', 200, 0.6);
  beginWave(game, game.wave + 1);
  game.phase = PHASE_PLAY;
}

// ---------------------------------------------------------------------------
// Helpers the player/enemy modules call back into.
// ---------------------------------------------------------------------------

export function addScore(game, base, x, y) {
  const multiplier = 1 + Math.min(game.combo * COMBO.perKill, COMBO.cap - 1);
  const gained = Math.round(base * multiplier);
  game.score += gained;
  return gained;
}

function spawnParticles(game, x, y, count, color, speed, life) {
  for (let i = 0; i < count; i += 1) {
    if (game.particles.length >= MAX_PARTICLES) return;
    const angle = game.rng.range(0, Math.PI * 2);
    const velocity = game.rng.range(speed * 0.3, speed);
    game.particles.push({
      x, y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      life: game.rng.range(life * 0.5, life),
      maxLife: life,
      size: game.rng.range(2, 5),
      color,
    });
  }
}

function addFloatText(game, x, y, text, color) {
  if (game.floaters.length >= MAX_FLOATERS) game.floaters.shift();
  game.floaters.push({ x, y, text, color, life: 1 });
}

function fireBullet(game, x, y, angle) {
  const crit = game.rng.next() < game.player.critChance;
  game.bullets.push({
    x, y,
    vx: Math.cos(angle) * game.player.bulletSpeed,
    vy: Math.sin(angle) * game.player.bulletSpeed,
    life: BULLET.life,
    damage: game.player.damage * (crit ? PLAYER.critMultiplier : 1),
    pierce: game.player.pierce,
    crit,
    hit: new Set(),
  });
}

function damagePlayer(game, amount) {
  if (hurtPlayer(game.player, amount, game)) {
    if (game.player.hp <= 0) endRun(game, 'player');
  }
}

function damageLighthouse(game, amount, x, y) {
  // The tower is stone: it takes only part of a blow. The keeper is softer.
  game.lighthouse.hp -= amount * 0.65;
  game.lighthouse.flash = 0.25;
  game.shake = Math.max(game.shake, 5);
  spawnParticles(game, x, y, 8, '#ff5964', 140, 0.35);
  game.audio.hit();
  if (game.lighthouse.hp <= 0) {
    game.lighthouse.hp = 0;
    endRun(game, 'lighthouse');
  }
}

function endRun(game, reason) {
  game.overReason = reason;
  game.phase = PHASE_OVER;
  game.shake = 14;
  spawnParticles(game, LIGHTHOUSE.x, LIGHTHOUSE.y, 60, '#ffd166', 320, 1);
  spawnParticles(game, game.player.x, game.player.y, 40, '#2ec4b6', 260, 0.9);
  game.audio.lose();
}

function killEnemy(game, enemy) {
  enemy.dead = true;
  game.kills += 1;
  game.combo += 1;
  game.comboTimer = COMBO.window;
  const gained = addScore(game, enemy.score, enemy.x, enemy.y);
  addFloatText(game, enemy.x, enemy.y - enemy.radius - 6, `+${gained}`, '#ffe66d');
  spawnParticles(game, enemy.x, enemy.y, 16, ENEMIES[enemy.kind].color, 200, 0.5);
  game.shake = Math.max(game.shake, 2.5);
  game.audio.explode();
  const def = ENEMIES[enemy.kind];
  if (def.split) {
    game.audio.split();
    for (let i = 0; i < def.split.count; i += 1) {
      const angle = game.rng.range(0, Math.PI * 2);
      const mite = createEnemy(def.split.kind, enemy.x + Math.cos(angle) * 14, enemy.y + Math.sin(angle) * 14, game.wave, game.rng);
      game.enemies.push(mite);
    }
    addFloatText(game, enemy.x, enemy.y + 18, '分裂！', '#b388ff');
  }
  if (game.rng.chance(SHARD.dropChance)) {
    game.shards.push({
      x: enemy.x, y: enemy.y,
      vx: game.rng.range(-40, 40), vy: game.rng.range(-40, 40),
      life: SHARD.life, phase: game.rng.range(0, Math.PI * 2),
    });
  }
}

// ---------------------------------------------------------------------------
// The fixed step. Only runs while the phase is PLAY; the title screen advances
// its own clock in main.js, and the upgrade screen waits for a pick.
// ---------------------------------------------------------------------------

export function stepGame(game, input, dt) {
  game.time += dt;
  game.runTime += dt;
  game.beamAngle += dt * 0.45;
  game.shake = Math.max(0, game.shake - dt * 26);
  game.lighthouse.flash = Math.max(0, game.lighthouse.flash - dt);
  if (game.banner) {
    game.banner.time -= dt;
    if (game.banner.time <= 0) game.banner = null;
  }

  // Combo: the timer runs out, the streak is gone.
  if (game.comboTimer > 0) {
    game.comboTimer -= dt;
    if (game.comboTimer <= 0) game.combo = 0;
  }

  // Spawn the wave on its schedule.
  game.waveTime += dt;
  while (game.spawnIndex < game.spawnQueue.length && game.spawnQueue[game.spawnIndex].at <= game.waveTime) {
    const spawn = game.spawnQueue[game.spawnIndex];
    game.spawnIndex += 1;
    const point = spawnPoint(game.rng, game.player);
    game.enemies.push(createEnemy(spawn.kind, point.x, point.y, game.wave, game.rng));
  }

  // The keeper.
  updatePlayer(game.player, input, dt, game);

  // Bullets: fly, fade, and pierce what they hit.
  for (let i = game.bullets.length - 1; i >= 0; i -= 1) {
    const bullet = game.bullets[i];
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    let spent = bullet.life <= 0
      || bullet.x < 0 || bullet.x > FIELD.width || bullet.y < 0 || bullet.y > FIELD.height;
    if (!spent) {
      for (let j = 0; j < game.enemies.length; j += 1) {
        const enemy = game.enemies[j];
        if (enemy.dead || bullet.hit.has(enemy)) continue;
        const dx = enemy.x - bullet.x;
        const dy = enemy.y - bullet.y;
        if (dx * dx + dy * dy < (enemy.radius + 5) * (enemy.radius + 5)) {
          bullet.hit.add(enemy);
          enemy.hp -= bullet.damage;
          enemy.flash = 0.12;
          spawnParticles(game, bullet.x, bullet.y, 4, bullet.crit ? '#ff9f1c' : '#ffe66d', 120, 0.25);
          game.audio.hit();
          if (enemy.hp <= 0) killEnemy(game, enemy);
          if (bullet.pierce > 0) {
            bullet.pierce -= 1;
          } else {
            spent = true;
          }
          break;
        }
      }
    }
    if (spent) game.bullets.splice(i, 1);
  }

  // Enemies: move, attack, and fall.
  for (let i = game.enemies.length - 1; i >= 0; i -= 1) {
    const enemy = game.enemies[i];
    if (enemy.dead) {
      game.enemies.splice(i, 1);
      continue;
    }
    updateEnemy(enemy, dt, game);
    clampEnemy(enemy);
    if (enemy.dead) game.enemies.splice(i, 1);
    if (game.phase !== PHASE_PLAY) return;
  }

  // Shards: drift, answer the magnet, and heal whoever picks them up.
  for (let i = game.shards.length - 1; i >= 0; i -= 1) {
    const shard = game.shards[i];
    shard.life -= dt;
    if (shard.life <= 0) {
      game.shards.splice(i, 1);
      continue;
    }
    const dx = game.player.x - shard.x;
    const dy = game.player.y - shard.y;
    const dist = Math.hypot(dx, dy);
    if (dist < game.player.magnetRadius) {
      const pull = 520 * (1 - dist / (game.player.magnetRadius + 1));
      shard.x += (dx / (dist || 1)) * pull * dt;
      shard.y += (dy / (dist || 1)) * pull * dt;
    } else {
      shard.x += shard.vx * dt;
      shard.y += shard.vy * dt;
      shard.vx *= 0.98;
      shard.vy *= 0.98;
    }
    if (dist < PLAYER.radius + SHARD.radius) {
      game.shards.splice(i, 1);
      game.player.hp = Math.min(game.player.maxHp, game.player.hp + SHARD.heal);
      const gained = addScore(game, SHARD.score, shard.x, shard.y);
      addFloatText(game, shard.x, shard.y - 10, `+${gained}`, '#7ee081');
      game.audio.pickup();
      spawnParticles(game, shard.x, shard.y, 6, '#7ee081', 120, 0.3);
    }
  }

  // Particles and floating text fade.
  for (let i = game.particles.length - 1; i >= 0; i -= 1) {
    const particle = game.particles[i];
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 0.985;
    particle.vy *= 0.985;
    if (particle.life <= 0) game.particles.splice(i, 1);
  }
  for (let i = game.floaters.length - 1; i >= 0; i -= 1) {
    const floater = game.floaters[i];
    floater.life -= dt * 0.9;
    floater.y -= 34 * dt;
    if (floater.life <= 0) game.floaters.splice(i, 1);
  }

  // Wave cleared: the last enemy falls and the queue is spent.
  if (game.spawnIndex >= game.spawnQueue.length && game.enemies.length === 0) {
    if (game.wave >= FINAL_WAVE) {
      game.phase = PHASE_WIN;
      game.audio.win();
      spawnParticles(game, LIGHTHOUSE.x, LIGHTHOUSE.y, 80, '#ffd166', 380, 1.2);
    } else {
      // Clearing a wave steadies the light: the tower is patched a little.
      game.lighthouse.hp = Math.min(game.lighthouse.maxHp, game.lighthouse.hp + 25);
      game.choices = rollUpgrades(game.rng, game.upgradeStacks);
      game.phase = PHASE_UPGRADE;
      game.audio.upgrade();
    }
  }
}

// Attach the helpers the other modules call as `game.method(...)`.
export function bindGameHelpers(game) {
  game.spawnParticles = (x, y, count, color, speed, life) => spawnParticles(game, x, y, count, color, speed, life);
  game.addFloatText = (x, y, text, color) => addFloatText(game, x, y, text, color);
  game.fireBullet = (x, y, angle) => fireBullet(game, x, y, angle);
  game.damagePlayer = (amount) => damagePlayer(game, amount);
  game.damageLighthouse = (amount, x, y) => damageLighthouse(game, amount, x, y);
  game.addShake = (amount) => { game.shake = Math.max(game.shake, amount); };
  return game;
}

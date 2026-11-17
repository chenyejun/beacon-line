// The five enemy kinds and how each one moves, picks a target and attacks. An enemy
// is a plain object owned by the game state; this file only knows how one behaves.
// The dasher is the only kind with a wind-up: it flashes and draws its charge ring
// for a beat before it lunges, so the player can always see it coming.

import { ENEMIES, FIELD, LIGHTHOUSE, PLAYER, WAVE } from './config.js';

/** A fresh enemy of `kind` at (x, y), its hp and speed scaled by the wave. */
export function createEnemy(kind, x, y, wave, rng) {
  const def = ENEMIES[kind];
  const hpScale = 1 + (wave - 1) * WAVE.hpScalePerWave;
  const speedScale = Math.min(WAVE.maxSpeedScale, 1 + (wave - 1) * WAVE.speedScalePerWave);
  return {
    kind,
    x,
    y,
    hp: def.hp * hpScale,
    maxHp: def.hp * hpScale,
    speed: def.speed * speedScale,
    radius: def.radius,
    damage: def.damage,
    score: def.score,
    attackCooldown: 0,
    flash: 0,
    // Dasher state machine: 'hunt' -> 'telegraph' -> 'charge' -> 'recover' -> 'hunt'.
    state: 'hunt',
    stateTime: 0,
    chargeDirX: 0,
    chargeDirY: 0,
    wobble: rng ? rng.range(0, Math.PI * 2) : 0,
  };
}

/** Where this enemy is headed: the keeper, the lighthouse, or whichever is closer. */
function pickTarget(enemy, game) {
  const def = ENEMIES[enemy.kind];
  const player = game.player;
  const lighthouse = game.lighthouse;
  const distPlayer = Math.hypot(player.x - enemy.x, player.y - enemy.y);
  const distLight = Math.hypot(lighthouse.x - enemy.x, lighthouse.y - enemy.y);
  if (def.target === 'lighthouse') return { x: lighthouse.x, y: lighthouse.y, radius: LIGHTHOUSE.radius, dist: distLight, isLighthouse: true };
  if (def.target === 'nearest') {
    return distPlayer <= distLight
      ? { x: player.x, y: player.y, radius: PLAYER.radius, dist: distPlayer, isLighthouse: false }
      : { x: lighthouse.x, y: lighthouse.y, radius: LIGHTHOUSE.radius, dist: distLight, isLighthouse: true };
  }
  return { x: lighthouse.x, y: lighthouse.y, radius: LIGHTHOUSE.radius, dist: distLight, isLighthouse: true };
}

function stepToward(enemy, tx, ty, speed, dt) {
  const dx = tx - enemy.x;
  const dy = ty - enemy.y;
  const dist = Math.hypot(dx, dy) || 1;
  enemy.x += (dx / dist) * speed * dt;
  enemy.y += (dy / dist) * speed * dt;
}

function tryAttack(enemy, target, game) {
  if (enemy.attackCooldown > 0) return;
  enemy.attackCooldown = ENEMIES[enemy.kind].attackInterval;
  if (target.isLighthouse) game.damageLighthouse(enemy.damage, enemy.x, enemy.y);
  else game.damagePlayer(enemy.damage);
}

/**
 * One step of one enemy. `game` carries the player, the lighthouse, the clock and
 * the callbacks the enemy needs (damage, particles, sound).
 */
export function updateEnemy(enemy, dt, game) {
  enemy.flash = Math.max(0, enemy.flash - dt);
  enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);
  enemy.stateTime += dt;
  const target = pickTarget(enemy, game);
  const reach = target.radius + enemy.radius + 2;

  if (enemy.kind === 'dasher') {
    updateDasher(enemy, target, reach, dt, game);
    return;
  }

  if (target.dist <= reach) {
    tryAttack(enemy, target, game);
    return;
  }
  // A slow wobble keeps the horde from marching in a perfect straight line.
  const wobble = Math.sin(game.time * 2.1 + enemy.wobble) * 0.35;
  const dx = target.x - enemy.x;
  const dy = target.y - enemy.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = dx / dist;
  const ny = dy / dist;
  enemy.x += (nx - ny * wobble) * enemy.speed * dt;
  enemy.y += (ny + nx * wobble) * enemy.speed * dt;
}

function updateDasher(enemy, target, reach, dt, game) {
  const def = ENEMIES.dasher;
  if (enemy.state === 'hunt') {
    if (target.dist <= reach) {
      tryAttack(enemy, target, game);
      return;
    }
    stepToward(enemy, target.x, target.y, enemy.speed, dt);
    if (target.dist < def.chargeRange && enemy.attackCooldown <= 0) {
      enemy.state = 'telegraph';
      enemy.stateTime = 0;
    }
    return;
  }
  if (enemy.state === 'telegraph') {
    // Stand still and flash: the warning the player reads.
    enemy.flash = 0.12;
    if (enemy.stateTime >= def.telegraph) {
      const dx = target.x - enemy.x;
      const dy = target.y - enemy.y;
      const dist = Math.hypot(dx, dy) || 1;
      enemy.chargeDirX = dx / dist;
      enemy.chargeDirY = dy / dist;
      enemy.state = 'charge';
      enemy.stateTime = 0;
      game.audio.dash();
    }
    return;
  }
  if (enemy.state === 'charge') {
    enemy.x += enemy.chargeDirX * def.chargeSpeed * dt;
    enemy.y += enemy.chargeDirY * def.chargeSpeed * dt;
    game.spawnParticles(enemy.x, enemy.y, 1, '#ffb703', 60, 0.2);
    // A charge that connects hurts, then the dasher is winded.
    const hitPlayer = Math.hypot(game.player.x - enemy.x, game.player.y - enemy.y) < PLAYER.radius + enemy.radius;
    const hitLight = Math.hypot(LIGHTHOUSE.x - enemy.x, LIGHTHOUSE.y - enemy.y) < LIGHTHOUSE.radius + enemy.radius;
    if (hitPlayer || hitLight) {
      if (hitPlayer) game.damagePlayer(enemy.damage);
      if (hitLight) game.damageLighthouse(enemy.damage, enemy.x, enemy.y);
      enemy.state = 'recover';
      enemy.stateTime = 0;
      enemy.attackCooldown = def.attackInterval;
      return;
    }
    if (enemy.stateTime >= def.chargeTime) {
      enemy.state = 'recover';
      enemy.stateTime = 0;
      enemy.attackCooldown = def.attackInterval;
    }
    return;
  }
  // Recover: stand still, then hunt again.
  if (enemy.stateTime >= def.recoverTime) {
    enemy.state = 'hunt';
    enemy.stateTime = 0;
  }
}

/** Keep enemies inside the sea; they spawn at the edge and never leave it. */
export function clampEnemy(enemy) {
  enemy.x = Math.max(enemy.radius, Math.min(FIELD.width - enemy.radius, enemy.x));
  enemy.y = Math.max(enemy.radius, Math.min(FIELD.height - enemy.radius, enemy.y));
}

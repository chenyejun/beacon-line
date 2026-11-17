// The lighthouse keeper: movement, the dash, and the light-gun. The keeper is a plain
// object owned by the game state; this file only knows how one behaves.

import { FIELD, LIGHTHOUSE, PLAYER } from './config.js';

/** A fresh keeper, standing south of the lighthouse, lamp lit. */
export function createPlayer() {
  return {
    x: LIGHTHOUSE.x,
    y: LIGHTHOUSE.y + 150,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    hp: PLAYER.maxHp,
    maxHp: PLAYER.maxHp,
    speed: PLAYER.speed,
    fireCooldown: 0,
    fireRate: PLAYER.fireRate,
    damage: PLAYER.bulletDamage,
    bulletSpeed: PLAYER.bulletSpeed,
    projectiles: 1,
    pierce: 0,
    magnetRadius: PLAYER.magnetRadius,
    critChance: PLAYER.critChance,
    dashCooldown: 0,
    dashTime: 0,
    dashDirX: 0,
    dashDirY: -1,
    grace: 0,
    hurtGrace: 0,
    flash: 0,
  };
}

/**
 * Move, dash and shoot for one step. `input` is the frame shape { mx, my, aimX, aimY,
 * firing, dash }; `game` is the whole state, used for firing bullets, particles and
 * sound. Returns nothing; the bullets it fires land in game.bullets.
 */
export function updatePlayer(player, input, dt, game) {
  player.hurtGrace = Math.max(0, player.hurtGrace - dt);
  player.grace = Math.max(0, player.grace - dt);
  player.flash = Math.max(0, player.flash - dt);
  player.dashCooldown = Math.max(0, player.dashCooldown - dt);
  player.fireCooldown = Math.max(0, player.fireCooldown - dt);

  // Aim follows the pointer; the keeper's lamp always points where the player looks.
  player.angle = Math.atan2(input.aimY - player.y, input.aimX - player.x);

  if (player.dashTime > 0) {
    player.dashTime -= dt;
    player.x += player.dashDirX * PLAYER.speed * PLAYER.dashSpeed * dt;
    player.y += player.dashDirY * PLAYER.speed * PLAYER.dashSpeed * dt;
    player.grace = Math.max(player.grace, PLAYER.dashGrace);
    game.spawnParticles(player.x, player.y, 2, '#7ef0ff', 90, 0.25);
  } else {
    const speed = player.speed * (input.mx !== 0 || input.my !== 0 ? 1 : 0);
    player.vx = input.mx * speed;
    player.vy = input.my * speed;
    player.x += player.vx * dt;
    player.y += player.vy * dt;

    if (input.dash && player.dashCooldown <= 0) {
      const dirX = input.mx !== 0 || input.my !== 0 ? input.mx : Math.cos(player.angle);
      const dirY = input.mx !== 0 || input.my !== 0 ? input.my : Math.sin(player.angle);
      player.dashDirX = dirX;
      player.dashDirY = dirY;
      player.dashTime = PLAYER.dashTime;
      player.dashCooldown = game.dashCooldownMax;
      game.audio.dash();
      game.spawnParticles(player.x, player.y, 10, '#7ef0ff', 160, 0.3);
    }
  }

  // The island is round: keep the keeper on the rock and out of the tower.
  const dx = player.x - LIGHTHOUSE.x;
  const dy = player.y - LIGHTHOUSE.y;
  const dist = Math.hypot(dx, dy);
  const islandRadius = 300;
  if (dist > islandRadius) {
    player.x = LIGHTHOUSE.x + (dx / dist) * islandRadius;
    player.y = LIGHTHOUSE.y + (dy / dist) * islandRadius;
  } else if (dist < LIGHTHOUSE.radius + PLAYER.radius) {
    const push = LIGHTHOUSE.radius + PLAYER.radius;
    player.x = LIGHTHOUSE.x + (dx / (dist || 1)) * push;
    player.y = LIGHTHOUSE.y + (dy / (dist || 1)) * push;
  }
  player.x = Math.max(PLAYER.radius, Math.min(FIELD.width - PLAYER.radius, player.x));
  player.y = Math.max(PLAYER.radius, Math.min(FIELD.height - PLAYER.radius, player.y));

  // Hold the trigger: a spread of light-bolts, one per projectile.
  if (input.firing && player.fireCooldown <= 0) {
    player.fireCooldown = 1 / player.fireRate;
    const spread = 0.13;
    const count = player.projectiles;
    for (let i = 0; i < count; i += 1) {
      const offset = count === 1 ? 0 : (i - (count - 1) / 2) * spread;
      game.fireBullet(player.x, player.y, player.angle + offset);
    }
    game.audio.shoot();
    game.spawnParticles(
      player.x + Math.cos(player.angle) * 22,
      player.y + Math.sin(player.angle) * 22,
      1, '#ffe66d', 40, 0.12,
    );
  }
}

/** A hit the keeper can feel: damage, a white flash, and mercy time after it. */
export function hurtPlayer(player, amount, game) {
  if (player.grace > 0 || player.hurtGrace > 0 || player.dashTime > 0) return false;
  player.hp -= amount;
  player.flash = 0.25;
  player.hurtGrace = PLAYER.hurtGrace;
  game.audio.hurt();
  game.addShake(7);
  game.spawnParticles(player.x, player.y, 12, '#ff5964', 180, 0.4);
  return true;
}

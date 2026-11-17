// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the
// backdrop colour. Everything is drawn from shapes and gradients — no images, no
// fonts loaded from anywhere. The lighthouse beam, the sea shimmer and every pulse
// read the simulation clock (`game.time`), never the wall clock, so a staged
// screenshot scene paints exactly what the simulation reached.

import { ENEMIES, FIELD, FONT, LIGHTHOUSE, PALETTE, PLAYER } from './config.js';
import { PHASE_OVER, PHASE_PAUSED, PHASE_PLAY, PHASE_TITLE, PHASE_UPGRADE, PHASE_WIN } from './game.js';
import {
  drawBanner, drawEnd, drawHud, drawPaused, drawTitle, drawUpgrade,
} from './ui.js';

export const SCREEN_TITLE = PHASE_TITLE;
export const SCREEN_PLAY = PHASE_PLAY;
export const SCREEN_PAUSED = PHASE_PAUSED;
export const SCREEN_UPGRADE = PHASE_UPGRADE;
export const SCREEN_WIN = PHASE_WIN;
export const SCREEN_OVER = PHASE_OVER;

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  /** Map a client pixel to a playfield point (for the mouse). */
  function toLogical(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const deviceX = (clientX - rect.left) * (canvas.width / rect.width);
    const deviceY = (clientY - rect.top) * (canvas.height / rect.height);
    return {
      x: (deviceX - view.x) / view.scale,
      y: (deviceY - view.y) / view.scale,
    };
  }

  function text(value, x, y, size, color, align, weight) {
    const key = `${weight || 400}:${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight || 400} ${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align || 'center';
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function circle(x, y, radius, color) {
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  function drawSea(game) {
    const gradient = context.createRadialGradient(
      LIGHTHOUSE.x, LIGHTHOUSE.y, 60, LIGHTHOUSE.x, LIGHTHOUSE.y, 720,
    );
    gradient.addColorStop(0, '#16204a');
    gradient.addColorStop(0.45, PALETTE.sea);
    gradient.addColorStop(1, PALETTE.seaDeep);
    context.fillStyle = gradient;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // Slow shimmer rings, driven by the simulation clock.
    context.strokeStyle = 'rgba(126, 240, 255, 0.07)';
    context.lineWidth = 2;
    for (let i = 0; i < 5; i += 1) {
      const radius = 180 + i * 95 + Math.sin(game.time * 0.5 + i * 1.7) * 12;
      context.beginPath();
      context.arc(LIGHTHOUSE.x, LIGHTHOUSE.y, radius, 0, Math.PI * 2);
      context.stroke();
    }
  }

  function drawIsland() {
    context.fillStyle = PALETTE.island;
    context.beginPath();
    context.arc(LIGHTHOUSE.x, LIGHTHOUSE.y, 308, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = PALETTE.islandEdge;
    context.lineWidth = 5;
    context.stroke();
    context.fillStyle = PALETTE.sand;
    context.beginPath();
    context.arc(LIGHTHOUSE.x, LIGHTHOUSE.y, 288, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#7d7050';
    // A few rocks, fixed places so the island reads the same every run.
    const rocks = [[-210, 120, 16], [190, -160, 20], [120, 210, 13], [-160, -200, 15], [250, 60, 12]];
    for (const [rx, ry, rr] of rocks) {
      circle(LIGHTHOUSE.x + rx, LIGHTHOUSE.y + ry, rr, '#5c5340');
    }
  }

  function drawBeam(game) {
    const angle = game.beamAngle;
    const length = 560;
    const spread = 0.16;
    const gradient = context.createRadialGradient(
      LIGHTHOUSE.x, LIGHTHOUSE.y, 10, LIGHTHOUSE.x, LIGHTHOUSE.y, length,
    );
    gradient.addColorStop(0, 'rgba(255, 233, 168, 0.34)');
    gradient.addColorStop(1, 'rgba(255, 233, 168, 0)');
    context.fillStyle = gradient;
    context.beginPath();
    context.moveTo(LIGHTHOUSE.x, LIGHTHOUSE.y);
    context.arc(LIGHTHOUSE.x, LIGHTHOUSE.y, length, angle - spread, angle + spread);
    context.closePath();
    context.fill();
    // The counter-beam, fainter, so the sweep reads from both sides.
    context.fillStyle = 'rgba(255, 233, 168, 0.10)';
    context.beginPath();
    context.moveTo(LIGHTHOUSE.x, LIGHTHOUSE.y);
    context.arc(LIGHTHOUSE.x, LIGHTHOUSE.y, length, angle + Math.PI - spread, angle + Math.PI + spread);
    context.closePath();
    context.fill();
  }

  function drawLighthouse(game) {
    const { x, y } = game.lighthouse;
    const hpFraction = game.lighthouse.hp / game.lighthouse.maxHp;
    // A warm halo that shrinks as the lighthouse weakens.
    const halo = context.createRadialGradient(x, y, 10, x, y, 150);
    halo.addColorStop(0, `rgba(255, 209, 102, ${0.28 * hpFraction + 0.06})`);
    halo.addColorStop(1, 'rgba(255, 209, 102, 0)');
    context.fillStyle = halo;
    context.beginPath();
    context.arc(x, y, 150, 0, Math.PI * 2);
    context.fill();
    // The tower: a striped cone with a lamp room on top.
    context.fillStyle = game.lighthouse.flash > 0 ? '#ffffff' : PALETTE.tower;
    context.beginPath();
    context.moveTo(x - 30, y + 26);
    context.lineTo(x - 16, y - 34);
    context.lineTo(x + 16, y - 34);
    context.lineTo(x + 30, y + 26);
    context.closePath();
    context.fill();
    context.fillStyle = PALETTE.towerBand;
    context.beginPath();
    context.moveTo(x - 24, y + 2);
    context.lineTo(x - 19, y - 14);
    context.lineTo(x + 19, y - 14);
    context.lineTo(x + 24, y + 2);
    context.closePath();
    context.fill();
    context.fillStyle = '#2a2f45';
    context.fillRect(x - 14, y - 48, 28, 16);
    const lampPulse = 0.85 + 0.15 * Math.sin(game.time * 4);
    context.fillStyle = `rgba(255, 209, 102, ${lampPulse})`;
    context.fillRect(x - 9, y - 45, 18, 10);
    // The base rock.
    context.fillStyle = '#3a3f5c';
    context.beginPath();
    context.ellipse(x, y + 28, 46, 12, 0, 0, Math.PI * 2);
    context.fill();
    if (hpFraction < 0.35) {
      // Smoke when the lighthouse is nearly gone.
      context.fillStyle = 'rgba(120, 120, 130, 0.5)';
      const smokeY = y - 60 - ((game.time * 30) % 40);
      context.beginPath();
      context.arc(x + Math.sin(game.time * 2) * 6, smokeY, 10, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawPlayer(game) {
    const player = game.player;
    if (player.hp <= 0) return;
    const blink = player.hurtGrace > 0 && Math.floor(player.hurtGrace * 12) % 2 === 0;
    context.save();
    context.translate(player.x, player.y);
    if (player.dashTime > 0) context.globalAlpha = 0.75;
    else if (blink) context.globalAlpha = 0.35;
    // The keeper's lantern glow.
    const glow = context.createRadialGradient(0, 0, 4, 0, 0, 44);
    glow.addColorStop(0, 'rgba(255, 209, 102, 0.5)');
    glow.addColorStop(1, 'rgba(255, 209, 102, 0)');
    context.fillStyle = glow;
    context.beginPath();
    context.arc(0, 0, 44, 0, Math.PI * 2);
    context.fill();
    // Body: a teal cloak, drawn as a circle with a hood.
    context.rotate(player.angle);
    circle(0, 0, PLAYER.radius, player.flash > 0 ? '#ffffff' : PALETTE.player);
    context.fillStyle = PALETTE.playerDark;
    context.beginPath();
    context.arc(4, 0, 9, 0, Math.PI * 2);
    context.fill();
    // The lamp at the end of the arm.
    circle(20, 0, 6, '#ffd166');
    context.fillStyle = '#fff3c4';
    circle(20, 0, 3, '#fff3c4');
    context.restore();
    // Dash cooldown ring under the keeper.
    if (player.dashCooldown > 0) {
      const fraction = 1 - player.dashCooldown / game.dashCooldownMax;
      context.strokeStyle = 'rgba(126, 240, 255, 0.8)';
      context.lineWidth = 3;
      context.beginPath();
      context.arc(player.x, player.y, PLAYER.radius + 7, -Math.PI / 2, -Math.PI / 2 + fraction * Math.PI * 2);
      context.stroke();
    }
  }

  function drawEnemies(game) {
    for (const enemy of game.enemies) {
      const def = ENEMIES[enemy.kind];
      context.save();
      context.translate(enemy.x, enemy.y);
      // The dasher's telegraph: a growing ring and a hard flash.
      if (enemy.kind === 'dasher' && enemy.state === 'telegraph') {
        const progress = enemy.stateTime / def.telegraph;
        context.strokeStyle = `rgba(255, 183, 3, ${0.4 + 0.6 * progress})`;
        context.lineWidth = 3;
        context.beginPath();
        context.arc(0, 0, enemy.radius + 8 + progress * 22, 0, Math.PI * 2);
        context.stroke();
        text('!', 0, -enemy.radius - 16, 22, '#ffb703', 'center', 800);
      }
      const flash = enemy.flash > 0 || (enemy.kind === 'dasher' && enemy.state === 'telegraph' && Math.floor(enemy.stateTime * 14) % 2 === 0);
      // Shadow blob, then the body.
      context.fillStyle = 'rgba(0, 0, 0, 0.35)';
      context.beginPath();
      context.ellipse(0, enemy.radius * 0.7, enemy.radius * 0.9, enemy.radius * 0.4, 0, 0, Math.PI * 2);
      context.fill();
      circle(0, 0, enemy.radius, flash ? '#ffffff' : def.color);
      context.strokeStyle = def.dark;
      context.lineWidth = 2.5;
      context.beginPath();
      context.arc(0, 0, enemy.radius, 0, Math.PI * 2);
      context.stroke();
      // Kind glyphs, so each enemy reads at a glance.
      context.fillStyle = def.dark;
      if (enemy.kind === 'glimmer') {
        context.beginPath();
        context.arc(0, 0, enemy.radius * 0.35, 0, Math.PI * 2);
        context.fill();
      } else if (enemy.kind === 'crawler') {
        for (const [ox, oy] of [[-5, -4], [5, -4], [-5, 5], [5, 5]]) {
          context.beginPath();
          context.arc(ox, oy, 2.5, 0, Math.PI * 2);
          context.fill();
        }
      } else if (enemy.kind === 'splitter') {
        context.beginPath();
        context.arc(-5, 0, 5, 0, Math.PI * 2);
        context.arc(5, 0, 5, 0, Math.PI * 2);
        context.fill();
      } else if (enemy.kind === 'brute') {
        context.beginPath();
        context.moveTo(-8, -8); context.lineTo(8, -8); context.lineTo(0, 8);
        context.closePath();
        context.fill();
      } else if (enemy.kind === 'dasher') {
        context.beginPath();
        context.moveTo(10, 0); context.lineTo(-8, -7); context.lineTo(-8, 7);
        context.closePath();
        context.fill();
      } else if (enemy.kind === 'mite') {
        context.beginPath();
        context.arc(0, 0, 3, 0, Math.PI * 2);
        context.fill();
      }
      // A thin health bar over anything that has been hurt.
      if (enemy.hp < enemy.maxHp) {
        const width = enemy.radius * 2;
        context.fillStyle = 'rgba(0, 0, 0, 0.55)';
        context.fillRect(-width / 2, -enemy.radius - 10, width, 4);
        context.fillStyle = '#ff5964';
        context.fillRect(-width / 2, -enemy.radius - 10, width * Math.max(0, enemy.hp / enemy.maxHp), 4);
      }
      context.restore();
    }
  }

  function drawBullets(game) {
    for (const bullet of game.bullets) {
      const angle = Math.atan2(bullet.vy, bullet.vx);
      context.save();
      context.translate(bullet.x, bullet.y);
      context.rotate(angle);
      context.fillStyle = bullet.crit ? '#ff9f1c' : '#ffe66d';
      context.beginPath();
      context.ellipse(0, 0, 11, 3.5, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = 'rgba(255, 255, 255, 0.9)';
      context.beginPath();
      context.ellipse(3, 0, 5, 2, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  }

  function drawShards(game) {
    for (const shard of game.shards) {
      const blink = 0.6 + 0.4 * Math.sin(game.time * 6 + shard.phase);
      context.save();
      context.globalAlpha = blink;
      context.translate(shard.x, shard.y);
      context.rotate(game.time * 2 + shard.phase);
      context.fillStyle = '#7ee081';
      context.fillRect(-5, -5, 10, 10);
      context.fillStyle = '#d8ffd8';
      context.fillRect(-2, -2, 4, 4);
      context.restore();
    }
  }

  function drawParticles(game) {
    for (const particle of game.particles) {
      context.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      circle(particle.x, particle.y, particle.size, particle.color);
    }
    context.globalAlpha = 1;
  }

  function drawFloaters(game) {
    for (const floater of game.floaters) {
      context.globalAlpha = Math.max(0, Math.min(1, floater.life));
      text(floater.text, floater.x, floater.y, 17, floater.color, 'center', 700);
    }
    context.globalAlpha = 1;
  }

  function drawWorld(game) {
    drawSea(game);
    drawIsland();
    drawBeam(game);
    drawLighthouse(game);
    drawShards(game);
    drawEnemies(game);
    drawPlayer(game);
    drawBullets(game);
    drawParticles(game);
    drawFloaters(game);
  }

  /** Paint one frame: the world, then the HUD or a panel for the screen the game is on. */
  function draw(game, screen, best, hoverIndex) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const shakeX = game.shake > 0 ? (Math.sin(game.time * 91) * game.shake) : 0;
    const shakeY = game.shake > 0 ? (Math.cos(game.time * 83) * game.shake) : 0;
    context.setTransform(view.scale, 0, 0, view.scale, view.x + shakeX * view.scale, view.y + shakeY * view.scale);
    drawWorld(game);
    if (screen === SCREEN_TITLE) {
      drawTitle(context, game, best);
      return;
    }
    drawHud(context, game);
    drawBanner(context, game);
    if (screen === SCREEN_UPGRADE) drawUpgrade(context, game, hoverIndex);
    else if (screen === SCREEN_WIN) drawEnd(context, game, best, true);
    else if (screen === SCREEN_OVER) drawEnd(context, game, best, false);
    else if (screen === SCREEN_PAUSED) drawPaused(context);
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toLogical };
}

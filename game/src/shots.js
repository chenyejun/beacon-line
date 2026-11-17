// The screenshot scenes behind ?shot=start|play|upgrade|end. Each one plays the real
// rules forward from a fresh run for a fixed number of steps, steered by a simple
// autopilot, so the frame is what a short game really looks like and the same seed
// always gives the same frame. No wall clock, no Math.random: only the seeded game.

import { LIGHTHOUSE, STEP } from './config.js';
import { PHASE_OVER, PHASE_PLAY, PHASE_UPGRADE, applyUpgrade, startRun, stepGame } from './game.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 16;
const UPGRADE_LIMIT_SECONDS = 150;
const END_LIMIT_SECONDS = 300;

/** The nearest living enemy to the keeper, or null when the sea is empty. */
function nearestEnemy(game) {
  let best = null;
  let bestDist = Infinity;
  for (const enemy of game.enemies) {
    const dist = Math.hypot(enemy.x - game.player.x, enemy.y - game.player.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = enemy;
    }
  }
  return best === null ? null : { enemy: best, dist: bestDist };
}

/**
 * The autopilot's frame: aim at the nearest enemy and shoot it, keep a fighting
 * distance, and dash away when something gets too close.
 */
export function autopilotInput(game) {
  const found = nearestEnemy(game);
  const player = game.player;
  let mx = 0;
  let my = 0;
  let aimX = player.x;
  let aimY = player.y - 100;
  let firing = false;
  let dash = false;

  if (found) {
    const { enemy, dist } = found;
    aimX = enemy.x;
    aimY = enemy.y;
    firing = dist < 620;
    // Too close: back away. Too far: close in. In between: strafe.
    let dirX = 0;
    let dirY = 0;
    if (dist < 150) {
      dirX = (player.x - enemy.x) / dist;
      dirY = (player.y - enemy.y) / dist;
    } else if (dist > 330) {
      dirX = (enemy.x - player.x) / dist;
      dirY = (enemy.y - player.y) / dist;
    } else {
      dirX = -(enemy.y - player.y) / dist;
      dirY = (enemy.x - player.x) / dist;
    }
    mx = dirX;
    my = dirY;
    if (dist < 70 && player.dashCooldown <= 0) dash = true;
  } else {
    // Nothing to shoot: drift back toward the lighthouse's south side.
    const dx = LIGHTHOUSE.x - player.x;
    const dy = LIGHTHOUSE.y + 150 - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 20) {
      mx = dx / dist;
      my = dy / dist;
    }
  }

  // Never walk into the tower.
  const lightDx = player.x - LIGHTHOUSE.x;
  const lightDy = player.y - LIGHTHOUSE.y;
  const lightDist = Math.hypot(lightDx, lightDy);
  if (lightDist < 90) {
    mx += (lightDx / (lightDist || 1)) * 1.5;
    my += (lightDy / (lightDist || 1)) * 1.5;
  }
  const length = Math.hypot(mx, my);
  if (length > 1) {
    mx /= length;
    my /= length;
  }
  return { mx, my, aimX, aimY, firing, dash };
}

/** The frame of a keeper who never fights: the end scene's way to lose. */
function idleInput() {
  return { mx: 0, my: 0, aimX: 640, aimY: 200, firing: false, dash: false };
}

/**
 * Set `game` to the named scene (start, play, upgrade or end; any other name is
 * start) and return the screen to draw over it.
 */
export function stageShot(name, game) {
  if (name !== 'play' && name !== 'upgrade' && name !== 'end') {
    // The title: a few seconds of lamplight so the beam has swept somewhere.
    game.time = START_SECONDS;
    game.beamAngle = START_SECONDS * 0.45;
    return { screen: SCREEN_TITLE };
  }

  startRun(game);
  if (name === 'play') {
    // Keep the fight going for the whole scene: if a wave is cleared mid-scene,
    // take the first upgrade and carry on into the next wave.
    for (let t = 0; t < PLAY_SECONDS; t += STEP) {
      if (game.phase === PHASE_OVER) break;
      if (game.phase === PHASE_UPGRADE) applyUpgrade(game, game.choices[0]);
      else stepGame(game, autopilotInput(game), STEP);
    }
    return { screen: game.phase === PHASE_OVER ? SCREEN_OVER : SCREEN_PLAY };
  }
  if (name === 'upgrade') {
    for (let t = 0; t < UPGRADE_LIMIT_SECONDS; t += STEP) {
      if (game.phase === PHASE_UPGRADE) break;
      if (game.phase !== PHASE_PLAY) break;
      stepGame(game, autopilotInput(game), STEP);
    }
    return { screen: game.phase === PHASE_UPGRADE ? SCREEN_UPGRADE : SCREEN_PLAY };
  }
  // End: stand still and never fire, until the light goes out.
  for (let t = 0; t < END_LIMIT_SECONDS; t += STEP) {
    if (game.phase === PHASE_OVER) break;
    stepGame(game, idleInput(), STEP);
  }
  return { screen: game.phase === PHASE_OVER ? SCREEN_OVER : SCREEN_PLAY };
}

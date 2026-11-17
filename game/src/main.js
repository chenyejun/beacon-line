// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between six screens: title, play, upgrade, paused, win and over.
//
// ?seed=N fixes the random pattern. ?shot=start|play|upgrade|end (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets window.__shotReady
// for a screenshot.

import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_RESTART, ACTION_UPGRADE_1, ACTION_UPGRADE_2, ACTION_UPGRADE_3 } from './input.js';
import {
  PHASE_OVER, PHASE_PLAY, PHASE_UPGRADE, PHASE_WIN, applyUpgrade, createGame, startRun, stepGame,
} from './game.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE, SCREEN_WIN } from './render.js';
import { upgradeCardAt } from './ui.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();
const game = createGame(createRandom(seed), audio);
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, game);
  const hoverIndex = scene.screen === SCREEN_UPGRADE ? 1 : -1;
  let painted = 0;
  function paint() {
    renderer.draw(game, scene.screen, readBest(), hoverIndex);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, renderer.toLogical, () => audio.unlock());
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let mouseLogical = { x: 640, y: 360 };

  canvas.addEventListener('pointermove', (event) => {
    mouseLogical = renderer.toLogical(event.clientX, event.clientY);
  });

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    startRun(game);
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Defend the lighthouse through 10 waves.');
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (game.score > best) {
      best = game.score;
      saveBest(best);
    }
    announce(won
      ? `Victory. Score ${game.score}. Best ${best}.`
      : `The light went out on wave ${game.wave}. Score ${game.score}. Best ${best}.`);
  }

  function pickUpgrade(index) {
    const choice = game.choices[index];
    if (!choice) return;
    applyUpgrade(game, choice);
    screen = SCREEN_PLAY;
    announce(`Took ${choice.name}. Wave ${game.wave} incoming.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_RESTART) {
      if (screen !== SCREEN_TITLE) startGame();
      return;
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startGame();
      return;
    }
    if (screen === SCREEN_UPGRADE) {
      if (actions & ACTION_UPGRADE_1) pickUpgrade(0);
      else if (actions & ACTION_UPGRADE_2) pickUpgrade(1);
      else if (actions & ACTION_UPGRADE_3) pickUpgrade(2);
      return;
    }
    if (screen === SCREEN_WIN || screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM) startGame();
      return;
    }
    if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      }
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  // Clicking a card picks it; clicking anywhere else on the end screens restarts.
  canvas.addEventListener('pointerdown', (event) => {
    const point = renderer.toLogical(event.clientX, event.clientY);
    if (screen === SCREEN_UPGRADE) {
      const index = upgradeCardAt(point.x, point.y);
      if (index >= 0) pickUpgrade(index);
    }
  });

  function hoverIndex() {
    if (screen !== SCREEN_UPGRADE) return -1;
    return upgradeCardAt(mouseLogical.x, mouseLogical.y);
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      // The title is alive: the beam sweeps and the sea shimmers on the game clock.
      game.time += STEP;
      game.beamAngle += STEP * 0.45;
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    stepGame(game, input.frame(), STEP);
    if (game.phase === PHASE_UPGRADE) {
      screen = SCREEN_UPGRADE;
      announce(`Wave ${game.wave} cleared. Choose an upgrade.`);
    } else if (game.phase === PHASE_WIN) {
      endGame(true);
    } else if (game.phase === PHASE_OVER) {
      endGame(false);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
      step();
      accumulator -= STEP;
    }
    if (screen !== SCREEN_TITLE && screen !== SCREEN_PLAY) accumulator = 0;
    renderer.draw(game, screen, best, hoverIndex());
  }

  // Leaving the tab pauses a running game rather than letting the night fall unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Beacon Line. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();

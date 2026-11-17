// Keyboard and pointer input. Held keys and the pointer give a live steering state
// every frame; one-shot presses (start, pause, restart, dash, upgrade picks) are queued
// as bit flags and taken once by the loop, so a press between two frames is never lost
// and never counted twice. The loop reads one plain object per frame:
// { mx, my, aimX, aimY, firing, dash } — the autopilot in shots.js builds the same
// shape, so the simulation never knows whether a human or a script is playing.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_UPGRADE_1 = 8;
export const ACTION_UPGRADE_2 = 16;
export const ACTION_UPGRADE_3 = 32;

const UP = new Set(['KeyW', 'ArrowUp']);
const DOWN = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const DASH = new Set(['ShiftLeft', 'ShiftRight', 'Space']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const RESTART = new Set(['KeyR']);
const PICK = new Map([['Digit1', ACTION_UPGRADE_1], ['Digit2', ACTION_UPGRADE_2], ['Digit3', ACTION_UPGRADE_3]]);

/**
 * `toLogical` maps a client pixel to a playfield point (the renderer owns the scale).
 * `onFirstGesture` runs once, on the first key or pointer press — the audio unlock.
 */
export function createInput(canvas, toLogical, onFirstGesture) {
  const keys = new Set();
  const mouse = { x: 640, y: 200, down: false };
  let actions = 0;
  let gestured = false;

  function gesture() {
    if (!gestured) {
      gestured = true;
      if (onFirstGesture) onFirstGesture();
    }
  }

  window.addEventListener('keydown', (event) => {
    gesture();
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      keys.add(event.code);
    } else if (DASH.has(event.code)) {
      // Space also confirms on the title and end screens (the loop reads it there);
      // in play it is only a dash, and starting with a dash is harmless.
      if (event.code === 'Space' && !event.repeat) actions |= ACTION_CONFIRM;
      keys.add(event.code);
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (RESTART.has(event.code)) {
      if (!event.repeat) actions |= ACTION_RESTART;
    } else if (PICK.has(event.code)) {
      if (!event.repeat) actions |= PICK.get(event.code);
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    keys.clear();
    mouse.down = false;
  });

  function track(event) {
    const point = toLogical(event.clientX, event.clientY);
    mouse.x = point.x;
    mouse.y = point.y;
  }
  canvas.addEventListener('pointermove', track);
  canvas.addEventListener('pointerdown', (event) => {
    gesture();
    track(event);
    mouse.down = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  function moveVector() {
    let x = 0;
    let y = 0;
    for (const code of keys) {
      if (LEFT.has(code)) x -= 1;
      else if (RIGHT.has(code)) x += 1;
      else if (UP.has(code)) y -= 1;
      else if (DOWN.has(code)) y += 1;
    }
    if (x !== 0 && y !== 0) {
      const length = Math.hypot(x, y);
      x /= length;
      y /= length;
    }
    return { x, y };
  }

  return {
    /** The steering state this frame, in the shape the simulation reads. */
    frame() {
      const move = moveVector();
      const dashHeld = [...keys].some((code) => DASH.has(code));
      return {
        mx: move.x,
        my: move.y,
        aimX: mouse.x,
        aimY: mouse.y,
        firing: mouse.down,
        dash: dashHeld,
      };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}

// Dash is a held key, read from the frame state (`dash`), not an edge action.

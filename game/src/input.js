// Keyboard and mouse input: WASD/arrows to move, Shift to sneak, Space/Enter
// to confirm, P to pause, M to mute. Clicking the floor sets a walk target the
// thief follows until a key is pressed.
import { FIELD } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let clickTarget = null;

  function isMoveKey(code) {
    return code === 'KeyW' || code === 'KeyA' || code === 'KeyS' || code === 'KeyD'
      || code === 'ArrowUp' || code === 'ArrowDown' || code === 'ArrowLeft' || code === 'ArrowRight';
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) {
      if (isMoveKey(event.code) || event.code === 'ShiftLeft' || event.code === 'ShiftRight') event.preventDefault();
      return;
    }
    if (event.code === 'Space' || event.code === 'Enter') {
      actions |= ACTION_CONFIRM;
      event.preventDefault();
    } else if (event.code === 'KeyP' || event.code === 'Escape') {
      actions |= ACTION_PAUSE;
    } else if (event.code === 'KeyM') {
      actions |= ACTION_MUTE;
    } else if (isMoveKey(event.code)) {
      keys.add(event.code);
      clickTarget = null;
      event.preventDefault();
    } else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      keys.add(event.code);
    }
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = FIELD.width / rect.width;
    const scaleY = FIELD.height / rect.height;
    clickTarget = {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
    actions |= ACTION_CONFIRM;
  });

  function takeActions() {
    const taken = actions;
    actions = 0;
    return taken;
  }

  /** Movement vector from keys, or toward the click target when set. */
  function direction(player) {
    let dx = 0;
    let dy = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) dy -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) dy += 1;
    if (dx !== 0 || dy !== 0) return { dx, dy, sneak: keys.has('ShiftLeft') || keys.has('ShiftRight') };
    if (clickTarget && player) {
      const ddx = clickTarget.x - player.x;
      const ddy = clickTarget.y - player.y;
      if (Math.hypot(ddx, ddy) < 8) clickTarget = null;
      else return { dx: ddx, dy: ddy, sneak: keys.has('ShiftLeft') || keys.has('ShiftRight') };
    }
    return { dx: 0, dy: 0, sneak: keys.has('ShiftLeft') || keys.has('ShiftRight') };
  }

  return { takeActions, direction };
}

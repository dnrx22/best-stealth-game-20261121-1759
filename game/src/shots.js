// The screenshot scenes behind ?shot=start|play|caught|win. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by
// a simple autopilot that follows the level's hand-checked waypoint path,
// sneaks near guards, waits out a sweeping vision cone, and backs away when
// seen — so the frame is what a short game really looks like and the same seed
// always gives the same frame.
import { GUARD, MAP_TOP, STEP, TILE } from './config.js';
import { LEVELS } from './levels.js';
import { EVENT_CAUGHT, EVENT_LEVEL, EVENT_WIN, GUARD_CHASE, GUARD_SUSPICIOUS, hasLineOfSight, tileCentre } from './world.js';
import { SCREEN_CAUGHT, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WON } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 22;
const STEP_SECONDS = STEP;

/** Seconds the win pilot may spend on one level before the attempt is abandoned. */
const WIN_LEVEL_LIMIT = 150;

function normalizeAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function visibleFrom(state, guard, x, y) {
  const player = state.player;
  const level = LEVELS[state.levelIndex];
  if (player.hidden && x === player.x && y === player.y) return false;
  const dx = x - guard.x;
  const dy = y - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist > GUARD.viewRange) return false;
  const angleTo = Math.atan2(dy, dx);
  if (Math.abs(normalizeAngle(angleTo - guard.angle)) > GUARD.viewHalfAngle) return false;
  return hasLineOfSight(level, guard.x, guard.y, x, y);
}

/**
 * Could this guard see point (x, y) — now, or a moment from now? A guard
 * paused at a waypoint scans back and forth, and one about to reach a
 * waypoint is about to turn, so either can sweep its cone over the point
 * without warning. Those are treated as if they could face any direction:
 * only range and a clear line of sight matter.
 */
function couldSeeSoon(state, guard, x, y) {
  if (visibleFrom(state, guard, x, y)) return true;
  const target = guard.waypoints[guard.waypointIndex];
  const nearTurn = Math.hypot(target.x - guard.x, target.y - guard.y) < 50;
  if (guard.pauseTimer > 0 || nearTurn) {
    const level = LEVELS[state.levelIndex];
    const dist = Math.hypot(x - guard.x, y - guard.y);
    // Only the close sweep is dangerous: at long range the meter rises
    // slowly and the thief crosses before it matters.
    if (dist > 170) return false;
    if (state.player.hidden && x === state.player.x && y === state.player.y) return false;
    return hasLineOfSight(level, guard.x, guard.y, x, y);
  }
  return false;
}

function nearestGuardDistance(state) {
  let best = Infinity;
  for (const guard of state.guards) {
    best = Math.min(best, Math.hypot(guard.x - state.player.x, guard.y - state.player.y));
  }
  return best;
}

function nearestGuard(state) {
  let best = null;
  let bestDist = Infinity;
  for (const guard of state.guards) {
    const dist = Math.hypot(guard.x - state.player.x, guard.y - state.player.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = guard;
    }
  }
  return best;
}

/** True when the tile (col, row) lies on a guard's patrol line. */
function onPatrolLine(state, col, row) {
  for (const guard of state.guards) {
    const [a, b] = [guard.waypoints[0], guard.waypoints[1]];
    const aCol = Math.floor(a.x / TILE);
    const aRow = Math.floor((a.y - MAP_TOP) / TILE);
    const bCol = Math.floor(b.x / TILE);
    const bRow = Math.floor((b.y - MAP_TOP) / TILE);
    if (aCol === bCol && col === aCol && row >= Math.min(aRow, bRow) && row <= Math.max(aRow, bRow)) return true;
    if (aRow === bRow && row === aRow && col >= Math.min(aCol, bCol) && col <= Math.max(aCol, bCol)) return true;
  }
  return false;
}

/**
 * Pixel centre of the nearest shrub tile to the player, or null. Shrubs on a
 * guard's patrol line are skipped: a guard walks straight through them, so
 * they are a trap, not cover.
 */
function nearestBush(state) {
  const level = LEVELS[state.levelIndex];
  let best = null;
  let bestDist = Infinity;
  for (let row = 0; row < 11; row += 1) {
    for (let col = 0; col < 20; col += 1) {
      if (level.map[row][col] !== 'B') continue;
      if (onPatrolLine(state, col, row)) continue;
      const pos = tileCentre(col, row);
      const dist = Math.hypot(pos.x - state.player.x, pos.y - state.player.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = pos;
      }
    }
  }
  return bestDist <= 320 ? best : null;
}

/** Pixel centre of the waypoint the pilot just came from (a safe tile it already stood on), or null. */
function retreatTarget(path) {
  if (path.index <= 0) return null;
  const [c, r] = path.list[path.index - 1];
  return tileCentre(c, r);
}

/** Where to run when seen: a shrub first, else back along the path the thief
 * already walked (known-safe tiles), else straight away from the nearest
 * guard. Backing away blindly can push the thief into a wall corner it cannot
 * leave; retreating along the path cannot. */
function fleeInput(state, path) {
  const bush = nearestBush(state);
  if (bush) return { dx: bush.x - state.player.x, dy: bush.y - state.player.y, sneak: false };
  const back = retreatTarget(path);
  // Only retreat along the path when the tile is actually safe: the waypoint
  // just left can have a guard standing on it.
  if (back && Math.hypot(back.x - state.player.x, back.y - state.player.y) > 20
    && !state.guards.some((guard) => Math.hypot(guard.x - back.x, guard.y - back.y) < 170)) {
    return { dx: back.x - state.player.x, dy: back.y - state.player.y, sneak: false };
  }
  const guard = nearestGuard(state);
  return { dx: state.player.x - guard.x, dy: state.player.y - guard.y, sneak: false };
}

/**
 * One autopilot decision. Follows the level's waypoint path, sneaks when a
 * guard is close, waits when the next step would walk into a lit cone, and
 * runs for the nearest shrub when already seen. `caution` 0..3 makes later attempts slower
 * and more patient.
 */
function pilotInput(state, path, caution) {
  const target = tileCentre(path.index < path.list.length ? path.list[path.index][0] : path.list[path.list.length - 1][0],
    path.index < path.list.length ? path.list[path.index][1] : path.list[path.list.length - 1][1]);
  const dx = target.x - state.player.x;
  const dy = target.y - state.player.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 18) {
    path.index += 1;
    path.stuck = 0;
    return { dx: 0, dy: 0, sneak: true };
  }
  // A guard is investigating or chasing nearby, or we are already half seen:
  // break contact first. In a shrub the thief cannot be seen at all, so run
  // for one and wait there until the alarm dies down.
  const threat = state.guards.find(
    (guard) => (guard.mode === GUARD_SUSPICIOUS || guard.mode === GUARD_CHASE)
      && Math.hypot(guard.x - state.player.x, guard.y - state.player.y) < 340,
  );
  if (threat || state.detection > 0.25) {
    if (state.player.hidden) {
      if (state.detection < 0.15 && !threat) {
        // Alarm over and nobody is hunting: carry on below.
      } else {
        return { dx: 0, dy: 0, sneak: true };
      }
    } else {
      return fleeInput(state, path);
    }
  }
  // Spotted and nearly caught: run for cover.
  if (state.detection >= 0.85) return fleeInput(state, path);
  // Already lit up and not hidden: run for cover.
  const seer = state.guards.find((guard) => visibleFrom(state, guard, state.player.x, state.player.y));
  if (seer && !state.player.hidden) return fleeInput(state, path);
  const sneak = caution >= 2 || nearestGuardDistance(state) < 280;
  const speed = sneak ? 1.75 : 3.4;
  const nx = dx / dist;
  const ny = dy / dist;
  // Look ahead along the leg, not just one step: a guard's cone can cover the
  // tile after next, and stepping into it at close range is already a catch.
  // Sample the next ~100px; if any of it is lit, wait for the patrol to pass.
  let wouldBeSeen = false;
  for (let s = 1; s <= 30; s += 1) {
    const px = state.player.x + nx * speed * s;
    const py = state.player.y + ny * speed * s;
    if (state.guards.some((guard) => couldSeeSoon(state, guard, px, py))) {
      wouldBeSeen = true;
      break;
    }
  }
  if (wouldBeSeen && state.detection < 0.85) {
    path.wait += 1;
    const limit = (3 + caution) * 60;
    if (path.wait > limit) {
      path.wait = 0;
      path.stuck += 1;
      // Sidestep around the cone instead of waiting forever.
      return { dx: -ny, dy: nx, sneak: true };
    }
    return { dx: 0, dy: 0, sneak: true };
  }
  path.wait = 0;
  path.stuck += 1;
  if (path.stuck > 60 * 30) {
    // A waypoint we cannot reach (should not happen on the checked paths):
    // skip it rather than stall the shot.
    path.index += 1;
    path.stuck = 0;
  }
  return { dx: nx, dy: ny, sneak };
}

export { pilotInput };
function runWinAttempt(world, caution) {
  world.reset();
  const path = { list: LEVELS[0].shotPath, index: 0, wait: 0, stuck: 0 };
  let levelIndex = 0;
  for (let step = 0; step < WIN_LEVEL_LIMIT * 3 * 60; step += 1) {
    if (world.state.levelIndex !== levelIndex) {
      levelIndex = world.state.levelIndex;
      path.list = LEVELS[levelIndex].shotPath;
      path.index = 0;
      path.wait = 0;
      path.stuck = 0;
    }
    const input = pilotInput(world.state, path, caution);
    const events = world.step(STEP_SECONDS, input, false);
    if (events & EVENT_CAUGHT) return 'caught';
    if (events & EVENT_WIN) return 'won';
    if (events & EVENT_LEVEL) continue;
    if (world.state.levelIndex === levelIndex && path.index >= path.list.length && world.state.exitOpen) {
      // Standing on the exit tile already handled by the step above; keep going.
    }
  }
  return 'timeout';
}

/**
 * Set `world` to the named scene (start, play, caught or win; any other name
 * is start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'play') {
    const path = { list: LEVELS[0].shotPath, index: 0, wait: 0, stuck: 0 };
    for (let index = 0; index < PLAY_SECONDS / STEP_SECONDS; index += 1) {
      const events = world.step(STEP_SECONDS, pilotInput(world.state, path, 1), false);
      if (events & (EVENT_CAUGHT | EVENT_LEVEL)) break;
    }
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'caught') {
    // A reckless pilot: walk onto the middle of guard A's patrol line in the
    // Gatehouse and stand there, in the open, until the guard walks into him.
    const path = { list: [[1, 1], [5, 1], [5, 3], [5, 5], [10, 5], [10, 3], [10, 2], [11, 2]], index: 0, wait: 0, stuck: 0 };
    for (let index = 0; index < 150 / STEP_SECONDS; index += 1) {
      const input = path.index >= path.list.length
        ? { dx: 0, dy: 0, sneak: false }
        : pilotInput(world.state, path, 0);
      const events = world.step(STEP_SECONDS, input, false);
      if (events & EVENT_CAUGHT) break;
    }
    return { screen: world.state.status === 'caught' ? SCREEN_CAUGHT : SCREEN_OVER, best: world.state.score };
  }
  if (name === 'win') {
    for (let caution = 0; caution <= 4; caution += 1) {
      const outcome = runWinAttempt(world, caution);
      if (outcome === 'won') return { screen: SCREEN_WON, best: world.state.score };
    }
    // No attempt finished all three halls: show the deepest attempt's play frame.
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  for (let index = 0; index < START_SECONDS / STEP_SECONDS; index += 1) {
    world.step(STEP_SECONDS, { dx: 0, dy: 0, sneak: false }, true);
  }
  return { screen: SCREEN_TITLE, best: 0 };
}

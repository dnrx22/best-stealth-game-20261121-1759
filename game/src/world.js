// The stealth simulation: a thief, patrolling guards with vision cones, loot
// embers and a locked exit. Everything advances in fixed steps, so the same
// seed and the same inputs always give the same game.
import { COLS, DETECTION, FIELD, GUARD, LIVES, MAP_TOP, PLAYER, ROWS, STEP, TILE, EMBER_POINTS, LEVEL_BONUS } from './config.js';
import { LEVELS, isHiding, isSolid, tileAt } from './levels.js';

export const EVENT_NONE = 0;
export const EVENT_EMBER = 1;
export const EVENT_SPOTTED = 2;
export const EVENT_CAUGHT = 4;
export const EVENT_LEVEL = 8;
export const EVENT_WIN = 16;
export const EVENT_GAMEOVER = 32;

export const GUARD_PATROL = 0;
export const GUARD_SUSPICIOUS = 1;
export const GUARD_CHASE = 2;

/** Pixel centre of tile (col, row). */
export function tileCentre(col, row) {
  return { x: col * TILE + TILE / 2, y: MAP_TOP + row * TILE + TILE / 2 };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function distance(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

function angleDifference(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** True when the straight segment (ax,ay)-(bx,by) crosses no solid tile. */
export function hasLineOfSight(level, ax, ay, bx, by) {
  const dist = distance(ax, ay, bx, by);
  const steps = Math.max(1, Math.ceil(dist / 6));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t;
    const col = Math.floor(x / TILE);
    const row = Math.floor((y - MAP_TOP) / TILE);
    if (isSolid(level, col, row)) return false;
  }
  return true;
}

/** True when a solid tile blocks a circle of `radius` centred at (x, y). */
function hitsSolid(level, x, y, radius) {
  const col0 = Math.floor((x - radius) / TILE);
  const col1 = Math.floor((x + radius) / TILE);
  const row0 = Math.floor((y - MAP_TOP - radius) / TILE);
  const row1 = Math.floor((y - MAP_TOP + radius) / TILE);
  for (let row = row0; row <= row1; row += 1) {
    for (let col = col0; col <= col1; col += 1) {
      if (!isSolid(level, col, row)) continue;
      const nearestX = clamp(x, col * TILE, col * TILE + TILE);
      const nearestY = clamp(y, MAP_TOP + row * TILE, MAP_TOP + row * TILE + TILE);
      if ((x - nearestX) ** 2 + (y - nearestY) ** 2 < radius * radius) return true;
    }
  }
  return false;
}

/** Move a circle with axis-separated collision so it slides along walls. Returns the distance actually moved. */
function moveCircle(level, body, dx, dy, radius) {
  const startX = body.x;
  const startY = body.y;
  const nx = body.x + dx;
  if (!hitsSolid(level, nx, body.y, radius)) body.x = nx;
  const ny = body.y + dy;
  if (!hitsSolid(level, body.x, ny, radius)) body.y = ny;
  body.x = clamp(body.x, radius, FIELD.width - radius);
  body.y = clamp(body.y, MAP_TOP + radius, MAP_TOP + ROWS * TILE - radius);
  return Math.hypot(body.x - startX, body.y - startY);
}

/**
 * Move a body toward `angle` at `speed`. A circle pushed straight into a wall
 * corner barely grazes the corner tile and stalls (the x step is refused, the
 * y step is near zero), so a body can wedge itself forever in an inside
 * corner. When a step makes almost no progress, slide along the wall instead:
 * probe both perpendicular directions and take the free one.
 */
function moveBody(level, body, angle, speed, dt, radius) {
  const expected = speed * dt;
  const moved = moveCircle(level, body, Math.cos(angle) * expected, Math.sin(angle) * expected, radius);
  if (moved >= expected * 0.4) return angle;
  const beforeX = body.x;
  const beforeY = body.y;
  const sides = [angle + Math.PI / 2, angle - Math.PI / 2, angle + Math.PI, angle + Math.PI / 4, angle - Math.PI / 4];
  for (const slide of sides) {
    const px = beforeX + Math.cos(slide) * expected;
    const py = beforeY + Math.sin(slide) * expected;
    if (hitsSolid(level, px, py, radius)) continue;
    moveCircle(level, body, Math.cos(slide) * expected, Math.sin(slide) * expected, radius);
    return slide;
  }
  return angle;
}

function findTiles(level, char) {
  const found = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      if (tileAt(level, col, row) === char) found.push({ col, row });
    }
  }
  return found;
}

export function createWorld(random) {
  const state = {
    levelIndex: 0,
    score: 0,
    lives: LIVES,
    time: 0,
    /** Highest detection among guards, 0..1. */
    detection: 0,
    embersLeft: 0,
    embersTotal: 0,
    exitOpen: false,
    status: 'playing',
    player: { x: 0, y: 0, facing: 0, sneak: false, hidden: false, moving: false },
    guards: [],
    embers: [],
    exit: { x: 0, y: 0 },
    levelTime: 0,
    caughtTimer: 0,
    message: '',
    messageTimer: 0,
  };

  function loadLevel(index) {
    const level = LEVELS[index];
    const start = findTiles(level, 'P')[0];
    const exitTile = findTiles(level, 'X')[0];
    const startPos = tileCentre(start.col, start.row);
    state.levelIndex = index;
    state.player.x = startPos.x;
    state.player.y = startPos.y;
    state.player.facing = 0;
    state.player.sneak = false;
    state.player.hidden = false;
    const exitPos = tileCentre(exitTile.col, exitTile.row);
    state.exit = { x: exitPos.x, y: exitPos.y };
    state.embers = findTiles(level, 'E').map((tile, i) => {
      const pos = tileCentre(tile.col, tile.row);
      return { x: pos.x, y: pos.y, taken: false, phase: random() * Math.PI * 2, id: i };
    });
    state.embersTotal = state.embers.length;
    state.embersLeft = state.embers.length;
    state.exitOpen = false;
    state.guards = level.guards.map((def) => {
      const first = tileCentre(def.waypoints[0][0], def.waypoints[0][1]);
      const second = tileCentre(def.waypoints[1][0], def.waypoints[1][1]);
      return {
        x: first.x,
        y: first.y,
        angle: Math.atan2(second.y - first.y, second.x - first.x),
        mode: GUARD_PATROL,
        waypointIndex: 1,
        pauseTimer: 0,
        lookTimer: 0,
        lastSeen: null,
        detection: 0,
        waypoints: def.waypoints.map(([c, r]) => tileCentre(c, r)),
        scanPhase: random() * Math.PI * 2,
      };
    });
    state.detection = 0;
    state.levelTime = 0;
    state.status = 'playing';
    state.message = '';
    state.messageTimer = 0;
  }

  function reset() {
    state.score = 0;
    state.lives = LIVES;
    state.time = 0;
    loadLevel(0);
  }

  function playerTile() {
    return {
      col: Math.floor(state.player.x / TILE),
      row: Math.floor((state.player.y - MAP_TOP) / TILE),
    };
  }

  /** Can this guard see the player right now? */
  function guardSees(guard) {
    const level = LEVELS[state.levelIndex];
    const player = state.player;
    if (player.hidden) return false;
    const dist = distance(guard.x, guard.y, player.x, player.y);
    if (dist > GUARD.viewRange) return false;
    const angleTo = Math.atan2(player.y - guard.y, player.x - guard.x);
    if (Math.abs(angleDifference(angleTo, guard.angle)) > GUARD.viewHalfAngle) return false;
    return hasLineOfSight(level, guard.x, guard.y, player.x, player.y);
  }

  function stepGuard(guard, dt, attract) {
    const level = LEVELS[state.levelIndex];
    const player = state.player;
    if (guard.mode === GUARD_CHASE) {
      const dist = distance(guard.x, guard.y, player.x, player.y);
      if (dist > 4) {
        const angle = Math.atan2(player.y - guard.y, player.x - guard.x);
        guard.angle = angle;
        guard.angle = moveBody(level, guard, angle, GUARD.chaseSpeed, dt, GUARD.radius);
      }
      if (!guardSees(guard) && guard.detection < DETECTION.chaseAt) guard.mode = GUARD_SUSPICIOUS;
      return;
    }
    if (guard.mode === GUARD_SUSPICIOUS) {
      if (guard.lastSeen) {
        const dist = distance(guard.x, guard.y, guard.lastSeen.x, guard.lastSeen.y);
        if (dist > 40) {
          const angle = Math.atan2(guard.lastSeen.y - guard.y, guard.lastSeen.x - guard.x);
          guard.angle = angle;
          guard.angle = moveBody(level, guard, angle, GUARD.investigateSpeed, dt, GUARD.radius);
          return;
        }
      }
      guard.lookTimer -= dt;
      guard.angle += Math.sin(state.time * 1.4 + guard.scanPhase) * 1.1 * dt;
      if (guard.lookTimer <= 0) {
        guard.mode = GUARD_PATROL;
        guard.lastSeen = null;
      }
      return;
    }
    // Patrol: walk to the current waypoint, pause, then take the next one.
    if (guard.pauseTimer > 0) {
      guard.pauseTimer -= dt;
      guard.angle += Math.sin(state.time * 0.9 + guard.scanPhase) * 0.9 * dt;
      return;
    }
    const target = guard.waypoints[guard.waypointIndex];
    const dist = distance(guard.x, guard.y, target.x, target.y);
    if (dist < 6) {
      guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
      guard.pauseTimer = GUARD.waypointPause;
      return;
    }
    const angle = Math.atan2(target.y - guard.y, target.x - guard.x);
    guard.angle = angle;
    guard.angle = moveBody(level, guard, angle, GUARD.patrolSpeed, dt, GUARD.radius);
  }

  /**
   * Advance the world one fixed step. `input` is { dx, dy, sneak } in [-1, 1].
   * In attract mode the guards patrol but the player never moves and cannot be caught.
   * Returns an event bitmask.
   */
  function step(dt, input, attract) {
    if (state.status === 'caught') {
      state.caughtTimer -= dt;
      if (state.caughtTimer <= 0) {
        if (state.lives <= 0) {
          state.status = 'gameover';
          return EVENT_GAMEOVER;
        }
        loadLevel(state.levelIndex);
      }
      return EVENT_NONE;
    }
    if (state.status !== 'playing') return EVENT_NONE;
    state.time += dt;
    state.levelTime += dt;
    if (state.messageTimer > 0) state.messageTimer -= dt;

    const level = LEVELS[state.levelIndex];
    const player = state.player;
    let events = EVENT_NONE;

    if (!attract) {
      const speed = input.sneak ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
      const len = Math.hypot(input.dx, input.dy);
      player.moving = len > 0.05;
      if (player.moving) {
        const nx = input.dx / Math.max(1, len);
        const ny = input.dy / Math.max(1, len);
        player.facing = Math.atan2(ny, nx);
        moveBody(level, player, player.facing, speed, dt, PLAYER.radius);
      }
      player.sneak = input.sneak;
      const tile = playerTile();
      player.hidden = isHiding(level, tile.col, tile.row);
    } else {
      player.moving = false;
    }

    // Guards: patrol, see, suspect, chase.
    let maxDetection = 0;
    for (const guard of state.guards) {
      const wasSuspicious = guard.detection >= DETECTION.suspiciousAt;
      const sees = !attract && guardSees(guard);
      if (sees) {
        const dist = distance(guard.x, guard.y, player.x, player.y);
        const closeness = 1 - dist / GUARD.viewRange;
        let rate = DETECTION.minRate + (DETECTION.maxRate - DETECTION.minRate) * closeness;
        if (player.sneak) rate *= PLAYER.sneakFactor;
        if (!player.moving) rate *= 0.7;
        guard.detection = Math.min(1, guard.detection + rate * dt);
        guard.lastSeen = { x: player.x, y: player.y };
        if (guard.mode === GUARD_PATROL && guard.detection >= DETECTION.suspiciousAt) {
          guard.mode = GUARD_SUSPICIOUS;
          guard.lookTimer = GUARD.lookAroundSeconds;
        }
        if (guard.detection >= DETECTION.chaseAt && guard.mode !== GUARD_CHASE) {
          guard.mode = GUARD_CHASE;
          if (!wasSuspicious) events |= EVENT_SPOTTED;
        }
      } else {
        guard.detection = Math.max(0, guard.detection - DETECTION.decay * dt);
        if (guard.mode === GUARD_CHASE && guard.detection < DETECTION.chaseAt) {
          guard.mode = GUARD_SUSPICIOUS;
          guard.lookTimer = GUARD.lookAroundSeconds;
        }
      }
      maxDetection = Math.max(maxDetection, guard.detection);
      stepGuard(guard, dt, attract);
    }
    state.detection = maxDetection;

    // Bumping into a guard: bodies cannot overlap. In the open a shoulder-check
    // is instantly alarming; a thief hidden in a shrub is not felt at all, so
    // the guard steps around the shrub instead.
    if (!attract) {
      for (const guard of state.guards) {
        const dx = player.x - guard.x;
        const dy = player.y - guard.y;
        const dist = Math.hypot(dx, dy);
        const minDist = PLAYER.radius + GUARD.radius + 2;
        if (dist < minDist && dist > 0.01) {
          if (player.hidden) {
            guard.x -= (dx / dist) * (minDist - dist);
            guard.y -= (dy / dist) * (minDist - dist);
          } else {
            player.x = guard.x + (dx / dist) * minDist;
            player.y = guard.y + (dy / dist) * minDist;
            guard.detection = Math.min(1, guard.detection + 0.3);
            guard.lastSeen = { x: player.x, y: player.y };
            if (guard.mode === GUARD_PATROL) {
              guard.mode = GUARD_SUSPICIOUS;
              guard.lookTimer = GUARD.lookAroundSeconds;
            }
            state.detection = Math.max(state.detection, guard.detection);
          }
        }
      }
    }

    if (!attract && state.detection >= 1) {
      state.lives -= 1;
      state.status = 'caught';
      state.caughtTimer = 1.6;
      state.message = state.lives > 0 ? 'Caught! The lanterns turn...' : 'Caught! No lanterns left.';
      state.messageTimer = 1.6;
      return EVENT_CAUGHT;
    }

    if (!attract) {
      // Embers.
      for (const ember of state.embers) {
        if (!ember.taken && distance(player.x, player.y, ember.x, ember.y) < PLAYER.radius + 16) {
          ember.taken = true;
          state.embersLeft -= 1;
          state.score += EMBER_POINTS;
          events |= EVENT_EMBER;
          if (state.embersLeft === 0) {
            state.exitOpen = true;
            state.message = 'The vault door is open — reach the exit!';
            state.messageTimer = 3;
          }
        }
      }
      // Exit.
      if (state.exitOpen && distance(player.x, player.y, state.exit.x, state.exit.y) < PLAYER.radius + 18) {
        state.score += LEVEL_BONUS + Math.max(0, Math.round(120 - state.levelTime));
        if (state.levelIndex + 1 >= LEVELS.length) {
          state.status = 'won';
          return events | EVENT_WIN;
        }
        loadLevel(state.levelIndex + 1);
        state.message = `${LEVELS[state.levelIndex].name} — stay out of the light.`;
        state.messageTimer = 3;
        return events | EVENT_LEVEL;
      }
    }
    return events;
  }

  loadLevel(0);
  return { state, step, reset, loadLevel, tileCentre };
}

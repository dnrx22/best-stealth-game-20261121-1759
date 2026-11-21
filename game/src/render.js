// Everything on the canvas: the vault floor, walls and cover, the guards' light
// cones (raycast so walls really cut them off), the thief, the embers, the exit
// and the HUD, plus the title, caught, game-over and win screens.
import { FIELD, GUARD, MAP_TOP, PALETTE, PLAYER, ROWS, COLS, TILE, FONT } from './config.js';
import { LEVELS, isSolid, tileAt } from './levels.js';
import { GUARD_CHASE } from './world.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_CAUGHT = 3;
export const SCREEN_OVER = 4;
export const SCREEN_WON = 5;

const CONE_RAYS = 26;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  function resize() {
    const width = canvas.clientWidth || FIELD.width;
    const height = canvas.clientHeight || FIELD.height;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    offsetX = (canvas.width - FIELD.width * scale) / 2;
    offsetY = (canvas.height - FIELD.height * scale) / 2;
  }

  function conePoints(guard) {
    const level = LEVELS[currentLevel];
    const points = [];
    for (let i = 0; i <= CONE_RAYS; i += 1) {
      const angle = guard.angle - GUARD.viewHalfAngle + (2 * GUARD.viewHalfAngle * i) / CONE_RAYS;
      let dist = GUARD.viewRange;
      for (let d = 8; d <= GUARD.viewRange; d += 8) {
        const x = guard.x + Math.cos(angle) * d;
        const y = guard.y + Math.sin(angle) * d;
        const col = Math.floor(x / TILE);
        const row = Math.floor((y - MAP_TOP) / TILE);
        if (isSolid(level, col, row)) { dist = d; break; }
      }
      points.push({ x: guard.x + Math.cos(angle) * dist, y: guard.y + Math.sin(angle) * dist });
    }
    return points;
  }

  let currentLevel = 0;

  function drawFloor(state) {
    const level = LEVELS[state.levelIndex];
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const x = col * TILE;
        const y = MAP_TOP + row * TILE;
        ctx.fillStyle = (col + row) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.strokeStyle = PALETTE.floorEdge;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
      }
    }
    // A faint rug runner down the middle hall, for depth.
    ctx.fillStyle = 'rgba(120, 40, 60, 0.18)';
    ctx.fillRect(0, MAP_TOP + 5 * TILE, FIELD.width, TILE);
  }

  function drawExit(state) {
    const exit = state.exit;
    const open = state.exitOpen;
    ctx.save();
    ctx.translate(exit.x, exit.y);
    ctx.fillStyle = open ? PALETTE.exitOpen : PALETTE.exitLocked;
    roundRect(ctx, -26, -26, 52, 52, 8);
    ctx.fill();
    ctx.strokeStyle = open ? '#b8f5d2' : '#d98a8a';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#0b0e14';
    ctx.font = 'bold 26px ' + FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(open ? '➜' : '✕', 0, 1);
    if (open) {
      ctx.fillStyle = PALETTE.exitOpen;
      ctx.font = 'bold 13px ' + FONT;
      ctx.fillText('EXIT', 0, -38);
    } else {
      ctx.fillStyle = '#d98a8a';
      ctx.font = 'bold 11px ' + FONT;
      ctx.fillText('LOCKED', 0, -38);
    }
    ctx.restore();
  }

  function drawEmbers(state) {
    for (const ember of state.embers) {
      if (ember.taken) continue;
      const flicker = 0.75 + 0.25 * Math.sin(state.time * 3 + ember.phase);
      const glow = ctx.createRadialGradient(ember.x, ember.y, 2, ember.x, ember.y, 30);
      glow.addColorStop(0, 'rgba(255, 176, 46, 0.55)');
      glow.addColorStop(1, 'rgba(255, 122, 26, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(ember.x, ember.y, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.ember;
      ctx.beginPath();
      ctx.arc(ember.x, ember.y, 9 * flicker + 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff3d6';
      ctx.beginPath();
      ctx.arc(ember.x - 2, ember.y - 2, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBush(state) {
    const level = LEVELS[state.levelIndex];
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        if (tileAt(level, col, row) !== 'B') continue;
        const x = col * TILE;
        const y = MAP_TOP + row * TILE;
        ctx.fillStyle = PALETTE.bush;
        roundRect(ctx, x + 4, y + 4, TILE - 8, TILE - 8, 12);
        ctx.fill();
        ctx.fillStyle = PALETTE.bushLeaf;
        for (let i = 0; i < 5; i += 1) {
          const lx = x + 14 + ((i * 37) % 36);
          const ly = y + 14 + ((i * 23) % 36);
          ctx.beginPath();
          ctx.arc(lx, ly, 10, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  function drawWallsAndCrates(state) {
    const level = LEVELS[state.levelIndex];
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const tile = tileAt(level, col, row);
        if (tile !== '#' && tile !== 'C') continue;
        const x = col * TILE;
        const y = MAP_TOP + row * TILE;
        if (tile === '#') {
          ctx.fillStyle = PALETTE.wall;
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = PALETTE.wallTop;
          ctx.fillRect(x, y, TILE, 8);
          ctx.strokeStyle = '#232a3a';
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
        } else {
          ctx.fillStyle = PALETTE.crate;
          roundRect(ctx, x + 5, y + 5, TILE - 10, TILE - 10, 6);
          ctx.fill();
          ctx.strokeStyle = PALETTE.crateEdge;
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x + 5, y + 5);
          ctx.lineTo(x + TILE - 5, y + TILE - 5);
          ctx.moveTo(x + TILE - 5, y + 5);
          ctx.lineTo(x + 5, y + TILE - 5);
          ctx.stroke();
        }
      }
    }
  }

  function drawCones(state) {
    for (const guard of state.guards) {
      const points = conePoints(guard);
      const fill = guard.mode === GUARD_CHASE
        ? PALETTE.coneAlert
        : guard.detection >= 0.5 ? PALETTE.coneSuspicious : PALETTE.coneCalm;
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(guard.x, guard.y);
      for (const p of points) ctx.lineTo(p.x, p.y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 214, 90, 0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function drawGuard(guard) {
    ctx.save();
    ctx.translate(guard.x, guard.y);
    // Body: a watchman in a red tabard, facing his patrol direction.
    ctx.fillStyle = PALETTE.guardDark;
    ctx.beginPath();
    ctx.arc(0, 0, GUARD.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.guard;
    ctx.beginPath();
    ctx.arc(0, 0, GUARD.radius - 4, 0, Math.PI * 2);
    ctx.fill();
    // Lantern dot showing where he looks.
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.arc(Math.cos(guard.angle) * (GUARD.radius + 5), Math.sin(guard.angle) * (GUARD.radius + 5), 4, 0, Math.PI * 2);
    ctx.fill();
    // Helmet brim.
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, GUARD.radius - 8, guard.angle - 1.1, guard.angle + 1.1);
    ctx.stroke();
    ctx.restore();
    // Suspicion / alarm mark above his head.
    if (guard.detection >= 0.5) {
      ctx.fillStyle = guard.detection >= 0.78 ? '#ff5a4e' : '#ffb02e';
      ctx.font = 'bold 22px ' + FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(guard.detection >= 0.78 ? '!' : '?', guard.x, guard.y - GUARD.radius - 14);
    }
  }

  function drawPlayer(state) {
    const player = state.player;
    ctx.save();
    ctx.translate(player.x, player.y);
    // Lantern glow.
    const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 54);
    glow.addColorStop(0, 'rgba(255, 209, 102, 0.30)');
    glow.addColorStop(1, 'rgba(255, 209, 102, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 54, 0, Math.PI * 2);
    ctx.fill();
    // Cloak.
    ctx.fillStyle = PALETTE.playerCloak;
    ctx.beginPath();
    ctx.arc(0, 0, PLAYER.radius + 2, 0, Math.PI * 2);
    ctx.fill();
    // Hood, turned toward the facing direction.
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(Math.cos(player.facing) * 4, Math.sin(player.facing) * 4, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0b0e14';
    ctx.beginPath();
    ctx.arc(Math.cos(player.facing) * 7, Math.sin(player.facing) * 7, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Hiding in a shrub: leafy cover drawn over the thief.
    if (player.hidden) {
      ctx.fillStyle = 'rgba(46, 107, 63, 0.85)';
      for (let i = 0; i < 4; i += 1) {
        ctx.beginPath();
        ctx.arc(player.x - 8 + i * 6, player.y - 6 + (i % 2) * 10, 8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#cfe8c9';
      ctx.font = 'bold 11px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('HIDDEN', player.x, player.y - 26);
    }
  }

  function drawHud(state, best) {
    const level = LEVELS[state.levelIndex];
    ctx.font = 'bold 15px ' + FONT;
    ctx.textBaseline = 'middle';
    // Top-left chip: level + embers.
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, 12, 12, 300, 34, 8);
    ctx.fill();
    ctx.fillStyle = PALETTE.text;
    ctx.textAlign = 'left';
    ctx.fillText(`${level.name}  •  ◆ ${state.embersTotal - state.embersLeft}/${state.embersTotal}`, 24, 30);
    // Top-right chip: score + lives.
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, FIELD.width - 312, 12, 300, 34, 8);
    ctx.fill();
    ctx.fillStyle = PALETTE.text;
    ctx.textAlign = 'right';
    const hearts = '♥'.repeat(Math.max(0, state.lives)) + '♡'.repeat(Math.max(0, 3 - state.lives));
    ctx.fillText(`Score ${state.score}   ${hearts}`, FIELD.width - 24, 30);
    // Detection meter, centre-top, only while someone is suspicious.
    if (state.detection > 0.02) {
      const w = 260;
      const x = (FIELD.width - w) / 2;
      const y = 58;
      ctx.fillStyle = PALETTE.panel;
      roundRect(ctx, x - 8, y - 6, w + 16, 26, 8);
      ctx.fill();
      ctx.fillStyle = '#2a3040';
      roundRect(ctx, x, y, w, 14, 7);
      ctx.fill();
      ctx.fillStyle = state.detection >= 0.78 ? '#ff5a4e' : state.detection >= 0.5 ? '#ffb02e' : '#ffd166';
      roundRect(ctx, x, y, Math.max(14, w * state.detection), 14, 7);
      ctx.fill();
      ctx.fillStyle = PALETTE.text;
      ctx.font = 'bold 11px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText(state.detection >= 0.78 ? 'SPOTTED — RUN!' : state.detection >= 0.5 ? 'SUSPICIOUS' : 'SEEN', FIELD.width / 2, y + 7);
    }
    // Transient message, lower centre.
    if (state.messageTimer > 0 && state.message) {
      ctx.fillStyle = PALETTE.panel;
      const tw = ctx.measureText(state.message).width + 32;
      roundRect(ctx, (FIELD.width - tw) / 2, FIELD.height - 58, tw, 30, 8);
      ctx.fill();
      ctx.fillStyle = PALETTE.text;
      ctx.font = 'bold 14px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText(state.message, FIELD.width / 2, FIELD.height - 43);
    }
    // Best score, bottom-left, small.
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '12px ' + FONT;
    ctx.textAlign = 'left';
    ctx.fillText(`Best ${best}`, 16, FIELD.height - 16);
  }

  function overlay(title, lines, accent) {
    ctx.fillStyle = 'rgba(8, 10, 16, 0.72)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = accent;
    ctx.font = 'bold 54px ' + FONT;
    ctx.fillText(title, FIELD.width / 2, 250);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '20px ' + FONT;
    let y = 310;
    for (const line of lines) {
      ctx.fillText(line, FIELD.width / 2, y);
      y += 34;
    }
  }

  function drawTitle(state, best) {
    overlay('EMBERHEIST', [
      'A thief, a vault, and three halls full of lanterns.',
      'Slip past the guards, steal every ember, reach the green exit unseen.',
      '',
      'Move: WASD / arrows — or click where to go.  Sneak: hold Shift.',
      'Hide in the shrubs.  Crates block a guard’s sight.  Pause: P.  Mute: M.',
      '',
      'Press Space or click to begin',
      best > 0 ? `Best score: ${best}` : 'First heist: The Gatehouse',
    ], PALETTE.ember);
  }

  function draw(state, screen, best) {
    currentLevel = state.levelIndex;
    resize();
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(-offsetX / scale, -offsetY / scale, FIELD.width + (offsetX * 2) / scale, FIELD.height + (offsetY * 2) / scale);
    drawFloor(state);
    drawExit(state);
    drawEmbers(state);
    drawBush(state);
    drawCones(state);
    drawWallsAndCrates(state);
    for (const guard of state.guards) drawGuard(guard);
    drawPlayer(state);
    drawHud(state, best);
    if (screen === SCREEN_TITLE) drawTitle(state, best);
    else if (screen === SCREEN_PAUSED) overlay('PAUSED', ['Press P or Space to keep sneaking.'], PALETTE.text);
    else if (screen === SCREEN_CAUGHT) overlay('CAUGHT!', [state.message, 'Press Space to try the hall again.'], '#ff5a4e');
    else if (screen === SCREEN_OVER) overlay('THE VAULT KEEPS ITS SECRETS', [`Score ${state.score}   •   Best ${best}`, 'Press Space to steal again.'], '#ff5a4e');
    else if (screen === SCREEN_WON) overlay('THE VAULT IS YOURS', [`All three halls emptied. Score ${state.score}   •   Best ${best}`, 'Press Space to run it again, cleaner.'], PALETTE.exitOpen);
  }

  return { draw, resize };
}

// Every tuning number and colour for Emberheist, in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to
// the window, so no rule below depends on the screen size.
export const FIELD = { width: 1280, height: 720 };
export const TILE = 64;
export const COLS = 20;
export const ROWS = 11;
export const MAP_TOP = 16; // the tile map is 704px tall, centred vertically

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 15,
  walkSpeed: 205,
  sneakSpeed: 105,
  /** Detection rises this much slower while sneaking. */
  sneakFactor: 0.45,
};

export const GUARD = {
  radius: 16,
  patrolSpeed: 78,
  investigateSpeed: 118,
  chaseSpeed: 165,
  /** How far a guard can see, in pixels. */
  viewRange: 250,
  /** Half-angle of the vision cone, in radians. */
  viewHalfAngle: 0.62,
  /** Seconds a guard stares at a spot after investigating it. */
  lookAroundSeconds: 2.2,
  /** Seconds a guard waits at each patrol waypoint. */
  waypointPause: 1.1,
};

export const DETECTION = {
  /** Detection per second when the player is right in front of a guard. */
  maxRate: 1.7,
  /** Detection per second when the player is at the far edge of a cone. */
  minRate: 0.45,
  /** Detection decay per second while unseen. */
  decay: 0.55,
  /** Above this the guard turns suspicious and investigates. */
  suspiciousAt: 0.5,
  /** Above this the guard gives chase. */
  chaseAt: 0.78,
};

export const LIVES = 3;
export const EMBER_POINTS = 100;
export const LEVEL_BONUS = 250;

export const PALETTE = {
  backdrop: '#0b0e14',
  floorA: '#1d2330',
  floorB: '#181d29',
  floorEdge: '#232a3a',
  wall: '#3a4358',
  wallTop: '#4b5872',
  crate: '#6b5433',
  crateEdge: '#8a6f45',
  bush: '#1f4d2e',
  bushLeaf: '#2e6b3f',
  ember: '#ffb02e',
  emberGlow: '#ff7a1a',
  player: '#ffd166',
  playerCloak: '#2f6f5e',
  guard: '#e5534b',
  guardDark: '#8f2f2a',
  coneCalm: 'rgba(255, 214, 90, 0.16)',
  coneSuspicious: 'rgba(255, 150, 40, 0.28)',
  coneAlert: 'rgba(229, 83, 75, 0.34)',
  exitLocked: '#7a2e2e',
  exitOpen: '#2fae6e',
  text: '#eef1f5',
  muted: '#9aa3b5',
  panel: 'rgba(10, 13, 20, 0.78)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'emberheist.best';

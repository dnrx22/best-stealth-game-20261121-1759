// The three heists of Emberheist. Each map is 20 columns by 11 rows.
//   # wall (blocks movement and sight)   C crate (cover: blocks movement and sight)
//   B shrub (walkable; a thief standing in one cannot be seen)
//   . floor   E ember (loot)   P player start   X exit (locked until every ember is taken)
// Guard patrols and screenshot autopilot paths are tile coordinates [col, row].
// Every waypoint segment runs through open tiles (verified by BFS in /tmp/plan-stealth.mjs).
export const LEVELS = [
  {
    name: 'The Gatehouse',
    map: [
      '####################',
      '#P....#....B.....E.#',
      '#.....#........#...#',
      '#.C...#........#...#',
      '#.....####..C..#...#',
      '#..B.......#....B..#',
      '###....C...#......##',
      '#....E.....#....E..#',
      '#.C....#...#....X..#',
      '#..B...#.......#...#',
      '####################',
    ],
    guards: [
      { waypoints: [[8, 2], [14, 2]] },
      { waypoints: [[17, 4], [17, 9]] },
    ],
    shotPath: [
      [1, 1], [5, 1], [5, 7], [10, 7], [10, 9], [14, 9], [14, 8], [16, 8],
      [16, 7], [16, 1], [17, 1], [16, 1], [16, 8],
    ],
  },
  {
    name: 'The Ember Gallery',
    map: [
      '####################',
      '#P..B....#....E....#',
      '#......C.#....#..B.#',
      '#..###...#....#..E.#',
      '#..#......C...#.E..#',
      '#..#..B...#...#....#',
      '#..####...#...##.#.#',
      '#....E....#....#...#',
      '#.C....#.....B#..X.#',
      '#..B...#..C...#....#',
      '####################',
    ],
    guards: [
      { waypoints: [[5, 5], [9, 5]] },
      { waypoints: [[11, 3], [13, 3]] },
      { waypoints: [[18, 2], [18, 8]] },
    ],
    shotPath: [
      [1, 1], [2, 1], [2, 7], [9, 7], [9, 8], [13, 8], [13, 1], [17, 1],
      [17, 3], [16, 3], [16, 7], [17, 7], [17, 8],
    ],
  },
  {
    name: 'The Vault of Nine Lamps',
    map: [
      '####################',
      '#P....B.....#..E...#',
      '#..C....#...#....E.#',
      '###..C..#...#.##...#',
      '#......B#...#..#..E#',
      '#.####..#...#..#...#',
      '#.#.....#..C....B..#',
      '#.#..E..#..#..###..#',
      '#...C...#..#....#..#',
      '#..B....#..E..#..X.#',
      '####################',
    ],
    guards: [
      { waypoints: [[10, 2], [10, 7]] },
      { waypoints: [[13, 1], [13, 6]] },
      { waypoints: [[13, 6], [15, 6]] },
      { waypoints: [[5, 9], [7, 9]] },
    ],
    shotPath: [
      [1, 1], [6, 1], [6, 6], [5, 6], [5, 7], [7, 7], [7, 1], [10, 1],
      [10, 9], [13, 9], [13, 2], [15, 2], [15, 1], [17, 1], [17, 2],
      [18, 2], [18, 4], [17, 4], [17, 9],
    ],
  },
];

/** Tile character at (col, row) of a level map, or '#' outside the map. */
export function tileAt(level, col, row) {
  if (col < 0 || row < 0 || col >= 20 || row >= 11) return '#';
  return level.map[row][col];
}

/** True when the tile blocks movement and sight (wall or crate). */
export function isSolid(level, col, row) {
  const tile = tileAt(level, col, row);
  return tile === '#' || tile === 'C';
}

/** True when the tile hides a thief standing in it. */
export function isHiding(level, col, row) {
  return tileAt(level, col, row) === 'B';
}

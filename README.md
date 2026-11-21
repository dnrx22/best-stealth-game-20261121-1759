# Emberheist

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/dnrx22/best-stealth-game-20261121-1759/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/dnrx22/best-stealth-game-20261121-1759/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

**Emberheist** is a complete, original top-down stealth game that runs in a desktop browser from static files — no network requests, no libraries, no build step.

You are a thief with a lantern, loose in a vault of three halls. Each hall is patrolled by guards whose vision cones are real: walls and crates cut the light off, and a guard only sees you when you stand inside his cone with a clear line of sight. Steal every glowing ember, wait out the patrols, hide in the shrubs, and slip through the exit door — which only opens once the hall is empty of embers. Get fully spotted and the lanterns turn: you lose a lantern and the hall resets. Three halls, three lanterns, one clean getaway.

What is in the game:

- **Three hand-built halls** — The Gatehouse, The Ember Gallery, and The Vault of Nine Lamps — with walls, crates for cover, shrubs to hide in, and a locked exit per hall.
- **Guards with raycast vision cones** — patrol routes, pauses to scan, suspicion ("?") when they glimpse you, and a chase ("!") when they are sure. Cones are clipped by walls, so cover genuinely works.
- **A detection meter** — being seen fills it; sneaking (Shift) fills it far slower; breaking line of sight lets it drain.
- **Keyboard and mouse** — move with WASD or the arrow keys, hold Shift to sneak, or click anywhere on the floor and the thief walks there. Space starts and restarts, P pauses, M mutes.
- **Synthesized sound** — pickup chimes, a spotted sting, a caught buzz, and a win arpeggio, all made with the Web Audio oscillator. No audio files.
- **Score, lives, and a best score** kept in the browser, plus title, paused, caught, game-over, and win screens.
- **Deterministic runs** — `?seed=N` fixes the guard scan phases and ember flicker, and `?shot=start|play|caught|win` stages a screenshot scene from the real simulation.

## Run it

```sh
node serve.ts
```

Then open <http://localhost:8080> in a desktop browser. Or open `game/index.html` directly — everything the game loads lives under `game/`.

`main.ts` (Node 22, standard library only) is the entry program: it copies `game/` and `screenshots/` to the output directory and writes `dossier.json` for the judge.

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Screenshots in `screenshots/` are genuine renders of the game's own code, taken in headless Chromium from the `?shot=` scenes.

## Files

- `main.ts` — the entry program (copies the game, writes `dossier.json`).
- `serve.ts` — a tiny static server for local play.
- `game/index.html` — the game shell.
- `game/src/` — the game itself: `config.js` (tuning), `levels.js` (the three halls), `world.js` (simulation: movement, vision, guards, detection), `render.js` (canvas drawing), `input.js` (keyboard + mouse), `audio.js` (synthesized sound), `shots.js` (screenshot autopilot), `main.js` (boot and game loop).
- `screenshots/` — 1-start, 2-play, 3-caught.
- `vendor/makefun-game.ts` — the vendored make.fun library, unchanged.

## License

MIT — see [LICENSE](LICENSE).

<sub>Entered on [make.fun](https://make.fun/?ref=xanns8j9&utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759) · AI agents build software for cash rewards</sub>

// Screenshot + play-test driver for Emberheist (dev tool, not shipped).
// Serves game/ on :8934, screenshots ?shot=start|play|caught into
// screenshots/, then play-tests the live game with real keyboard input and
// mouse clicks: checks the title screen, starting, moving, sneaking,
// pausing, console errors and non-local requests.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';

const require = createRequire('/home/hatch/workspace/makefun/best-spot-the-difference-game-20261121-0451/package.json');
const { chromium } = require('playwright');

const ROOT = resolve('game');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const server = createServer((req, res) => {
  let p = '/index.html';
  try { p = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname); } catch { res.writeHead(400).end(); return; }
  if (p.endsWith('/')) p += 'index.html';
  const file = resolve(join(ROOT, normalize(p)));
  if (file !== ROOT && !file.startsWith(ROOT + sep)) { res.writeHead(403).end(); return; }
  try {
    const st = statSync(file);
    if (!st.isFile()) throw new Error('x');
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream', 'content-length': st.size });
    createReadStream(file).pipe(res);
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(8934, '127.0.0.1', r));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
const requests = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
page.on('request', (req) => requests.push(req.url()));

// --- screenshots (deterministic shot states) ---
for (const [name, query] of [
  ['1-start.jpg', '?shot=start&seed=1'],
  ['2-play.jpg', '?shot=play&seed=1'],
  ['3-caught.jpg', '?shot=caught&seed=1'],
]) {
  await page.goto(`http://127.0.0.1:8934/${query}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 120000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `screenshots/${name}`, type: 'jpeg', quality: 80 });
  console.log('shot', name, 'done');
}

// --- live play-test: real keyboard + mouse ---
await page.goto('http://127.0.0.1:8934/', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);

const state = () => page.evaluate(() => {
  const w = window.__emberheist;
  return w ? w() : null;
});
console.log('title state:', JSON.stringify(await state()));

// Start with Space.
await page.keyboard.press('Space');
await page.waitForTimeout(300);
console.log('after Space:', JSON.stringify(await state()));

// Walk right with D held, then down with S.
await page.keyboard.down('KeyD');
await page.waitForTimeout(900);
await page.keyboard.up('KeyD');
await page.keyboard.down('KeyS');
await page.waitForTimeout(700);
await page.keyboard.up('KeyS');
console.log('after walking:', JSON.stringify(await state()));

// Sneak: hold Shift + A.
await page.keyboard.down('ShiftLeft');
await page.keyboard.down('KeyA');
await page.waitForTimeout(600);
await page.keyboard.up('KeyA');
await page.keyboard.up('ShiftLeft');
console.log('after sneaking:', JSON.stringify(await state()));

// Click-to-move: click the floor to the right of the player.
const box = await page.evaluate(() => {
  const r = document.getElementById('game').getBoundingClientRect();
  return { left: r.left, top: r.top, w: r.width, h: r.height };
});
await page.mouse.click(box.left + (700 / 1280) * box.w, box.top + (300 / 720) * box.h);
await page.waitForTimeout(1200);
console.log('after click-to-move:', JSON.stringify(await state()));

// Pause and resume.
await page.keyboard.press('KeyP');
await page.waitForTimeout(200);
console.log('after P:', JSON.stringify(await state()));
await page.keyboard.press('KeyP');
await page.waitForTimeout(200);
console.log('after resume:', JSON.stringify(await state()));

console.log('console errors:', JSON.stringify(errors));
console.log('non-local requests:', JSON.stringify(requests.filter((u) => !u.startsWith('http://127.0.0.1'))));
await browser.close();
server.close();
console.log('DONE');

// Beacon Line — best-game-01 entry program (Node 22+, standard library only).
//
// What it does: takes the playable game in this repository's game/ folder
// (plain static files — game/index.html plus its scripts and assets, no build
// step, no network request) and the 3 or 4 screenshots in screenshots/, and
// hands them in as one output directory: game/ and screenshots/ copied over,
// plus dossier.json, the summary the judge reads, built with the vendored
// make.fun library (vendor/makefun-game.ts, the kit's copy, unchanged).
//
// Run it from this directory:
//
//   MAKEFUN_OUTPUT_DIR=out node main.ts
//
// With MAKEFUN_OUTPUT_DIR unset it writes to /output, the grader's location.
// The output directory is rebuilt from scratch on every run: any previous
// game/ or screenshots/ inside it is removed first, so a stale file from an
// earlier run can never ride along.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The scorer's own caps: only text_max_bytes shapes the dossier's bytes; the
// rest make this program refuse exactly where the scorer would refuse — more
// than 4 screenshots or one over 256 KiB; more than 993 entries in game/ or
// 48 MiB of game files in all; a path under game/ over 1000 bytes.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

const repoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)));
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

function countEntries(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    total += 1;
    if (entry.isDirectory()) total += countEntries(join(dir, entry.name));
  }
  return total;
}

function replaceTree(source, target, label) {
  if (!existsSync(source)) throw new Error(`missing ${label}: expected ${source} beside main.ts`);
  rmSync(target, { recursive: true, force: true });
  cpSync(source, target, { recursive: true });
}

const gameDir = join(repoRoot, 'game');
if (!existsSync(join(gameDir, 'index.html')) || !statSync(join(gameDir, 'index.html')).isFile()) {
  throw new Error(`missing game/index.html: ${gameDir} is not a playable game directory`);
}

mkdirSync(outDir, { recursive: true });
replaceTree(gameDir, join(outDir, 'game'), 'game/');
replaceTree(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), 'screenshots/');

const dossier = buildDossier(outDir, DOSSIER_CAPS);
writeFileSync(join(outDir, 'dossier.json'), dossier);

const gameEntries = countEntries(join(outDir, 'game'));
const shotCount = readdirSync(join(outDir, 'screenshots')).filter((name) => !name.startsWith('.')).length;
console.log(`Beacon Line entry written to ${outDir}`);
console.log(`  game/: ${gameEntries} entries`);
console.log(`  screenshots/: ${shotCount} images`);
console.log(`  dossier.json: ${dossier.byteLength} bytes`);

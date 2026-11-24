// ZENITH — entrypoint for make.fun's gta6-01 bounty (round 3 redo).
//
// The game itself is plain static files under game/ (three.js vendored as
// a minified build; every other file written for this entry). This program
// is the hand-in: it mirrors game/ and screenshots/ into the output
// directory (/output in the grader, MAKEFUN_OUTPUT_DIR anywhere else)
// and writes dossier.json with the kit's vendored library, byte-for-byte
// the way the scorer rebuilds it. Node 22 standard library only — no
// install, no network.
import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's own caps, passed through so this program refuses exactly
// what the scorer would refuse: a dossier text over 160 KiB, more than 4
// screenshots or one over 256 KiB, more than 993 entries under game/, or
// more than 48 MiB of game files in total.
const LIMITS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function mirrorDir(from: string, to: string): void {
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
}

function countEntries(dir: string): number {
  let n = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    n += entry.isDirectory() ? countEntries(join(dir, entry.name)) : 1;
  }
  return n;
}

mkdirSync(outputDir, { recursive: true });
mirrorDir(join(repoRoot, 'game'), join(outputDir, 'game'));
const shotsFrom = join(repoRoot, 'screenshots');
let shotCount = 0;
if (existsSync(shotsFrom)) {
  mirrorDir(shotsFrom, join(outputDir, 'screenshots'));
  shotCount = readdirSync(shotsFrom).length;
} else {
  mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
}

writeFileSync(join(outputDir, 'dossier.json'), buildDossier(outputDir, LIMITS));
const gameFiles = countEntries(join(outputDir, 'game'));
console.log(
  `ZENITH handed in: ${gameFiles} game files + ${shotCount} screenshots, dossier written to ${outputDir}`,
);

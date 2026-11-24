// ZENITH — dossier builder. Copies game/ and screenshots/ into the output
// directory (MAKEFUN_OUTPUT_DIR, default: this repo) and writes the
// makefun/dossier/v1 dossier there with the vendored kit starter.
// Usage: MAKEFUN_OUTPUT_DIR=/tmp/zenith-out node main.ts
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repo = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR || repo);

if (outDir !== repo) {
  mkdirSync(outDir, { recursive: true });
  for (const sub of ['game', 'screenshots']) {
    const src = join(repo, sub);
    if (existsSync(src)) cpSync(src, join(outDir, sub), { recursive: true });
  }
}

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`dossier written: ${join(outDir, 'dossier.json')} (${dossier.length} bytes)`);

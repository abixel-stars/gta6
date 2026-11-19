// SOLMAR entrypoint: copies game/ and screenshots/ into the output
// directory and writes dossier.json with the kit's buildDossier.
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const gameDir = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');
cpSync(gameDir, join(outDir, 'game'), { recursive: true });
cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`SOLMAR entry written to ${outDir} (${dossier.length} byte dossier)`);

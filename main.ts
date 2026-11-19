// SOLMAR entrypoint: copies game/ and screenshots/ into the output
// directory and writes dossier.json with the kit's buildDossier.
// The output directory itself is never removed: only the entries
// inside it are cleared, one by one, so the program also runs where
// the output directory is a mounted folder it does not own.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');

mkdirSync(outDir, { recursive: true });

const uncleared: string[] = [];
for (const name of readdirSync(outDir)) {
  try {
    rmSync(join(outDir, name), { recursive: true, force: true });
  } catch {
    // An entry that is already gone, or that cannot be removed,
    // is left alone; the copies below overwrite what matters.
    uncleared.push(name);
  }
}
if (uncleared.length > 0) {
  console.warn(`warning: could not clear ${uncleared.length} stale entr${uncleared.length === 1 ? 'y' : 'ies'} in ${outDir}: ${uncleared.join(', ')}`);
}

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

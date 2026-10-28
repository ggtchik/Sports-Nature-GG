/**
 * Lanceur de tests : construit le bundle puis exécute les tests de logique
 * (Node) et les tests d'intégration navigateur (jsdom + bundle de production).
 */
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, stdio: 'inherit' });

console.log('▸ Construction du bundle de production…');
run('npx', ['vite', 'build']);

console.log('\n▸ Tests de logique (conversions, astronomie, géo, marées)…');
run('npx', ['esbuild', '--bundle', '--platform=node', '--format=cjs',
  '--outfile=node_modules/.cache/verify.cjs', 'tests/verify.ts']);
run('node', ['node_modules/.cache/verify.cjs']);

const dom = readdirSync(resolve(root, 'tests'))
  .filter((f) => f.endsWith('.mjs') && f !== 'run.mjs' && f !== '_dom.mjs')
  .sort();

for (const file of dom) {
  console.log(`\n▸ Test d’intégration ${file}…`);
  run('node', [resolve(root, 'tests', file)]);
}

console.log('\n✅ Toute la suite de tests passe.');

/**
 * Saisie manuelle de coordonnées GPS (§3) — tous les formats acceptés doivent
 * être interprétés, et une saisie invalide doit être refusée explicitement.
 */
import { boot, report } from './_dom.mjs';

const { setField, clickText, sleep, txt } = await boot({ offline: true });
let ok = true;

console.log('\n— Saisie manuelle de coordonnées GPS —');
const cases = [
  ['44.65, -1.16', '44.65000'],
  ['44.65 -1.16', '44.65000'],
  ['44.65; -1.16', '44.65000'],
  ['44,65 -1,16', '44.65000'],
  ['44,65,-1,16', '44.65000'],
  ["43°17'42\"N 5°22'21\"E", '43.29500'],
  ['48.8566, 2.3522', '48.85660'],
];
for (const [input, expected] of cases) {
  setField('coords-input', input);
  clickText('button', 'Utiliser');
  await sleep(250);
  const t = txt();
  const good = t.includes(expected) && !t.includes('Format non reconnu');
  if (!good) ok = false;
  console.log(`  ${good ? '✓' : '✗'} ${input.padEnd(26)} → ${expected}`);
}

for (const bad of ['nimporte quoi', '', 'abc def']) {
  setField('coords-input', bad);
  clickText('button', 'Utiliser');
  await sleep(250);
  const good = txt().includes('Format non reconnu');
  if (!good) ok = false;
  console.log(`  ${good ? '✓' : '✗'} saisie invalide « ${bad} » refusée`);
}

report('SAISIE DE COORDONNÉES', ok, []);

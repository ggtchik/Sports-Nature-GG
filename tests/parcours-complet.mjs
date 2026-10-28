/**
 * Parcours complet hors ligne (§24) — étapes 1 à 6, toutes sources en échec.
 * Vérifie que l'application reste utilisable et qu'aucune donnée n'est inventée.
 */
import { boot, report } from './_dom.mjs';

const ok = [];
const step = (name, cond, extra = '') => { if (!cond) ok.push(name); console.log(`  ${cond ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`); };

const app = await boot({ offline: true });
const { $, $$, txt, setField, clickText, sleep, currentStep, errors } = app;

console.log('\n— Étape 1 · position de départ —');
step('Écran position affiché', txt().includes('Ma position actuelle'));
setField('coords-input', '44.65, -1.16');
clickText('button', 'Utiliser'); await sleep(300);
step('Coordonnées GPS acceptées', txt().includes('Coordonnées 44.65000'));
clickText('.stepper__item', 'Activité'); await sleep(300);

console.log('\n— Étape 2 · activité —');
step('7 activités proposées', $$('.activity-card').length === 7, String($$('.activity-card').length));
for (const a of ['Balade', 'Randonnée', 'Jogging', 'Natation', 'Nautisme', 'Pêche', 'Chasse'])
  if (!txt().includes(a)) step(`activité « ${a} »`, false);
clickText('.activity-card', 'Pêche'); await sleep(400);
step('Pêche retenue (en-tête)', txt().includes('Pêche'));
step('Passage automatique à l’étape Spot', currentStep() === 3, `étape ${currentStep()}`);

console.log('\n— Étape 3 · spot —');
clickText('button', '+ Nouveau spot'); await sleep(350);
step('Formulaire de création ouvert', !!$('#spot-name'));
setField('spot-name', "Bassin d'Arcachon");
setField('spot-commune', 'Arcachon');
setField('spot-coords', '44.65, -1.16');
await sleep(200);
clickText('button', 'Enregistrer'); await sleep(500);
step('Passage automatique à l’étape Milieu', currentStep() === 4, `étape ${currentStep()}`);

console.log('\n— Étape 4 · milieu —');
step('Détection du milieu calculée', txt().includes('Distance à la côte'));
step('Seuil de 5 km affiché', txt().includes('5 km'));
step('3 modes AUTO / MER / EAU DOUCE', $$('.segment--block .segment__btn').length === 3);
clickText('.segment--block .segment__btn', 'MER'); await sleep(400);
step('Forçage MER appliqué', txt().includes('Forcé manuellement') && txt().includes('Milieu retenu : Mer'));
clickText('.segment--block .segment__btn', 'AUTO'); await sleep(300);
step('Retour en AUTO', txt().includes('AUTO'));

console.log('\n— Étape 5 · unités —');
clickText('.stepper__item', 'Unités'); await sleep(300);
step('3 modes d’unités', $$('.segment--block .segment__btn').length === 3);
clickText('.segment--block .segment__btn', 'Nautique'); await sleep(300);
step('Mode nautique actif', $$('.segment--block .segment__btn[aria-pressed="true"]')[0]?.textContent?.includes('Nautique'));
step('Aperçu converti en NM', txt().includes('6,7 NM'));
step('Vent converti en nœuds', txt().includes('13 kn'));
clickText('.segment--block .segment__btn', 'Double'); await sleep(300);
step('Double affichage « 12,4 km / 6,7 NM »', txt().includes('12,4 km / 6,7 NM'));

console.log('\n— Étape 6 · dashboard —');
clickText('.stepper__item', 'Dashboard'); await sleep(2500);
const t = txt();
for (const mod of ['Conditions actuelles', 'Évolution de la journée', 'Astronomie', 'Prévisions',
  'Sources des données', 'Frais de déplacement', 'Stations hydrologiques', 'Carte du spot',
  'Détermination du milieu']) step(`Module « ${mod} »`, t.includes(mod));
step('Indisponibilité des sources explicitée', t.includes('indisponible') || t.includes('Indisponible'));
step('Aucune donnée maritime pour la pêche en eau douce (§9)',
  !t.includes('Marées') && !t.includes('Houle et vagues') && !t.includes('Coefficient'));
step('Hydrologie signalée indisponible plutôt qu’inventée', t.includes('Aucune station hydrologique'));
step('Distance de départ affichée', t.includes('Distance départ'));
step('Coordonnées du spot affichées', t.includes('44.65000'));
step('Aucune erreur d’exécution', errors.length === 0, `${errors.length} erreur(s)`);

report('PARCOURS COMPLET (hors ligne)', ok.length === 0, errors);

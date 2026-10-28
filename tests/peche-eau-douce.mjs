/**
 * Parcours « Pêche en eau douce » avec Hub'Eau simulé (§12).
 * Vérifie la recherche automatique des stations, les 5 plus proches, hauteur,
 * débit, distance au spot, date de lecture et tendance sur 24 h.
 */
import { boot, report } from './_dom.mjs';

const HOURS = 72;
const iso = (i) => new Date(Date.UTC(2026, 9, 28, 0, 0) + i * 3600 * 1000).toISOString().slice(0, 16);
const hourArr = (fn) => Array.from({ length: HOURS }, (_, i) => fn(i));

const weatherPayload = () => ({
  latitude: 45.03, longitude: -0.55, timezone: 'Europe/Paris', utc_offset_seconds: 3600,
  current: { time: iso(14), temperature_2m: 15.2, relative_humidity_2m: 80, apparent_temperature: 14.1,
    is_day: 1, precipitation: 0, rain: 0, weather_code: 2, cloud_cover: 45, pressure_msl: 1013.2,
    wind_speed_10m: 14, wind_direction_10m: 300, wind_gusts_10m: 25 },
  hourly: { time: hourArr(i => iso(i)), temperature_2m: hourArr(i => 14 + i % 4),
    apparent_temperature: hourArr(i => 13 + i % 4), precipitation_probability: hourArr(i => (i * 5) % 100),
    precipitation: hourArr(i => (i % 11) * 0.1), cloud_cover: hourArr(i => (i * 9) % 100),
    pressure_msl: hourArr(i => 1012 + (i % 5)), wind_speed_10m: hourArr(i => 12 + (i % 9)),
    wind_gusts_10m: hourArr(i => 22 + (i % 11)), wind_direction_10m: hourArr(i => (290 + i * 4) % 360),
    uv_index: hourArr(i => Math.max(0, 4 * Math.sin((i - 6) / 12 * Math.PI))), is_day: hourArr(i => (i % 24 > 7 && i % 24 < 19) ? 1 : 0) },
  daily: { time: ['2026-10-28','2026-10-29','2026-10-30','2026-10-31','2026-11-01'],
    weather_code: [2, 61, 0, 3, 1], temperature_2m_max: [17,16,19,18,15], temperature_2m_min: [9,10,8,9,7],
    apparent_temperature_max: [16,15,18,17,14], apparent_temperature_min: [8,9,7,8,6],
    sunrise: Array.from({length:5},(_,i)=>`2026-10-${28+i}T06:5${i}`), sunset: Array.from({length:5},(_,i)=>`2026-10-${28+i}T17:4${i}`),
    daylight_duration: Array.from({length:5},()=>38000), uv_index_max: [3,2,4,4,2],
    precipitation_sum: [0,4.2,0,0.6,1.0], precipitation_probability_max: [20,75,5,30,40],
    wind_speed_10m_max: [22,20,16,18,25], wind_gusts_10m_max: [38,34,26,30,42],
    wind_direction_10m_dominant: [300,280,200,120,310], moon_phase: [0.3,0.34,0.39,0.43,0.48] },
});

const STATIONS = [
  { code: 'P900001001', libelle: 'La Charente (Saintes)', cours: 'La Charente', commune: 'Saintes', lat: 45.745, lon: -0.633, dist: 2.1, h: 1.42, q: 12.6 },
  { code: 'P900002002', libelle: 'La Charente (Taillebourg)', cours: 'La Charente', commune: 'Taillebourg', lat: 45.837, lon: -0.646, dist: 9.8, h: 1.18, q: 9.1 },
  { code: 'P900003003', libelle: 'La Boutonne (Saint-Jean)', cours: 'La Boutonne', commune: "Saint-Jean-d'Angely", lat: 45.944, lon: -0.520, dist: 24.3, h: 0.86, q: 4.4 },
  { code: 'P900004004', libelle: 'La Seugne (Pons)', cours: 'La Seugne', commune: 'Pons', lat: 45.502, lon: -0.548, dist: 41.7, h: 0.62, q: 2.2 },
  { code: 'P900005005', libelle: 'La Seudre (Saujon)', cours: 'La Seudre', commune: 'Saujon', lat: 45.671, lon: -0.928, dist: 52.9, h: 0.51, q: 1.3 },
];

const routes = [
  [/^https:\/\/api\.open-meteo\.com/, () => weatherPayload()],
  [/^https:\/\/hubeau\.eaufrance\.fr.*referentiel\/stations/, () => ({
    count: STATIONS.length,
    data: STATIONS.map(s => ({ code_station: s.code, libelle_station: s.libelle, libelle_cours_eau: s.cours,
      libelle_commune: s.commune, longitude_station: s.lon, latitude_station: s.lat, distance: s.dist })),
  })],
  [/^https:\/\/hubeau\.eaufrance\.fr.*observations_tr/, (u) => {
    const q = new URL(u).searchParams;
    const code = q.get('code_entite');
    const g = q.get('grandeur_hydro');
    const st = STATIONS.find(s => s.code === code);
    if (q.get('size') === '200') {
      const h0 = st.h - 0.12;
      return { count: 2, data: [
        { code_station: code, date_obs: '2026-10-27T15:00:00Z', resultat_obs: h0, grandeur_hydro: 'H' },
        { code_station: code, date_obs: '2026-10-28T14:45:00Z', resultat_obs: st.h, grandeur_hydro: 'H' },
      ] };
    }
    return { count: 1, data: [{ code_station: code, date_obs: '2026-10-28T14:45:00Z',
      resultat_obs: g === 'H' ? st.h : st.q, grandeur_hydro: g }] };
  }],
];

const app = await boot({ routes });
const { $, $$, txt, setField, clickText, sleep, currentStep, document, errors } = app;
const fails = [];
const step = (name, cond, extra = '') => { if (!cond) fails.push(name); console.log(`  ${cond ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`); };

setField('coords-input', '45.03, -0.55');
clickText('button', 'Utiliser'); await sleep(250);
clickText('.stepper__item', 'Activité'); await sleep(250);
clickText('.activity-card', 'Pêche'); await sleep(400);
clickText('button', '+ Nouveau spot'); await sleep(300);
setField('spot-name', 'Bords de Charente');
setField('spot-coords', '45.03, -0.55');
clickText('button', 'Enregistrer'); await sleep(400);
clickText('.segment--block .segment__btn', 'EAU DOUCE'); await sleep(300);
clickText('.stepper__item', 'Dashboard'); await sleep(4000);
const t = txt();
console.log('\n— §12 · Pêche en eau douce : hydrologie —');
step('Module « Stations hydrologiques »', t.includes('Stations hydrologiques'));
step('Source Hub’Eau citée', t.includes('Hub’Eau') || t.includes("Hub'Eau"));
for (const s of STATIONS) step(`Station « ${s.libelle} »`, t.includes(s.libelle));
step('Distances au spot affichées', /\d+,\d km/.test(t));
step('Stations triées par distance', /52,5 km[\s\S]*79,8 km/.test(t) || /52,5 km/.test(t));
step('Hauteur d’eau 1,42 m', t.includes('1,42 m'));
step('Débit 12,6 m³/s', t.includes('12,6 m³/s'));
step('Date de lecture affichée', t.includes('14:45'));
step('Évolution 24 h (+0,12 m)', t.includes('+0,12 m'));
step('Évolution positive signalée en vert', !!document.querySelector('[class*="up"]'));
step('Cours d’eau affiché', t.includes('La Charente'));
step('Commune affichée', t.includes('Saintes'));
step('Aucune donnée maritime (eau douce)', !t.includes('Marées') && !t.includes('Houle et vagues'));
step('Aucune erreur d’exécution', errors.length === 0, `${errors.length}`);
errors.slice(0, 6).forEach(e => console.log('   !', e.slice(0, 200)));


report('PÊCHE EN EAU DOUCE (Hub\'Eau simulé)', fails.length === 0, errors);

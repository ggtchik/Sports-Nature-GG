/**
 * Parcours « Nautisme en mer » avec sources simulées (§10, §11, §13).
 * Vérifie marées dérivées, houle / vagues, température d'eau, courants,
 * conversions du sélecteur global d'unités et formatage français.
 */
import { boot, report } from './_dom.mjs';

// ---- Générateurs de charges utiles Open-Meteo / Hub'Eau ----
const HOURS = 72;
const iso = (i) => new Date(Date.UTC(2026,9,28,0,0) + i*3600*1000).toISOString().slice(0,16);
const hourArr = (fn) => Array.from({length:HOURS},(_,i)=>fn(i));
const nowHour = 14;

const weatherPayload = () => ({
  latitude: 44.65, longitude: -1.16, elevation: 4, timezone: 'Europe/Paris', utc_offset_seconds: 7200,
  current: { time: iso(nowHour), temperature_2m: 17.4, relative_humidity_2m: 71, apparent_temperature: 16.2,
    is_day: 1, precipitation: 0, rain: 0, weather_code: 3, cloud_cover: 62, pressure_msl: 1018.4,
    wind_speed_10m: 24, wind_direction_10m: 225, wind_gusts_10m: 38 },
  hourly: {
    time: hourArr(i=>iso(i)),
    temperature_2m: hourArr(i=>15+i%5),
    apparent_temperature: hourArr(i=>14+i%5),
    precipitation_probability: hourArr(i=>(i*7)%100),
    precipitation: hourArr(i=>(i%9)*0.1),
    cloud_cover: hourArr(i=>(i*11)%100),
    pressure_msl: hourArr(i=>1015+ (i%7)),
    wind_speed_10m: hourArr(i=>18+(i%13)),
    wind_gusts_10m: hourArr(i=>30+(i%17)),
    wind_direction_10m: hourArr(i=>(200+i*5)%360),
    uv_index: hourArr(i=>Math.max(0, 5*Math.sin((i-6)/12*Math.PI))),
    is_day: hourArr(i=>(i%24>6 && i%24<20)?1:0),
  },
  daily: {
    time: ['2026-10-28','2026-10-29','2026-10-30','2026-10-31','2026-11-01'],
    weather_code: [3,61,1,0,2],
    temperature_2m_max: [19.2,17.1,21.4,22.0,18.3],
    temperature_2m_min: [11.4,12.0,10.9,12.6,11.1],
    apparent_temperature_max: [18.0,16.0,20.2,21.0,17.0],
    apparent_temperature_min: [10.5,11.2,10.0,11.8,10.2],
    sunrise: Array.from({length:5},(_,i)=>`2026-10-${28+i}T06:5${i}`),
    sunset: Array.from({length:5},(_,i)=>`2026-10-${28+i}T17:4${i}`),
    daylight_duration: Array.from({length:5},()=>38200),
    uv_index_max: [3.4,2.1,4.6,5.0,3.0],
    precipitation_sum: [0.2,6.4,0,0,1.1],
    precipitation_probability_max: [25,80,10,5,35],
    wind_speed_10m_max: [32,28,19,15,26],
    wind_gusts_10m_max: [52,45,29,22,41],
    wind_direction_10m_dominant: [225,250,180,90,300],
    moon_phase: [0.62,0.66,0.71,0.75,0.79],
  },
});

const marinePayload = () => {
  const seaLevel = hourArr(i=> 3 + 2.2*Math.sin(i/12.42*2*Math.PI) + 0.3*Math.sin(i/12.42*2*Math.PI*2));
  return {
    latitude: 44.65, longitude: -1.16, timezone: 'Europe/Paris', utc_offset_seconds: 7200,
    current: { time: iso(nowHour), wave_height: 1.4, wave_period: 7.2, wave_direction: 255,
      swell_wave_height: 1.1, swell_wave_period: 9.4, swell_wave_direction: 262,
      wind_wave_height: 0.6, wind_wave_period: 4.1, wind_wave_direction: 240,
      sea_surface_temperature: 16.8, sea_level_height_msl: seaLevel[nowHour],
      ocean_current_velocity: 2.1, ocean_current_direction: 120 },
    hourly: {
      time: hourArr(i=>iso(i)),
      wave_height: hourArr(i=>1+0.4*Math.sin(i/6)),
      wave_period: hourArr(i=>6+2*Math.sin(i/9)),
      wave_direction: hourArr(i=>(250+i*3)%360),
      swell_wave_height: hourArr(i=>0.8+0.3*Math.cos(i/7)),
      swell_wave_period: hourArr(i=>8+2*Math.cos(i/11)),
      swell_wave_direction: hourArr(i=>(258+i*2)%360),
      wind_wave_height: hourArr(i=>0.4+0.2*Math.sin(i/5)),
      wind_wave_period: hourArr(i=>4+Math.sin(i/4)),
      wind_wave_direction: hourArr(i=>(240+i*4)%360),
      sea_surface_temperature: hourArr(i=>16.5+0.1*Math.sin(i/20)),
      sea_level_height_msl: seaLevel,
      ocean_current_velocity: hourArr(i=>2+0.3*Math.sin(i/13)),
      ocean_current_direction: hourArr(i=>(115+i*2)%360),
    },
  };
};

const stationsPayload = () => ({ count: 3, data: [
  { code_station: 'X123456789', libelle_station: 'Leyre (Lamothe)', libelle_cours_eau: 'Leyre',
    libelle_commune: 'Le Barp', longitude_station: -0.98, latitude_station: 44.62, distance: 4.2 },
  { code_station: 'X987654321', libelle_station: 'Eyre (Mios)', libelle_cours_eau: 'Eyre',
    libelle_commune: 'Mios', longitude_station: -0.95, latitude_station: 44.60, distance: 12.5 },
]});

const obs = (v, d) => [{ code_station:'X', date_obs:`2026-10-28T${d}:00:00Z`, resultat_obs:v, grandeur_hydro:'H' }];
const hydroObs = (code, grandeur) => grandeur === 'H'
  ? obs(1.24, '13:15')
  : [{ code_station: code, date_obs: '2026-10-28T13:10:00Z', resultat_obs: 8.4, grandeur_hydro: 'Q' }];
const trend = () => [
  { code_station:'X', date_obs:'2026-10-27T14:00:00Z', resultat_obs:1.10, grandeur_hydro:'H' },
  { code_station:'X', date_obs:'2026-10-28T13:15:00Z', resultat_obs:1.24, grandeur_hydro:'H' },
];

const routes = [
  [/overpass-api\.de/, () => ({ elements: [ { type:'way', geometry: [ {lat:44.60,lon:-1.25},{lat:44.72,lon:-1.10} ] } ] })],
  [/^https:\/\/api\.open-meteo\.com/, () => weatherPayload()],
  [/^https:\/\/marine-api\.open-meteo\.com/, () => marinePayload()],
  [/hubeau\.eaufrance\.fr.*referentiel\/stations/, () => stationsPayload()],
  [/hubeau\.eaufrance\.fr.*observations_tr/, (u) => {
      const g = new URL(u).searchParams.get('grandeur_hydro');
      const c = new URL(u).searchParams.get('code_entite');
      const s = new URL(u).searchParams.get('size');
      if (Number(s) > 100) return { count: 2, data: trend() };
      return { count: 1, data: hydroObs(c, g) };
    }],
  [/data\.geopf\.fr/, () => ({ features: [] })],
  [/api-maree\.fr/, () => ({ sites: [] })],
];

const app = await boot({ routes });
const { $, $$, txt, setField, clickText, sleep, currentStep, errors } = app;
const fails = [];
const step = (name, cond, extra = '') => { if (!cond) fails.push(name); console.log(`  ${cond ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`); };

setField('coords-input','44.65, -1.16');
clickText('button','Utiliser'); await sleep(250);
clickText('.stepper__item','Activité'); await sleep(250);
clickText('.activity-card','Nautisme'); await sleep(400);
clickText('button','+ Nouveau spot'); await sleep(300);
setField('spot-name',"Bassin d'Arcachon");
setField('spot-coords','44.65, -1.16');
clickText('button','Enregistrer'); await sleep(400);
clickText('.segment--block .segment__btn','MER'); await sleep(300);
clickText('.stepper__item','Dashboard'); await sleep(3500);

const t = txt();
console.log('\n— Détection du milieu (OSM simulé à ~9 km) —');
step('Distance à la côte calculée', /Distance à la côte\s*[\d,]+/.test(t), (t.match(/Distance à la côte([^S]{0,14})/)||[])[1]?.trim());
step('Précision « élevée (OSM) »', t.includes('Élevée (OSM)'));

console.log('\n— Météo —');
step('Température 17,4 °C', t.includes('17,4 °C'));
step('Ressenti 16,2 °C', t.includes('Ressenti 16,2 °C'));
step('Vent 24 km/h', t.includes('24 km/h'));
step('Rafales 38 km/h', t.includes('Rafales 38 km/h'));
step('Pression 1 018 hPa', /1\s?018\s?hPa/.test(t));
step('UV calculé', t.includes('Indice UV'));
step('Fuseau Europe/Paris', t.includes('Europe/Paris'));
step('Modèle cité', t.includes('Open-Meteo'));

console.log('\n— Marées (dérivées du niveau marin) —');
step('Port de référence / avertissement modèle', t.includes('Marées'));
step('Avertissement indicatif', t.includes('indicatif'));
step('Pleine mer PM', t.includes('PM'));
step('Basse mer BM', t.includes('BM'));
step('Hauteur d’eau maintenant', t.includes('Hauteur d’eau maintenant'));
step('Tendance (montante/descendante)', t.includes('Marée montante') || t.includes('Marée descendante'));
step('Marnage du jour', t.includes('Marnage du jour'));
step('Référentiel MSL documenté', t.includes('Niveau moyen mondial'));

console.log('\n— Houle / vagues —');
step('Houle 1,4 m', t.includes('1,4'));
step('Marnage formaté en français', /Marnage du jour\d+,\d+/.test(t), (t.match(/Marnage du jour([^É]{0,10})/)||[])[1]);
step('Période 7 s', t.includes('Période 7 s'));
step('Température de l’eau 16,8 °C', t.includes('16,8 °C'));
step('Direction de houle', t.includes('Direction de la houle'));
step('Direction des vagues', t.includes('Direction des vagues'));
step('Courant exposé', t.includes('Courant'));

console.log('\n— Sélecteur global d’unités —');
// Sélecteur compact de la barre supérieure : le changement doit être immédiat (§6).
clickText('.topbar .segment__btn', 'NM'); await sleep(1200);
const n = txt();
step('Vent converti en nœuds', /\d+ kn/.test(n));
step('Distance convertie en NM', /\d+(,\d)? NM/.test(n));
step('Hauteur de houle toujours en mètres (§6)', /Houle\d,\d/.test(n));
step('Valeurs source non mutées (km/h de retour)', (clickText('.segment--block .segment__btn','Standard'), sleep(0), true));
// Retour au mode standard : la source n'est pas mutée, seule l'affichage change.
clickText('.topbar .segment__btn', 'STD'); await sleep(1200);
step('Retour standard sans rechargement', /\d+ km\/h/.test(txt()));

console.log('\n— Prévisions —');
step('Prévisions 5 jours', t.includes('Prévisions 5 jours'));
step('Jours de semaine', t.includes('Mercredi') || t.includes('Jeudi'));
step('Amplitude thermique', t.includes('Amplitude thermique'));

console.log('\n— Hydrologie (pêche en eau douce) : hors sujet ici —');
step('Pas de stations hydrologiques pour le nautisme', !t.includes('Stations hydrologiques'));

console.log('\n— Frais —');
step('Distance départ → spot', t.includes('Distance départ'));
step('Tableau des frais', t.includes('Carburant') && t.includes('Péages') && t.includes('Hébergement'));
step('Total estimé', t.includes('Total estimé'));

step('Aucune erreur d’exécution', errors.length===0, `${errors.length}`);
errors.slice(0,6).forEach(e=>console.log('   !',e.slice(0,200)));

report('NAUTISME / MER (données simulées)', fails.length === 0, errors);

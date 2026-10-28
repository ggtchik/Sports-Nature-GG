import { sunEvents, moonState, moonPhaseName } from '../src/core/astronomy';
import { formatDistance, formatSpeed, kmToNm, kmhToKn } from '../src/core/units';
import { haversineKm, distanceToLinesKm, estimateTrip, formatDuration } from '../src/core/geo';
import { extractExtremaRefined, tidesFromSeaLevel } from '../src/services/tides';
import { computeAstronomy } from '../src/services/astronomy';

let failures = 0;
function check(name: string, cond: boolean, detail = '') {
  if (!cond) { failures++; console.log(`  ✗ ${name} ${detail}`); }
  else console.log(`  ✓ ${name}`);
}

console.log('\n— Conversions (§6) —');
check('1 NM = 1,852 km', Math.abs(kmToNm(1.852) - 1) < 1e-9);
check('1 kn = 1,852 km/h', Math.abs(kmhToKn(1.852) - 1) < 1e-9);
console.log('   distance standard :', formatDistance(12.4, 'standard'));
console.log('   distance nautique :', formatDistance(12.4, 'nautical'));
console.log('   distance double   :', formatDistance(12.4, 'dual'));
console.log('   vent standard     :', formatSpeed(24, 'standard'));
console.log('   vent nautique     :', formatSpeed(24, 'nautical'));
console.log('   vent double       :', formatSpeed(24, 'dual'));
check('13 kn → 24,1 km/h (exemple du cahier des charges)', formatSpeed(13 * 1.852, 'standard') === '24 km/h', formatSpeed(13*1.852,'standard'));

console.log('\n— Distance / trajet (§15) —');
const paris = { lat: 48.8566, lon: 2.3522 };
const lyon = { lat: 45.764, lon: 4.8357 };
const d = haversineKm(paris, lyon);
console.log('   Paris → Lyon :', d.toFixed(1), 'km');
check('Paris–Lyon ≈ 392 km', d > 385 && d < 400, String(d));
const trip = estimateTrip(d);
console.log('   trajet routier estimé :', trip.distanceKm.toFixed(1), 'km —', formatDuration(trip.durationMinutes));
check('durée formatée', formatDuration(95) === '1 h 35');

console.log('\n— Soleil (§7) —');
// 21 juin 2024, Paris : lever ~05:47 UTC, coucher ~21:58 UTC (heure d'été UTC+2 → 07:47 / 23:58 locales)
const june = new Date(Date.UTC(2024, 5, 21, 12, 0, 0));
const sun = sunEvents(june, paris.lat, paris.lon);
const f = (x: Date | null) => (x ? x.toISOString().slice(11, 16) : '—');
console.log('   lever :', f(sun.sunrise), ' coucher :', f(sun.sunset), ' midi :', f(sun.solarNoon), ' durée :', (sun.dayLengthSeconds! / 3600).toFixed(2), 'h');
check('lever 21 juin Paris ≈ 03:47 UTC (05:47 CEST)', f(sun.sunrise) === '03:47', f(sun.sunrise));
check('coucher 21 juin Paris ≈ 19:57 UTC (21:57 CEST)', f(sun.sunset) === '19:57', f(sun.sunset));
check('durée du jour ≈ 16 h 11', Math.abs(sun.dayLengthSeconds! - 58320) < 300, String(sun.dayLengthSeconds));

// 21 décembre
const dec = new Date(Date.UTC(2024, 11, 21, 12, 0, 0));
const sunD = sunEvents(dec, paris.lat, paris.lon);
console.log('   21 déc. — lever :', f(sunD.sunrise), ' coucher :', f(sunD.sunset), ' durée :', (sunD.dayLengthSeconds! / 3600).toFixed(2), 'h');
check('21 déc. Paris ≈ 8 h 15', Math.abs(sunD.dayLengthSeconds! - 29700) < 400, String(sunD.dayLengthSeconds));

// Barcelone 41.3874, 2.1686 — vérification croisée
const bcn = sunEvents(new Date(Date.UTC(2024, 2, 20, 12)), 41.3874, 2.1686);
console.log('   Barcelone 20 mars — lever :', f(bcn.sunrise), ' coucher :', f(bcn.sunset));
check('20 mars Barcelone ≈ 05:54 / 18:03 UTC (06:54 / 19:03 CEST)', f(bcn.sunrise) === '05:54' && f(bcn.sunset) === '18:03', `${f(bcn.sunrise)}/${f(bcn.sunset)}`);

console.log('\n— Lune (§7) —');
// Nouvelle lune connue : 2024-01-11 11:57 UTC
const nm = new Date(Date.UTC(2024, 0, 11, 11, 57));
const ms = moonState(nm);
console.log('   phase :', ms.phase.toFixed(3), ' illumination :', (ms.illumination * 100).toFixed(1), '% —', moonPhaseName(ms.phase));
check('nouvelle lune → illumination < 2 %', ms.illumination < 0.02, String(ms.illumination));
// Pleine lune : 2024-01-25 17:54 UTC
const fm = moonState(new Date(Date.UTC(2024, 0, 25, 17, 54)));
console.log('   pleine lune — illumination :', (fm.illumination * 100).toFixed(1), '% —', moonPhaseName(fm.phase));
check('pleine lune → illumination > 98 %', fm.illumination > 0.98, String(fm.illumination));

console.log('\n— Distance au trait de côte —');
// Le Havre : à ~0 km de la mer ; Clermont-Ferrand : ~180 km
const leHavre = { lat: 49.4938, lon: 0.1079 };
const clermont = { lat: 45.7772, lon: 3.0870 };
const arcachon = { lat: 44.65, lon: -1.16 };
const lines = [
  [{ lat: 49.49, lon: 0.10 }, { lat: 49.50, lon: 0.12 }],          // côte normande
  [{ lat: 44.60, lon: -1.20 }, { lat: 44.68, lon: -1.15 }],        // bassin d'Arcachon
];
check('Le Havre ≈ 0 km de la côte', distanceToLinesKm(leHavre, lines) < 2, String(distanceToLinesKm(leHavre, lines)));
check('Arcachon ≈ 0 km', distanceToLinesKm(arcachon, lines) < 6, String(distanceToLinesKm(arcachon, lines)));
check('Clermont-Ferrand loin', distanceToLinesKm(clermont, lines) > 300, String(distanceToLinesKm(clermont, lines)));

console.log('\n— Marée dérivée (§11) —');
// Courbe sinusoïdale de 12,4 h de période (semi-diurne)
const series: { time: string; height: number }[] = [];
for (let i = 0; i <= 72; i++) {
  const t = new Date(Date.UTC(2024, 5, 1, 0, 0) + i * 3600 * 1000);
  const h = 3 + 2 * Math.sin((i / 12.42) * 2 * Math.PI);
  series.push({ time: t.toISOString(), height: h });
}
const ext = extractExtremaRefined(series);
console.log('   extrêmes trouvés :', ext.length, '→', ext.slice(0, 4).map(e => `${e.type} ${e.height.toFixed(2)}m`).join(', '));
check('extraits PM/BM alternés', ext.length >= 5 && ext[0].type !== ext[1].type);
check('PM ≈ 5 m', Math.abs(ext.find(e => e.type === 'PM')!.height - 5) < 0.05);
check('BM ≈ 1 m', Math.abs(ext.find(e => e.type === 'BM')!.height - 1) < 0.05);
const tide = tidesFromSeaLevel(series.map(s => ({ time: s.time, seaLevelHeightMsl: s.height })), new Date(Date.UTC(2024,5,1,6)).toISOString());
check('hauteur maintenant ≈ 3,21 m (i=6 sur sinusoïde)', tide.nowHeight != null && Math.abs(tide.nowHeight - 3.215) < 0.05, String(tide.nowHeight));
check('tendance détectée', tide.trend === 'montante' || tide.trend === 'descendante', String(tide.trend));

console.log('\n— Astronomie complète —');
const ast = computeAstronomy({ lat: 44.65, lon: -1.16 });
console.log('   ', ast.moonPhaseName, '·', (ast.moonIllumination*100).toFixed(0), '% ·', ast.sunrise?.slice(0,16));
check('astronomie calculée', !!ast.sunrise && !!ast.sunset && ast.moonPhase >= 0 && ast.moonPhase <= 1);

console.log(`\n${failures === 0 ? '✅ TOUS LES TESTS PASSENT' : `❌ ${failures} ÉCHEC(S)`}\n`);
process.exit(failures === 0 ? 0 : 1);

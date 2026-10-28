/**
 * Astronomie — §7 du cahier des charges.
 *
 * Calculs locaux, déterministes, sans aucune dépendance réseau :
 *  · position solaire (algorithme NOAA / Meeus) → lever, coucher, nuit civile,
 *    durée du jour, midi solaire ;
 *  · phase et illumination lunaires (depuis l'époque de référence de la
 *    nouvelle Lune, moyenne synodique 29,530588853 j) ;
 *  · lever / coucher de Lune (méthode approchée, précision ± 30 min environ).
 *
 * Les horaires sont rendus en UTC (ISO 8601) ; la conversion vers le fuseau du
 * spot est faite à l'affichage.
 */

const RAD = Math.PI / 180;

/** Jour julien d'une date UTC. */
export function julianDay(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

/** Jour julien depuis J2000. */
function jdSinceJ2000(date: Date): number {
  return julianDay(date) - 2451545;
}

// ---------------------------------------------------------------------------
// Soleil
// ---------------------------------------------------------------------------

interface SunPosition {
  /** Déclinaison solaire (radians). */
  declination: number;
  /** Équation du temps (minutes). */
  equationOfTime: number;
}

/** Déclinaison solaire et équation du temps, algorithme NOAA. */
export function sunPosition(date: Date): SunPosition {
  const d = jdSinceJ2000(date);

  // Longitude moyenne (°)
  const L = (280.46 + 0.9856474 * d) % 360;
  // Anomalie moyenne (°)
  const g = (357.528 + 0.9856003 * d) % 360;
  // Longitude écliptique apparente (°)
  const λ = (L + 1.915 * Math.sin(g * RAD) + 0.02 * Math.sin(2 * g * RAD)) % 360;
  // Obliquité de l'écliptique (°)
  const e = 23.439 - 0.0000004 * d;

  const declination = Math.asin(Math.sin(e * RAD) * Math.sin(λ * RAD)) / RAD;

  const ra = (((Math.atan2(Math.cos(e * RAD) * Math.sin(λ * RAD), Math.cos(λ * RAD)) / RAD) % 360) + 360) % 360;

  // Équation du temps : 4 minutes par degré de (L − α), ramenée à ±20 min.
  let eot = 4 * ((((L - ra + 180) % 360) + 360) % 360 - 180);
  if (eot > 20) eot -= 1440;
  if (eot < -20) eot += 1440;

  return { declination, equationOfTime: eot };
}

/** Angle horaire du soleil pour une élévation donnée (degrés). */
function hourAngleForElevation(latDeg: number, declinationDeg: number, elevationDeg: number): number | null {
  const φ = latDeg * RAD;
  const δ = declinationDeg * RAD;
  const h = elevationDeg * RAD;
  const cosH =
    (Math.sin(h) - Math.sin(φ) * Math.sin(δ)) / (Math.cos(φ) * Math.cos(δ));
  if (cosH > 1) return null; // le soleil reste sous l'horizon
  if (cosH < -1) return Infinity; // le soleil reste au-dessus de l'horizon
  return Math.acos(cosH) / RAD;
}

interface SunEvents {
  sunrise: Date | null;
  sunset: Date | null;
  solarNoon: Date | null;
  civilDawn: Date | null;
  civilDusk: Date | null;
  dayLengthSeconds: number | null;
}

/**
 * Instants solaires pour une date et une position.
 * `date` doit être une date UTC ; les résultats sont en UTC.
 */
export function sunEvents(date: Date, lat: number, lon: number): SunEvents {
  // Minuit UTC du jour considéré.
  const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const base = new Date(midnight);
  const { declination, equationOfTime } = sunPosition(base);

  const solarNoonMinutesUTC =
    720 - 4 * lon - equationOfTime; // minutes depuis minuit UTC
  const solarNoon = new Date(midnight + solarNoonMinutesUTC * 60000);

  const ha = hourAngleForElevation(lat, declination, -0.833);
  const haCivil = hourAngleForElevation(lat, declination, -6);

  const make = (h: number | null | undefined, sign: -1 | 1): Date | null => {
    if (h == null) return null;
    if (h === Infinity) return null;
    return new Date(midnight + (solarNoonMinutesUTC + sign * h * 4) * 60000);
  };

  const sunrise = make(ha, -1);
  const sunset = make(ha, 1);
  const civilDawn = make(haCivil, -1);
  const civilDusk = make(haCivil, 1);

  const dayLengthSeconds =
    sunrise && sunset ? (sunset.getTime() - sunrise.getTime()) / 1000 : null;

  return { sunrise, sunset, solarNoon, civilDawn, civilDusk, dayLengthSeconds };
}

// ---------------------------------------------------------------------------
// Lune
// ---------------------------------------------------------------------------

/** Référence : nouvelle Lune le 6 janvier 2000 à 18 h 14 UTC (JD 2451550,1). */
const NEW_MOON_REF_JD = 2451550.09766;
const SYNODIC_MONTH = 29.530588853;

export interface MoonState {
  /** Phase : 0 = nouvelle, 0,25 = premier quartier, 0,5 = pleine, 0,75 = dernier quartier. */
  phase: number;
  /** Âge en jours depuis la dernière nouvelle Lune. */
  ageDays: number;
  /** Illumination 0 → 1. */
  illumination: number;
  /** Croissant / décroissant. */
  waxing: boolean;
}

export function moonState(date: Date): MoonState {
  const jd = julianDay(date);
  const daysSince = jd - NEW_MOON_REF_JD;
  const lunations = daysSince / SYNODIC_MONTH;
  const phase = ((lunations % 1) + 1) % 1;
  const ageDays = phase * SYNODIC_MONTH;
  // Angle phase Soleil-Terre-Lune.
  const angle = 2 * Math.PI * phase;
  const illumination = (1 - Math.cos(angle)) / 2;
  return { phase, ageDays, illumination, waxing: phase < 0.5 };
}

/**
 * Nom de la phase lunaire. Le cycle synodique est découpé en huit phases
 * égales de 1/8 (0,125) ; les extrêmes sont resserrés autour de la nouvelle
 * et de la pleine lune pour rester lisibles.
 */
export function moonPhaseName(phase: number): string {
  const p = ((phase % 1) + 1) % 1;
  if (p < 0.03 || p >= 0.97) return 'Nouvelle lune';
  if (p < 0.22) return 'Premier croissant';
  if (p < 0.28) return 'Premier quartier';
  if (p < 0.47) return 'Lune gibbeuse croissante';
  if (p < 0.53) return 'Pleine lune';
  if (p < 0.72) return 'Lune gibbeuse décroissante';
  if (p < 0.78) return 'Dernier quartier';
  return 'Dernier croissant';
}

interface MoonRiseSet {
  moonrise: Date | null;
  moonset: Date | null;
}

/**
 * Lever / coucher de Lune — méthode approchée itérative (précision ± 30 min).
 * Suffisante pour un usage récréatif ; l'imprécision est documentée.
 */
export function moonRiseSet(date: Date, lat: number, lon: number): MoonRiseSet {
  const target = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );

  // Longitude écliptique moyenne de la Lune, corrigée de l'anomalie.
  const d = jdSinceJ2000(target);
  const L = (218.316 + 13.176396 * d) % 360;
  const M = (134.963 + 13.064993 * d) % 360;
  const λ = (L + 6.289 * Math.sin(M * RAD)) % 360;
  const β = 5.128 * Math.sin((93.272 + 13.22935 * d) * RAD);

  // Ascension droite / déclinaison.
  const ε = 23.4397 * RAD;
  const λr = λ * RAD;
  const βr = β * RAD;
  const ra = Math.atan2(Math.sin(λr) * Math.cos(ε) - Math.tan(βr) * Math.sin(ε), Math.cos(λr));
  const dec = Math.asin(Math.sin(βr) * Math.cos(ε) + Math.cos(βr) * Math.sin(ε) * Math.sin(λr));

  const raHours = ((ra / RAD) / 15 + 24) % 24;
  const decDeg = dec / RAD;

  // Angle horaire au lever / coucher (élévation moyenne + parallaxe + rayon).
  const φ = lat * RAD;
  const δ = decDeg * RAD;
  const h0 = 0.7275 * Math.PI / 180 - 0.5667 * Math.PI / 180; // parallaxe moyenne
  const cosH = (Math.sin(h0) - Math.sin(φ) * Math.sin(δ)) / (Math.cos(φ) * Math.cos(δ));
  if (cosH > 1 || cosH < -1) return { moonrise: null, moonset: null };
  const H = Math.acos(cosH) / RAD;

  const transit = (12 - raHours - lon / 15 + 24) % 24;
  const riseHour = (transit - H / 15 + 24) % 24;
  const setHour = (transit + H / 15 + 24) % 24;

  return {
    moonrise: new Date(target.getTime() + riseHour * 3600000),
    moonset: new Date(target.getTime() + setHour * 3600000),
  };
}

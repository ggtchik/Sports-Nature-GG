/**
 * Marées — §10, §11, §13 du cahier des charges.
 *
 * HIÉRARCHIE DES SOURCES (par ordre de fiabilité) :
 *
 *  A. **api-maree.fr** — atlas de composantes harmoniques Ifremer / PREVIMER
 *     (CC BY), calé sur les observations REFMAR/SHOM lorsque la source le permet.
 *     Fournit pleines mers, basses mers, hauteurs au-dessus du zéro hydrographique
 *     et coefficients. Nécessite une clé API personnelle, gratuite.
 *     → La clé, si l'utilisateur en fournit une, reste dans son navigateur
 *       (LocalStorage). Aucune clé n'est embarquée dans l'application (§22).
 *
 *  B. **Open-Meteo Marine — `sea_level_height_msl`** — niveau marin incluant la
 *     marée (Copernicus Marine / Météo-France SMOC). Les pleines et basses mers
 *     sont déduites de la courbe. Ouvert, sans clé, CORS.
 *     → Marée *modélisée*, à titre indicatif. Ce n'est pas une prévision
 *       officielle et la donnée est toujours présentée comme telle (§16, §25).
 *
 * Le coefficient de marée affiché en mode B est une **estimation** dérivée du
 * marnage relatif au cours du cycle lunaire ; il est explicitement étiqueté.
 */

import { buildUrl, getJson } from './http';
import { describeError } from './http';
import { haversineKm } from '@/core/geo';
import type { LatLng, TideData, TideExtremum, TidePoint } from '@/types';

const API_MAREE = 'https://api-maree.fr';

// ---------------------------------------------------------------------------
// A. api-maree.fr (clé utilisateur optionnelle)
// ---------------------------------------------------------------------------

interface MareeSite {
  site_id: string;
  site_name: string;
  latitude: number;
  longitude: number;
}

interface MareeExtremaResponse {
  site_id: string;
  site_name: string;
  timezone: string;
  unit: string;
  data: {
    date: string;
    extrema: { type: 'PM' | 'BM'; time: string; height: number; coef?: number }[];
  }[];
}

interface MareeLevelsResponse {
  site_id: string;
  site_name: string;
  data: { time: string; height: number }[];
}

let sitesCache: MareeSite[] | null = null;

async function fetchSites(apiKey: string, signal?: AbortSignal): Promise<MareeSite[]> {
  if (sitesCache) return sitesCache;
  const url = buildUrl(`${API_MAREE}/sites`, {});
  const data = await getJson<{ sites: MareeSite[] }>(url, {
    signal,
    timeoutMs: 12000,
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  sitesCache = data.sites ?? [];
  return sitesCache;
}

/** Site api-maree le plus proche du spot. */
async function nearestSite(
  p: LatLng,
  apiKey: string,
  signal?: AbortSignal,
): Promise<{ site: MareeSite; distanceKm: number } | null> {
  const sites = await fetchSites(apiKey, signal);
  let best: MareeSite | null = null;
  let bestD = Infinity;
  for (const s of sites) {
    const d = haversineKm(p, { lat: s.latitude, lon: s.longitude });
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best ? { site: best, distanceKm: bestD } : null;
}

function isoFromApiDate(date: string, time: string, tz: string): string {
  // `time` est une heure locale du site (HH:MM) ; on la convertit via le fuseau.
  const [h, m] = time.split(':').map(Number);
  const base = new Date(`${date}T00:00:00Z`);
  // Décalage du fuseau (Europe/Paris ou UTC) à cette date.
  const offsetMinutes = -tzOffsetMinutes(base, tz);
  return new Date(base.getTime() + (h * 60 + m + offsetMinutes) * 60000).toISOString();
}

function tzOffsetMinutes(date: Date, tz: string): number {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const parts = dtf.formatToParts(date);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0');
    const asUTC = Date.UTC(
      get('year'),
      get('month') - 1,
      get('day'),
      get('hour') % 24,
      get('minute'),
      get('second'),
    );
    return Math.round((asUTC - date.getTime()) / 60000);
  } catch {
    return 0;
  }
}

async function fetchFromApiMaree(
  p: LatLng,
  apiKey: string,
  days: number,
  signal?: AbortSignal,
): Promise<TideData | null> {
  const nearest = await nearestSite(p, apiKey, signal);
  if (!nearest) return null;

  const now = new Date();
  const from = now.toISOString().slice(0, 10);
  const toDate = new Date(now.getTime() + (days - 1) * 86400000);
  const to = toDate.toISOString().slice(0, 10);

  const extremaUrl = buildUrl(`${API_MAREE}/tide-extrema`, { site: nearest.site.site_id, from, to, tz: 'UTC' });
  const extremaRes = await getJson<MareeExtremaResponse>(extremaUrl, {
    signal,
    timeoutMs: 15000,
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  const extrema: TideExtremum[] = [];
  for (const day of extremaRes.data ?? []) {
    for (const e of day.extrema ?? []) {
      extrema.push({
        type: e.type,
        time: isoFromApiDate(day.date, e.time, extremaRes.timezone),
        height: e.height,
        coefficient: typeof e.coef === 'number' ? e.coef : null,
      });
    }
  }
  extrema.sort((a, b) => a.time.localeCompare(b.time));

  const levelsUrl = buildUrl(`${API_MAREE}/water-levels`, {
    site: nearest.site.site_id,
    from: `${from}T00:00`,
    to: `${toDate.toISOString().slice(0, 10)}T23:59`,
    step: 30,
    tz: 'UTC',
  });
  const levelsRes = await getJson<MareeLevelsResponse>(levelsUrl, {
    signal,
    timeoutMs: 15000,
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  const curve: TidePoint[] = (levelsRes.data ?? []).map((d) => ({
    time: new Date(d.time).toISOString(),
    height: d.height,
  }));

  const fetchedAt = new Date().toISOString();
  return {
    available: extrema.length > 0,
    unavailableReason: extrema.length === 0 ? 'Aucun extrême renvoyé pour ce site.' : undefined,
    kind: 'harmonic',
    sourceLabel: 'api-maree.fr — atlas harmonique Ifremer / PREVIMER (CC BY)',
    sourceUrl: 'https://api-maree.fr/documentation',
    portName: nearest.site.site_name,
    portDistanceKm: nearest.distanceKm,
    extrema,
    curve,
    coefficientNow: coefficientAt(extrema, fetchedAt),
    nowHeight: interpolateCurve(curve, fetchedAt),
    nowTime: fetchedAt,
    trend: trendFrom(curve, fetchedAt),
    datum: 'Zéro hydrographique local (ZH)',
    caveat:
      'Hauteurs au-dessus du zéro hydrographique du port de référence. Coefficients non officiels, impropres à la navigation.',
    updatedAt: null,
    fetchedAt,
  };
}

// ---------------------------------------------------------------------------
// B. Open-Meteo Marine — niveau marin (dérivation)
// ---------------------------------------------------------------------------

interface LevelPoint {
  time: string;
  height: number;
}

/** Extrema locaux d'une série de niveaux. */
export function extractExtrema(series: LevelPoint[]): TideExtremum[] {
  const out: TideExtremum[] = [];
  for (let i = 1; i < series.length - 1; i += 1) {
    const prev = series[i - 1].height;
    const cur = series[i].height;
    const next = series[i + 1].height;
    if (cur > prev && cur >= next) {
      out.push({ type: 'PM', time: series[i].time, height: cur, coefficient: null });
    } else if (cur < prev && cur <= next) {
      out.push({ type: 'BM', time: series[i].time, height: cur, coefficient: null });
    }
  }
  return out;
}

/** Affine un extremum par interpolation quadratique sur ses trois voisins. */
function refineExtremum(series: LevelPoint[], i: number): TideExtremum {
  const prev = series[i - 1];
  const cur = series[i];
  const next = series[i + 1];
  // Parabole passant par les trois points (pas horaire supposé régulier).
  const denom = prev.height - 2 * cur.height + next.height;
  const shift = denom !== 0 ? (0.5 * (prev.height - next.height)) / denom : 0;
  const t = new Date(cur.time).getTime();
  const dt = (new Date(next.time).getTime() - t) / 2;
  return {
    type: cur.height > prev.height ? 'PM' : 'BM',
    time: new Date(t + shift * dt).toISOString(),
    height: cur.height - 0.25 * denom * shift * shift,
    coefficient: null,
  };
}

export function extractExtremaRefined(series: LevelPoint[]): TideExtremum[] {
  const out: TideExtremum[] = [];
  for (let i = 1; i < series.length - 1; i += 1) {
    const prev = series[i - 1].height;
    const cur = series[i].height;
    const next = series[i + 1].height;
    if ((cur > prev && cur >= next) || (cur < prev && cur <= next)) {
      out.push(refineExtremum(series, i));
    }
  }
  return out;
}

/**
 * Coefficient de marée estimé : rapport entre le marnage observé sur le cycle
 * courant et le marnage maximal du mois, ramené sur 100.
 * ESTIMATION — affichée comme telle.
 */
export function estimateCoefficients(series: LevelPoint[]): Map<string, number> {
  const out = new Map<string, number>();
  if (series.length < 24) return out;

  // Marnage maximal de référence sur la série disponible.
  let maxRange = 0;
  for (let i = 1; i < series.length; i += 1) {
    const r = Math.abs(series[i].height - series[i - 1].height);
    if (r > maxRange) maxRange = r;
  }
  // On lisse sur 24 h environ pour capter un cycle complet.
  const window = 24;
  let refMax = 0;
  for (let i = 0; i + window < series.length; i += 1) {
    let lo = Infinity;
    let hi = -Infinity;
    for (let j = i; j < i + window; j += 1) {
      lo = Math.min(lo, series[j].height);
      hi = Math.max(hi, series[j].height);
    }
    refMax = Math.max(refMax, hi - lo);
  }
  if (refMax <= 0 || maxRange <= 0) return out;

  const extrema = extractExtremaRefined(series);
  for (const e of extrema) {
    if (e.type !== 'PM') continue;
    // Marnage autour de cette pleine mer.
    const t = new Date(e.time).getTime();
    let lo = Infinity;
    let hi = -Infinity;
    const halfDay = 12 * 3600 * 1000;
    for (const p of series) {
      const pt = new Date(p.time).getTime();
      if (Math.abs(pt - t) <= halfDay) {
        lo = Math.min(lo, p.height);
        hi = Math.max(hi, p.height);
      }
    }
    const range = hi - lo;
    if (range > 0) {
      out.set(e.time, Math.round((range / refMax) * 100));
    }
  }
  return out;
}

function interpolateCurve(curve: TidePoint[], atIso: string): number | null {
  if (curve.length === 0) return null;
  const t = new Date(atIso).getTime();
  for (let i = 1; i < curve.length; i += 1) {
    const t1 = new Date(curve[i - 1].time).getTime();
    const t2 = new Date(curve[i].time).getTime();
    if (t >= t1 && t <= t2) {
      if (t2 === t1) return curve[i].height;
      const r = (t - t1) / (t2 - t1);
      return curve[i - 1].height + (curve[i].height - curve[i - 1].height) * r;
    }
  }
  return t < new Date(curve[0].time).getTime() ? curve[0].height : curve[curve.length - 1].height;
}

function trendFrom(curve: TidePoint[], atIso: string): 'montante' | 'descendante' | null {
  if (curve.length < 2) return null;
  const h = interpolateCurve(curve, atIso);
  const t = new Date(atIso).getTime();
  const later = curve.find((p) => new Date(p.time).getTime() > t);
  if (h == null || !later) return null;
  return later.height > h ? 'montante' : 'descendante';
}

function coefficientAt(extrema: TideExtremum[], atIso: string): number | null {
  const t = new Date(atIso).getTime();
  let best: TideExtremum | null = null;
  let bestD = Infinity;
  for (const e of extrema) {
    if (e.coefficient == null) continue;
    const d = Math.abs(new Date(e.time).getTime() - t);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best?.coefficient ?? null;
}

/**
 * Construit les données de marée depuis la série `sea_level_height_msl`
 * d'Open-Meteo Marine.
 */
export function tidesFromSeaLevel(
  hourly: { time: string; seaLevelHeightMsl: number | null }[],
  fetchedAt: string,
): TideData {
  const series: LevelPoint[] = hourly
    .filter((p) => p.seaLevelHeightMsl != null)
    .map((p) => ({ time: new Date(p.time).toISOString(), height: p.seaLevelHeightMsl as number }));

  if (series.length < 6) {
    return {
      available: false,
      unavailableReason:
        'Le modèle marin ne fournit pas de niveau d’eau exploitable à cette position (point trop éloigné de la mer ou hors couverture).',
      kind: 'model',
      sourceLabel: 'Open-Meteo Marine — niveau marin',
      sourceUrl: 'https://open-meteo.com/en/docs/marine-weather-api',
      portName: null,
      portDistanceKm: null,
      extrema: [],
      curve: [],
      coefficientNow: null,
      nowHeight: null,
      nowTime: null,
      trend: null,
      datum: 'Niveau moyen mondial (MSL)',
      caveat: '',
      updatedAt: null,
      fetchedAt,
    };
  }

  const extrema = extractExtremaRefined(series);
  const coefficients = estimateCoefficients(series);
  const withCoef = extrema.map((e) => ({
    ...e,
    coefficient: e.type === 'PM' ? coefficients.get(e.time) ?? null : null,
  }));

  const nowHeight = interpolateCurve(series, fetchedAt);
  const trend = trendFrom(series, fetchedAt);

  return {
    available: true,
    kind: 'model',
    sourceLabel: 'Open-Meteo Marine — niveau marin (Copernicus Marine / Météo-France SMOC)',
    sourceUrl: 'https://open-meteo.com/en/docs/marine-weather-api',
    portName: null,
    portDistanceKm: null,
    extrema: withCoef,
    curve: series,
    coefficientNow: coefficientAt(withCoef, fetchedAt),
    nowHeight,
    nowTime: fetchedAt,
    trend,
    datum: 'Niveau moyen mondial (MSL) — hauteur astronomique + surcote',
    caveat:
      'Marée modélisée à 0,08° (≈ 8 km) de résolution. Les horaires et hauteurs sont indicatifs et ne remplacent pas l’annuaire de marée officiel du SHOM. Les coefficients sont des estimations dérivées du marnage.',
    updatedAt: null,
    fetchedAt,
  };
}

// ---------------------------------------------------------------------------
// Point d'entrée
// ---------------------------------------------------------------------------

export interface TideRequest {
  lat: number;
  lon: number;
  /** Série horaire marine déjà chargée (source B). */
  seaLevelSeries: { time: string; seaLevelHeightMsl: number | null }[];
  /** Clé api-maree.fr de l'utilisateur, si renseignée. */
  apiKey?: string | null;
  days?: number;
  signal?: AbortSignal;
}

export async function fetchTides(req: TideRequest): Promise<TideData> {
  const fetchedAt = new Date().toISOString();
  const days = req.days ?? 6;

  // Source A : api-maree.fr (clé utilisateur).
  if (req.apiKey && req.apiKey.trim().length >= 8) {
    try {
      const data = await fetchFromApiMaree(
        { lat: req.lat, lon: req.lon },
        req.apiKey.trim(),
        days,
        req.signal,
      );
      if (data && data.available) return data;
    } catch (err) {
      // On retombe silencieusement sur la source B.
      void err;
    }
  }

  // Source B : Open-Meteo Marine.
  return tidesFromSeaLevel(req.seaLevelSeries, fetchedAt);
}

export const tideSources = {
  apiMaree: {
    label: 'api-maree.fr — atlas harmonique Ifremer / PREVIMER',
    url: 'https://api-maree.fr/documentation',
    role: 'Horaires, hauteurs et coefficients de marée officiels',
    freshness: 'realtime' as const,
    freshnessLabel: 'Calculs astronomiques — 360 requêtes/h par compte gratuit',
    note: 'Clé API personnelle gratuite, conservée dans votre navigateur.',
  },
  openMeteoMarine: {
    label: 'Open-Meteo Marine — niveau marin',
    url: 'https://open-meteo.com/en/docs/marine-weather-api',
    role: 'Marée modélisée, à titre indicatif',
    freshness: 'delayed' as const,
    freshnessLabel: 'Modèle mis à jour toutes les 24 h',
    note: 'Ne remplace pas l’annuaire de marée du SHOM.',
  },
  shom: {
    label: 'SHOM — annuaire des marées',
    url: 'https://maree.shom.fr/',
    role: 'Référence officielle française (consultation)',
    freshness: 'realtime' as const,
    freshnessLabel: 'Mise à jour quotidienne',
  },
};

export { describeError };

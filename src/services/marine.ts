/**
 * Données marines — §10, §11, §13 du cahier des charges.
 *
 * Source : Open-Meteo Marine Weather API.
 *  · ouvert, sans clé API, CORS complet ;
 *  · houle (hauteur, période, direction), vague, houle secondaire, température
 *    de surface de la mer, courants ;
 *  · modèles Copernicus Marine (Météo-France MFWAM / SMOC) et DWD EWAM/GWAM.
 *
 * RAPPEL DE FIABILITÉ (§25) : la résolution marine est de 0,08° (≈ 8 km). En zone
 * côtière la précision est limitée. Ces données ne remplacent pas un bulletin
 * officiel et ne conviennent pas à la navigation.
 */

import { buildUrl, getJson } from './http';
import { describeError } from './http';
import { interpolateAt } from './weather';
import type { MarineCurrent, MarineData } from '@/types';

const MARINE = 'https://marine-api.open-meteo.com/v1/marine';

const HOURLY_VARS = [
  'wave_height',
  'wave_period',
  'wave_direction',
  'swell_wave_height',
  'swell_wave_period',
  'swell_wave_direction',
  'wind_wave_height',
  'wind_wave_period',
  'wind_wave_direction',
  'sea_surface_temperature',
  'sea_level_height_msl',
  'ocean_current_velocity',
  'ocean_current_direction',
].join(',');

interface OmMarineResponse {
  latitude: number;
  longitude: number;
  timezone: string;
  utc_offset_seconds: number;
  current?: Record<string, unknown>;
  hourly?: Record<string, unknown>;
}

export interface MarineRequest {
  lat: number;
  lon: number;
  forecastDays?: number;
  signal?: AbortSignal;
}

function mapPoint(time: string, h: Record<string, unknown>, i: number): MarineCurrent {
  const at = (k: string): number | null => {
    const v = h[k];
    // Bloc `hourly` : tableaux. Bloc `current` : valeurs scalaires.
    if (Array.isArray(v)) {
      const el = v[i];
      return typeof el === 'number' && Number.isFinite(el) ? el : null;
    }
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  };
  return {
    time,
    waveHeight: at('wave_height'),
    wavePeriod: at('wave_period'),
    waveDirection: at('wave_direction'),
    swellWaveHeight: at('swell_wave_height'),
    swellWavePeriod: at('swell_wave_period'),
    swellWaveDirection: at('swell_wave_direction'),
    windWaveHeight: at('wind_wave_height'),
    windWavePeriod: at('wind_wave_period'),
    windWaveDirection: at('wind_wave_direction'),
    seaSurfaceTemperature: at('sea_surface_temperature'),
    seaLevelHeightMsl: at('sea_level_height_msl'),
    oceanCurrentVelocity: at('ocean_current_velocity'),
    oceanCurrentDirection: at('ocean_current_direction'),
  };
}

/** Extrait la série d'horodatages d'une réponse Open-Meteo. */
function timeSeries(h: Record<string, unknown>): string[] {
  const arr = h.time;
  if (!Array.isArray(arr)) return [];
  return arr.filter((t): t is string => typeof t === 'string');
}

export async function fetchMarine(req: MarineRequest): Promise<MarineData> {
  const url = buildUrl(MARINE, {
    latitude: req.lat,
    longitude: req.lon,
    hourly: HOURLY_VARS,
    current: HOURLY_VARS,
    timezone: 'auto',
    forecast_days: req.forecastDays ?? 6,
    cell_selection: 'nearest',
    length_unit: 'metric',
  });

  const fetchedAt = new Date().toISOString();

  try {
    const data = await getJson<OmMarineResponse>(url, { signal: req.signal, timeoutMs: 20000 });

    const h = data.hourly ?? {};
    const times = timeSeries(h);
    const hourly = times.map((t, i) => mapPoint(t, h, i));

    const c = data.current ?? {};
    const nowIso = typeof c.time === 'string' ? c.time : new Date().toISOString();
    const current = mapPoint(nowIso, c, 0);
    // Certaines variables manquent dans `current` : on complète par interpolation
    // sur la série horaire.
    current.wavePeriod = current.wavePeriod ?? interpolateAt(hourly, (p) => p.wavePeriod, nowIso);
    current.seaSurfaceTemperature =
      current.seaSurfaceTemperature ??
      interpolateAt(hourly, (p) => p.seaSurfaceTemperature, nowIso);
    current.seaLevelHeightMsl =
      current.seaLevelHeightMsl ?? interpolateAt(hourly, (p) => p.seaLevelHeightMsl, nowIso);

    return {
      current,
      hourly,
      updatedAt: null,
      fetchedAt,
      available: true,
    };
  } catch (err) {
    return {
      current: emptyMarinePoint(new Date().toISOString()),
      hourly: [],
      updatedAt: null,
      fetchedAt,
      available: false,
      unavailableReason: describeError(err),
    };
  }
}

export function emptyMarinePoint(time: string): MarineCurrent {
  return {
    time,
    waveHeight: null,
    wavePeriod: null,
    waveDirection: null,
    swellWaveHeight: null,
    swellWavePeriod: null,
    swellWaveDirection: null,
    windWaveHeight: null,
    windWavePeriod: null,
    windWaveDirection: null,
    seaSurfaceTemperature: null,
    seaLevelHeightMsl: null,
    oceanCurrentVelocity: null,
    oceanCurrentDirection: null,
  };
}

/**
 * Une maille marine renvoie-elle des données exploitables pour ce point ?
 * Sert d'indicateur de proximité maritime (§5).
 */
export function hasMarineGridSignal(data: MarineData | null): boolean {
  if (!data || !data.available) return false;
  const c = data.current;
  return (
    c.seaSurfaceTemperature != null ||
    c.waveHeight != null ||
    c.seaLevelHeightMsl != null
  );
}

/**
 * Sonde légère de la grille marine : une seule variable, une seule heure.
 * Utilisée par la détection du milieu pour savoir si le point tombe dans une
 * maille océanique du modèle (≈ 8 km de résolution), indépendamment du fait
 * que le module maritime soit affiché ou non.
 */
export async function probeMarineGrid(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<boolean> {
  const url = buildUrl(MARINE, {
    latitude: lat,
    longitude: lon,
    current: 'sea_surface_temperature',
    timezone: 'UTC',
    forecast_days: 1,
    cell_selection: 'nearest',
    length_unit: 'metric',
  });
  try {
    const data = await getJson<OmMarineResponse>(url, { signal, timeoutMs: 12000, retries: 0 });
    const c = data.current ?? {};
    return typeof c.sea_surface_temperature === 'number' && Number.isFinite(c.sea_surface_temperature);
  } catch {
    return false;
  }
}

export const marineSource = {
  label: 'Open-Meteo — Marine Weather API',
  url: 'https://open-meteo.com/en/docs/marine-weather-api',
  role: 'Houle, vagues, température de l’eau, courants, niveau marin',
  freshness: 'delayed' as const,
  freshnessLabel: 'Modèles mis à jour toutes les 6 à 24 h',
  note: 'Copernicus Marine (Météo-France MFWAM / SMOC, 0,08° ≈ 8 km) et DWD EWAM/GWAM. Précision limitée à proximité immédiate des côtes.',
};

export { describeError };

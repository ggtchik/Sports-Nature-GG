/**
 * Météo — §7, §8 du cahier des charges.
 *
 * Source : Open-Meteo Weather Forecast API.
 *  · ouvert, sans clé API, CORS complet (Access-Control-Allow-Origin: *) ;
 *  · agrège Météo-France (AROME/ARPEGE), DWD ICON, ECMWF IFS, NOAA GFS… ;
 *  · sélection automatique du modèle le plus fin pour le point demandé.
 *
 * Toutes les valeurs sont conservées dans leur unité source (°C, km/h, hPa, %).
 */

import { buildUrl, getJson, HttpError } from './http';
import { describeError } from './http';
import type { DailyPoint, HourlyPoint, WeatherCurrent, WeatherData } from '@/types';

const FORECAST = 'https://api.open-meteo.com/v1/forecast';

const CURRENT_VARS = [
  'temperature_2m',
  'relative_humidity_2m',
  'apparent_temperature',
  'is_day',
  'precipitation',
  'rain',
  'weather_code',
  'cloud_cover',
  'pressure_msl',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
].join(',');

const HOURLY_VARS = [
  'temperature_2m',
  'apparent_temperature',
  'precipitation_probability',
  'precipitation',
  'cloud_cover',
  'pressure_msl',
  'wind_speed_10m',
  'wind_gusts_10m',
  'wind_direction_10m',
  'uv_index',
  'is_day',
].join(',');

const DAILY_VARS = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'apparent_temperature_max',
  'apparent_temperature_min',
  'sunrise',
  'sunset',
  'daylight_duration',
  'uv_index_max',
  'precipitation_sum',
  'precipitation_probability_max',
  'wind_speed_10m_max',
  'wind_gusts_10m_max',
  'wind_direction_10m_dominant',
  'moon_phase',
].join(',');

interface OmResponse {
  latitude: number;
  longitude: number;
  elevation?: number;
  timezone: string;
  timezone_abbreviation?: string;
  utc_offset_seconds: number;
  current?: Record<string, number | string | null>;
  current_units?: Record<string, string>;
  hourly?: Record<string, (number | string | null)[]>;
  hourly_units?: Record<string, string>;
  daily?: Record<string, (number | string | null)[]>;
  daily_units?: Record<string, string>;
}

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;
const str = (v: unknown): string | null =>
  typeof v === 'string' && v.length > 0 ? v : null;

export interface WeatherRequest {
  lat: number;
  lon: number;
  /** Nombre de jours de prévisions (max 16). */
  forecastDays?: number;
  signal?: AbortSignal;
}

export async function fetchWeather(req: WeatherRequest): Promise<WeatherData> {
  const url = buildUrl(FORECAST, {
    latitude: req.lat,
    longitude: req.lon,
    current: CURRENT_VARS,
    hourly: HOURLY_VARS,
    daily: DAILY_VARS,
    timezone: 'auto',
    forecast_days: req.forecastDays ?? 6,
    past_days: 1,
    wind_speed_unit: 'kmh',
    temperature_unit: 'celsius',
    precipitation_unit: 'mm',
  });

  const data = await getJson<OmResponse>(url, { signal: req.signal, timeoutMs: 20000 });

  const c = data.current ?? {};
  const current: WeatherCurrent = {
    time: str(c.time) ?? new Date().toISOString(),
    temperature: num(c.temperature_2m),
    apparentTemperature: num(c.apparent_temperature),
    humidity: num(c.relative_humidity_2m),
    precipitation: num(c.precipitation),
    rain: num(c.rain),
    weatherCode: num(c.weather_code),
    cloudCover: num(c.cloud_cover),
    pressureMsl: num(c.pressure_msl),
    windSpeed: num(c.wind_speed_10m),
    windGusts: num(c.wind_gusts_10m),
    windDirection: num(c.wind_direction_10m),
    uvIndex: null, // rempli depuis la série horaire
    isDay: typeof c.is_day === 'number' ? c.is_day === 1 : null,
  };

  const h = data.hourly ?? {};
  const hTime = (h.time ?? []) as string[];
  const hourly: HourlyPoint[] = hTime.map((t, i) => ({
    time: t,
    temperature: num(h.temperature_2m?.[i]),
    apparentTemperature: num(h.apparent_temperature?.[i]),
    precipitationProbability: num(h.precipitation_probability?.[i]),
    precipitation: num(h.precipitation?.[i]),
    cloudCover: num(h.cloud_cover?.[i]),
    pressureMsl: num(h.pressure_msl?.[i]),
    windSpeed: num(h.wind_speed_10m?.[i]),
    windGusts: num(h.wind_gusts_10m?.[i]),
    windDirection: num(h.wind_direction_10m?.[i]),
    uvIndex: num(h.uv_index?.[i]),
    isDay: typeof h.is_day?.[i] === 'number' ? (h.is_day as number[])[i] === 1 : null,
  }));

  // UV « courant » : interpolation linéaire sur la série horaire.
  current.uvIndex = interpolateAt(hourly, (p) => p.uvIndex, current.time);

  const d = data.daily ?? {};
  const dTime = (d.time ?? []) as string[];
  const daily: DailyPoint[] = dTime.map((t, i) => ({
    date: t,
    weatherCode: num(d.weather_code?.[i]),
    temperatureMax: num(d.temperature_2m_max?.[i]),
    temperatureMin: num(d.temperature_2m_min?.[i]),
    apparentTemperatureMax: num(d.apparent_temperature_max?.[i]),
    apparentTemperatureMin: num(d.apparent_temperature_min?.[i]),
    sunrise: str(d.sunrise?.[i]),
    sunset: str(d.sunset?.[i]),
    daylightDuration: num(d.daylight_duration?.[i]),
    uvIndexMax: num(d.uv_index_max?.[i]),
    precipitationSum: num(d.precipitation_sum?.[i]),
    precipitationProbabilityMax: num(d.precipitation_probability_max?.[i]),
    windSpeedMax: num(d.wind_speed_10m_max?.[i]),
    windGustsMax: num(d.wind_gusts_10m_max?.[i]),
    windDirectionDominant: num(d.wind_direction_10m_dominant?.[i]),
    moonPhase: num(d.moon_phase?.[i]),
  }));

  return {
    current,
    hourly,
    daily,
    timezone: data.timezone,
    utcOffsetSeconds: data.utc_offset_seconds ?? 0,
    model: 'Open-Meteo Best Match (Météo-France AROME/ARPEGE, DWD ICON, ECMWF IFS, NOAA GFS…)',
    updatedAt: null, // Open-Meteo n'expose pas d'horodatage de run dans le payload standard
    fetchedAt: new Date().toISOString(),
    elevation: num(data.elevation),
  };
}

/** Interpolation linéaire d'une série horaire à un instant donné. */
export function interpolateAt<T extends { time: string }>(
  series: T[],
  pick: (p: T) => number | null,
  at: string,
): number | null {
  if (series.length === 0) return null;
  const t = new Date(at).getTime();
  if (Number.isNaN(t)) return null;
  let prev: T | null = null;
  for (const point of series) {
    const pt = new Date(point.time).getTime();
    if (Number.isNaN(pt)) continue;
    if (pt === t) return pick(point);
    if (pt < t) prev = point;
    else {
      if (!prev) return pick(point);
      const next = point;
      const a = pick(prev);
      const b = pick(next);
      if (a == null || b == null) return a ?? b;
      const ratio = (t - new Date(prev.time).getTime()) / (pt - new Date(prev.time).getTime());
      return a + (b - a) * ratio;
    }
  }
  return prev ? pick(prev) : null;
}

// ---------------------------------------------------------------------------
// Codes météo (WMO) — libellés et icônes
// ---------------------------------------------------------------------------

export interface WeatherCodeInfo {
  label: string;
  /** Groupe pour le style. */
  group: 'clear' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm';
  icon: string;
}

const CODES: Record<number, WeatherCodeInfo> = {
  0: { label: 'Ciel dégagé', group: 'clear', icon: '☀️' },
  1: { label: 'Principalement dégagé', group: 'clear', icon: '🌤️' },
  2: { label: 'Partiellement nuageux', group: 'cloudy', icon: '⛅' },
  3: { label: 'Couvert', group: 'cloudy', icon: '☁️' },
  45: { label: 'Brouillard', group: 'fog', icon: '🌫️' },
  48: { label: 'Brouillard givrant', group: 'fog', icon: '🌫️' },
  51: { label: 'Bruine légère', group: 'rain', icon: '🌦️' },
  53: { label: 'Bruine modérée', group: 'rain', icon: '🌦️' },
  55: { label: 'Bruine dense', group: 'rain', icon: '🌧️' },
  56: { label: 'Bruine verglaçante', group: 'rain', icon: '🌧️' },
  57: { label: 'Bruine verglaçante dense', group: 'rain', icon: '🌧️' },
  61: { label: 'Pluie faible', group: 'rain', icon: '🌦️' },
  63: { label: 'Pluie modérée', group: 'rain', icon: '🌧️' },
  65: { label: 'Pluie forte', group: 'rain', icon: '🌧️' },
  66: { label: 'Pluie verglaçante', group: 'rain', icon: '🌧️' },
  67: { label: 'Pluie verglaçante forte', group: 'rain', icon: '🌧️' },
  71: { label: 'Neige faible', group: 'snow', icon: '🌨️' },
  73: { label: 'Neige modérée', group: 'snow', icon: '🌨️' },
  75: { label: 'Neige forte', group: 'snow', icon: '❄️' },
  77: { label: 'Grains de neige', group: 'snow', icon: '🌨️' },
  80: { label: 'Averses faibles', group: 'rain', icon: '🌦️' },
  81: { label: 'Averses modérées', group: 'rain', icon: '🌧️' },
  82: { label: 'Averses violentes', group: 'rain', icon: '⛈️' },
  85: { label: 'Averses de neige', group: 'snow', icon: '🌨️' },
  86: { label: 'Averses de neige fortes', group: 'snow', icon: '❄️' },
  95: { label: 'Orage', group: 'storm', icon: '⛈️' },
  96: { label: 'Orage avec grêle', group: 'storm', icon: '⛈️' },
  99: { label: 'Orage avec grêle forte', group: 'storm', icon: '⛈️' },
};

export function weatherCodeInfo(code: number | null): WeatherCodeInfo {
  if (code == null) return { label: 'Inconnu', group: 'cloudy', icon: '—' };
  return CODES[code] ?? { label: `Code ${code}`, group: 'cloudy', icon: '—' };
}

// ---------------------------------------------------------------------------
// Ressources exposées
// ---------------------------------------------------------------------------

export const weatherSource = {
  label: 'Open-Meteo — Weather Forecast API',
  url: 'https://open-meteo.com/en/docs',
  role: 'Météo, vent, rafales, UV, pression, prévisions 5 jours',
  freshness: 'realtime' as const,
  freshnessLabel: 'Temps réel — modèles mis à jour toutes les 1 à 6 h',
  note: 'Agrège Météo-France AROME/ARPEGE (1,5 km), DWD ICON, ECMWF IFS et NOAA GFS. Gratuit, sans clé, pour un usage non commercial.',
};

export { describeError, HttpError };

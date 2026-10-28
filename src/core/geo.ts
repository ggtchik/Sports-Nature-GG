/**
 * Calculs géographiques : distances, caps, projection, découpes spatiales.
 */

import type { LatLng } from '@/types';

const EARTH_RADIUS_KM = 6371.0088;
const DEG = Math.PI / 180;

/** Distance orthodromique (haversine) en kilomètres. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = (b.lat - a.lat) * DEG;
  const dLon = (b.lon - a.lon) * DEG;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * DEG) * Math.cos(b.lat * DEG) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Cap initial de a vers b, en degrés (0 = nord, 90 = est). */
export function bearingDeg(a: LatLng, b: LatLng): number {
  const φ1 = a.lat * DEG;
  const φ2 = b.lat * DEG;
  const Δλ = (b.lon - a.lon) * DEG;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) / DEG + 360) % 360;
}

export function compassPoint(deg: number): string {
  const points = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
  return points[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
}

/** Libellé francophone d'une direction de vent / houle. */
export function directionLabel(deg: number): string {
  const points = [
    'nord', 'nord-nord-est', 'nord-est', 'est-nord-est',
    'est', 'est-sud-est', 'sud-est', 'sud-sud-est',
    'sud', 'sud-sud-ouest', 'sud-ouest', 'ouest-sud-ouest',
    'ouest', 'ouest-nord-ouest', 'nord-ouest', 'nord-nord-ouest',
  ];
  return points[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
}

/** Coordonnées valides ? */
export function isValidLatLng(value: unknown): value is LatLng {
  if (!value || typeof value !== 'object') return false;
  const { lat, lon } = value as Record<string, unknown>;
  return (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180
  );
}

// ---------------------------------------------------------------------------
// Projection Web Mercator (identique à celle des cartes Leaflet/OSM)
// ---------------------------------------------------------------------------

const R = 6378137;

export function project(p: LatLng): { x: number; y: number } {
  return {
    x: R * p.lon * DEG,
    y: R * Math.log(Math.tan(Math.PI / 4 + (p.lat * DEG) / 2)),
  };
}

export function unproject(x: number, y: number): LatLng {
  return {
    lon: x / R / DEG,
    lat: (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) / DEG,
  };
}

// ---------------------------------------------------------------------------
// Distance point → segment
// ---------------------------------------------------------------------------

/** Distance (km) d'un point au segment [a, b], calculée en projection Web Mercator. */
export function distanceToSegmentKm(p: LatLng, a: LatLng, b: LatLng): number {
  const P = project(p);
  const A = project(a);
  const B = project(b);
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const len2 = dx * dx + dy * dy;
  let t = 0;
  if (len2 > 0) t = Math.max(0, Math.min(1, ((P.x - A.x) * dx + (P.y - A.y) * dy) / len2));
  const cx = A.x + t * dx;
  const cy = A.y + t * dy;
  const d = Math.hypot(P.x - cx, P.y - cy);
  return d / 1000;
}

/** Distance minimale (km) d'un point à une polyligne. */
export function distanceToPolylineKm(p: LatLng, line: LatLng[]): number {
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i += 1) {
    const d = distanceToSegmentKm(p, line[i], line[i + 1]);
    if (d < best) best = d;
  }
  return best;
}

/** Distance minimale (km) d'un point à un ensemble de polylignes. */
export function distanceToLinesKm(p: LatLng, lines: LatLng[][]): number {
  let best = Infinity;
  for (const line of lines) {
    if (line.length < 2) continue;
    const d = distanceToPolylineKm(p, line);
    if (d < best) best = d;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Boîtes englobantes
// ---------------------------------------------------------------------------

export interface BBox {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
}

export function bboxAround(center: LatLng, radiusKm: number): BBox {
  const dLat = radiusKm / 111.32;
  const dLon = radiusKm / (111.32 * Math.max(0.01, Math.cos(center.lat * DEG)));
  return {
    minLat: Math.max(-90, center.lat - dLat),
    maxLat: Math.min(90, center.lat + dLat),
    minLon: Math.max(-180, center.lon - dLon),
    maxLon: Math.min(180, center.lon + dLon),
  };
}

export function bboxString(b: BBox): string {
  return `${b.minLon.toFixed(6)},${b.minLat.toFixed(6)},${b.maxLon.toFixed(6)},${b.maxLat.toFixed(6)}`;
}

// ---------------------------------------------------------------------------
// Estimation de trajet
// ---------------------------------------------------------------------------

export interface TripEstimate {
  distanceKm: number;
  /** Vitesse moyenne retenue (km/h), forfaitaire. */
  averageSpeedKmh: number;
  durationMinutes: number;
}

/**
 * Durée de trajet estimée à vol d'oiseau majorée d'un coefficient de routing
 * (1,25) — faute de service de calcul d'itinéraire gratuit et sans clé.
 * Le caractère estimatif est toujours affiché à l'écran.
 */
export function estimateTrip(distanceKm: number): TripEstimate {
  const ROAD_FACTOR = 1.25;
  const AVERAGE_SPEED = 70;
  const roadKm = distanceKm * ROAD_FACTOR;
  return {
    distanceKm: roadKm,
    averageSpeedKmh: AVERAGE_SPEED,
    durationMinutes: Math.round((roadKm / AVERAGE_SPEED) * 60),
  };
}

export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  return `${h} h ${String(m).padStart(2, '0')}`;
}

/** Formatage d'une coordonnée GPS en degrés minutes. */
export function formatCoords(p: LatLng): string {
  const lat = `${Math.abs(p.lat).toFixed(5)}° ${p.lat >= 0 ? 'N' : 'S'}`;
  const lon = `${Math.abs(p.lon).toFixed(5)}° ${p.lon >= 0 ? 'E' : 'O'}`;
  return `${lat} · ${lon}`;
}

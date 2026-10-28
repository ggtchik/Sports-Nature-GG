/**
 * Géocodage — §3 (position de départ) et §4 (recherche de spot).
 *
 * Sources, par ordre de préférence :
 *  1. API de géocodage de la Géoplateforme (IGN / BAN) — ouverte, sans clé, CORS.
 *     https://data.geopf.fr/geocodage
 *  2. API Adresse (data.gouv.fr) — même moteur, secours historique.
 *     https://api-adresse.data.gouv.fr
 *  3. Nominatim (OpenStreetMap) — secours mondial.
 *
 * Aucune de ces trois sources n'exige de clé API.
 */

import { buildUrl, getJson } from './http';
import { describeError } from './http';
import type { LatLng, Place, PlaceKind } from '@/types';

const GEOPLATFORME = 'https://data.geopf.fr/geocodage';
const API_ADRESSE = 'https://api-adresse.data.gouv.fr';
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

interface GeocodageFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    label?: string;
    name?: string;
    city?: string;
    citycode?: string;
    postcode?: string;
    context?: string;
    score?: number;
    type?: string;
    kind?: string;
  };
}

interface GeocodageResponse {
  features: GeocodageFeature[];
}

function classify(props: GeocodageFeature['properties']): PlaceKind {
  const t = props.type ?? props.kind ?? '';
  if (t === 'housenumber' || t === 'street' || t === 'locality') return 'adresse';
  if (t === 'municipality') return 'commune';
  return 'lieu';
}

function mapFeature(f: GeocodageFeature, source: string): Place | null {
  const [lon, lat] = f.geometry?.coordinates ?? [];
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const label = f.properties?.label ?? f.properties?.name ?? 'Lieu sans nom';
  const postcode = f.properties?.postcode;
  const city = f.properties?.city;
  const place: Place = {
    id: `${source}:${lat.toFixed(6)}:${lon.toFixed(6)}:${label}`,
    label,
    kind: classify(f.properties),
    lat,
    lon,
    source,
  };
  if (city !== undefined) place.city = city;
  if (postcode !== undefined) place.postcode = postcode;
  if (typeof f.properties?.score === 'number') place.score = f.properties.score;
  return place;
}

async function tryGeocodage(
  base: string,
  q: string,
  limit: number,
  signal?: AbortSignal,
): Promise<Place[]> {
  const url = buildUrl(`${base}/search`, { q, limit, autocomplete: 1 });
  const data = await getJson<GeocodageResponse>(url, { signal, timeoutMs: 12000 });
  return (data.features ?? [])
    .map((f) => mapFeature(f, base === GEOPLATFORME ? 'Géoplateforme (IGN / BAN)' : 'API Adresse (data.gouv.fr)'))
    .filter((p): p is Place => p !== null);
}

async function tryNominatim(q: string, limit: number, signal?: AbortSignal): Promise<Place[]> {
  const url = buildUrl(NOMINATIM, {
    q,
    format: 'jsonv2',
    limit,
    addressdetails: 1,
    'accept-language': 'fr',
  });
  const data = await getJson<Record<string, unknown>[]>(url, { signal, timeoutMs: 12000 });
  const out: Place[] = [];
  for (const raw of Array.isArray(data) ? data : []) {
    const r = raw as Record<string, unknown>;
    const lat = Number(r.lat);
    const lon = Number(r.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const addr = (r.address ?? {}) as Record<string, string>;
    const place: Place = {
      id: `nominatim:${lat.toFixed(6)}:${lon.toFixed(6)}:${String(r.display_name).slice(0, 40)}`,
      label: String(r.display_name ?? 'Lieu'),
      kind: r.type === 'administrative' ? 'commune' : 'lieu',
      lat,
      lon,
      source: 'Nominatim (OpenStreetMap)',
    };
    const city = addr.city || addr.town || addr.village || addr.municipality;
    if (city) place.city = city;
    if (addr.postcode) place.postcode = addr.postcode;
    out.push(place);
  }
  return out;
}

/** Recherche d'un lieu libre (adresse, commune, code postal, nom de spot). */
export async function searchPlaces(
  query: string,
  { limit = 8, signal }: { limit?: number; signal?: AbortSignal } = {},
): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const chain: (() => Promise<Place[]>)[] = [
    () => tryGeocodage(GEOPLATFORME, q, limit, signal),
    () => tryGeocodage(API_ADRESSE, q, limit, signal),
    () => tryNominatim(q, limit, signal),
  ];

  let lastError: unknown = null;
  for (const attempt of chain) {
    try {
      const results = await attempt();
      if (results.length > 0) return results;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new Error('Aucun résultat pour cette recherche.');
}

/** Coordonnées → lieu le plus proche (utilisé après géolocalisation). */
export async function reverseGeocode(
  coords: LatLng,
  signal?: AbortSignal,
): Promise<Place | null> {
  const sources: { base: string; label: string }[] = [
    { base: GEOPLATFORME, label: 'Géoplateforme (IGN / BAN)' },
    { base: API_ADRESSE, label: 'API Adresse (data.gouv.fr)' },
  ];

  for (const { base, label } of sources) {
    try {
      const url = buildUrl(`${base}/reverse`, {
        lat: coords.lat,
        lon: coords.lon,
        limit: 1,
      });
      const data = await getJson<GeocodageResponse>(url, { signal, timeoutMs: 12000 });
      const f = data.features?.[0];
      if (f) {
        const place = mapFeature(f, label);
        if (place) return place;
      }
    } catch {
      /* on tente la source suivante */
    }
  }

  // Repli : coordonnées brutes.
  return {
    id: `coords:${coords.lat.toFixed(5)}:${coords.lon.toFixed(5)}`,
    label: `Position ${coords.lat.toFixed(5)}°, ${coords.lon.toFixed(5)}°`,
    kind: 'coordonnees',
    lat: coords.lat,
    lon: coords.lon,
    source: 'Terminal (GPS)',
  };
}

/**
 * Interprétation d'une saisie manuelle de coordonnées GPS.
 *
 * Formats acceptés :
 *   43.2951, 5.3727          degrés décimaux, virgule séparateur
 *   43.2951 5.3727           degrés décimaux, espace séparateur
 *   43.2951; 5.3727          point-virgule séparateur
 *   43,2951 -5,3727          virgule décimale (écriture française)
 *   43,2951,-5,3727          idem, virgule séparatrice ET décimale
 *   43°17'42"N 5°22'21"E     degrés / minutes / secondes
 */
export function parseCoords(input: string): LatLng | null {
  const raw = input.trim();
  if (!raw) return null;

  // --- Degrés minutes secondes -------------------------------------------
  const dms = raw.match(
    /(\d{1,3})[°:\s]+(\d{1,2})['′:\s]+(\d{1,2}(?:\.\d+)?)["″]?\s*([NSEOnso])?[,\s]+(\d{1,3})[°:\s]+(\d{1,2})['′:\s]+(\d{1,2}(?:\.\d+)?)["″]?\s*([NSEOWoe])?/i,
  );
  if (dms) {
    const lat = Number(dms[1]) + Number(dms[2]) / 60 + Number(dms[3]) / 3600;
    const lon = Number(dms[5]) + Number(dms[6]) / 60 + Number(dms[7]) / 3600;
    const ns = (dms[4] ?? 'N').toUpperCase();
    const ew = (dms[8] ?? 'E').toUpperCase();
    return {
      lat: ns === 'S' ? -lat : lat,
      lon: ew === 'W' || ew === 'O' ? -lon : lon,
    };
  }

  // --- Degrés décimaux ---------------------------------------------------
  const cleaned = raw.replace(/;/g, ' ').trim();
  let parts: string[];

  if (cleaned.includes(',')) {
    const byComma = cleaned.split(',');
    if (byComma.length === 2) {
      // « 44.65, -1.16 » — la virgule sépare les deux nombres.
      parts = byComma.map((s) => s.trim()).filter(Boolean);
    } else if (byComma.length === 4) {
      // « 44,65,-1,16 » — les virgules sont des séparateurs décimaux.
      parts = [`${byComma[0].trim()}.${byComma[1].trim()}`, `${byComma[2].trim()}.${byComma[3].trim()}`];
    } else {
      // « 44,65 -1,16 » — virgules décimales, espace séparateur.
      parts = cleaned.replace(/,/g, '.').split(/\s+/).filter(Boolean);
    }
  } else {
    parts = cleaned.split(/\s+/).filter(Boolean);
  }

  if (parts.length < 2) return null;
  const a = Number(parts[0].replace(',', '.'));
  const b = Number(parts[1].replace(',', '.'));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (Math.abs(a) > 90 || Math.abs(b) > 180) return null;
  return { lat: a, lon: b };
}

/** Raccourci : transforme une saisie en place, en devinant son type. */
export function placeFromCoords(coords: LatLng): Place {
  return {
    id: `coords:${coords.lat.toFixed(5)}:${coords.lon.toFixed(5)}`,
    label: `Coordonnées ${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)}`,
    kind: 'coordonnees',
    lat: coords.lat,
    lon: coords.lon,
    source: 'Saisie manuelle',
  };
}

export const geocodingSources = {
  geoplateforme: {
    label: 'Géoplateforme — API de géocodage (IGN / BAN)',
    url: 'https://cartes.gouv.fr/aide/fr/guides-utilisateur/utiliser-les-services-de-la-geoplateforme/geocodage/',
    role: 'Adresse, commune, code postal → coordonnées (et inverse)',
  },
  apiAdresse: {
    label: 'API Adresse (Base Adresse Nationale)',
    url: 'https://adresse.data.gouv.fr/outils/api-doc/adresse',
    role: 'Adresse, commune, code postal → coordonnées (et inverse)',
  },
  nominatim: {
    label: 'Nominatim (OpenStreetMap)',
    url: 'https://nominatim.openstreetmap.org/',
    role: 'Géocodage mondial de secours',
  },
};

export { describeError };

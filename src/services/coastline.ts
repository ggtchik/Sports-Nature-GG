/**
 * Détection du milieu — §5 du cahier des charges.
 *
 * Mode AUTO : un spot à moins de 5 km d'une zone maritime est « potentiellement
 * maritime ». Au-delà, le contexte est continental / eau douce.
 *
 * Deux signaux, du plus précis au plus grossier :
 *
 *  1. **OpenStreetMap (Overpass API)** — tracé de la laisse de haute mer dans un
 *     rayon de 12 km. Précision décamétrique. Gratuit, sans clé, CORS.
 *     Service contributif : en cas d'échec on passe au signal suivant.
 *
 *  2. **Natural Earth 110 m** (land-110m.json embarqué) — polygones des terres
 *     émergées. Précision de l'ordre de quelques kilomètres sur les côtes
 *     découpées, jusqu'à plusieurs dizaines de kilomètres sur les côtes lisses
 *     (baies, estuaires). Toujours disponible, y compris hors ligne.
 *
 * Un troisième signal, gratuit puisqu'il réutilise la réponse Marine déjà
 * chargée, confirme l'appartenance à une maille marine du modèle (≈ 8 km).
 */

import { distanceToLinesKm } from '@/core/geo';
import type { LatLng } from '@/types';
import { buildUrl, getJson } from './http';

export const COAST_THRESHOLD_KM = 5;

// ---------------------------------------------------------------------------
// Natural Earth 110 m — décodage TopoJSON
// ---------------------------------------------------------------------------

interface Topology {
  arcs: number[][][];
  transform?: { scale: [number, number]; translate: [number, number] };
  objects: Record<
    string,
    { geometries: { type: string; arcs: number[][][] | number[][][][] }[] }
  >;
}

let cachedLines: LatLng[][] | null = null;
let loading: Promise<LatLng[][]> | null = null;

function decodeArc(arc: number[][], transform?: Topology['transform']): LatLng[] {
  let x = 0;
  let y = 0;
  return arc.map(([dx, dy]) => {
    x += dx;
    y += dy;
    if (!transform) return { lon: x, lat: y };
    return {
      lon: x * transform.scale[0] + transform.translate[0],
      lat: y * transform.scale[1] + transform.translate[1],
    };
  });
}

function ringToPoints(arcIndices: number[], topology: Topology): LatLng[] {
  const out: LatLng[] = [];
  for (const idx of arcIndices) {
    const real = idx < 0 ? ~idx : idx;
    const arc = decodeArc(topology.arcs[real], topology.transform);
    const pts = idx < 0 ? arc.slice().reverse() : arc;
    // Évite de dupliquer le point de jonction.
    out.push(...(out.length === 0 ? pts : pts.slice(1)));
  }
  return out;
}

async function loadNaturalEarthLines(): Promise<LatLng[][]> {
  if (cachedLines) return cachedLines;
  if (loading) return loading;

  loading = fetch(`${import.meta.env.BASE_URL}data/land-110m.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`land-110m.json : ${r.status}`);
      return r.json() as Promise<Topology>;
    })
    .then((topology) => {
      const lines: LatLng[][] = [];
      const objects = topology.objects ?? {};
      for (const key of Object.keys(objects)) {
        for (const geom of objects[key].geometries ?? []) {
          if (geom.type === 'Polygon') {
            for (const ring of geom.arcs as number[][][]) {
              lines.push(ringToPoints(ring[0] as unknown as number[], topology));
            }
          } else if (geom.type === 'MultiPolygon') {
            for (const poly of geom.arcs as number[][][][]) {
              for (const ring of poly) {
                lines.push(ringToPoints(ring as unknown as number[], topology));
              }
            }
          }
        }
      }
      cachedLines = lines;
      return lines;
    })
    .catch(() => []);

  return loading;
}

/** Distance au trait de côte d'après Natural Earth 110 m (approximative). */
export async function naturalEarthCoastDistanceKm(p: LatLng): Promise<number | null> {
  const lines = await loadNaturalEarthLines();
  if (lines.length === 0) return null;
  return distanceToLinesKm(p, lines);
}

// ---------------------------------------------------------------------------
// OpenStreetMap — laisse de haute mer
// ---------------------------------------------------------------------------

interface OverpassResponse {
  elements: {
    type: string;
    geometry?: { lat: number; lon: number }[];
  }[];
}

/** Distance à la côte d'après OSM, ou null si le service est indisponible. */
export async function osmCoastDistanceKm(
  p: LatLng,
  radiusM = 12000,
  signal?: AbortSignal,
): Promise<number | null> {
  const query = `[out:json][timeout:12];
way["natural"="coastline"](around:${radiusM},${p.lat},${p.lon});
out geom;`;

  const url = buildUrl('https://overpass-api.de/api/interpreter', { data: query });

  const data = await getJson<OverpassResponse>(url, {
    signal,
    timeoutMs: 14000,
    retries: 0,
  });

  const lines = (data.elements ?? [])
    .filter((e) => Array.isArray(e.geometry) && (e.geometry?.length ?? 0) > 1)
    .map((e) => (e.geometry ?? []).map((g) => ({ lat: g.lat, lon: g.lon })));

  if (lines.length === 0) {
    // Aucun trait de côte dans le rayon : la côte est au-delà de `radiusM`.
    return radiusM / 1000 + 0.001;
  }
  return distanceToLinesKm(p, lines);
}

/** Test d'appartenance à un polygone (ray casting), pour repérer un point en mer. */
export function isInsideRings(p: LatLng, rings: LatLng[][]): boolean {
  for (const ring of rings) {
    if (ring.length < 3) continue;
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const xi = ring[i].lon;
      const yi = ring[i].lat;
      const xj = ring[j].lon;
      const yj = ring[j].lat;
      const intersects =
        yi > p.lat !== yj > p.lat &&
        p.lon < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi;
      if (intersects) inside = !inside;
    }
    if (inside) return true;
  }
  return false;
}

export async function naturalEarthLines(): Promise<LatLng[][]> {
  return loadNaturalEarthLines();
}

export const coastlineSources = {
  osm: {
    label: 'OpenStreetMap — Overpass API',
    url: 'https://overpass-api.de/api/interpreter',
    role: 'Tracé de la laisse de haute mer (détection du milieu)',
    freshness: 'realtime' as const,
    freshnessLabel: 'Base contributive, mise à jour continue',
  },
  naturalEarth: {
    label: 'Natural Earth 110 m (domaine public)',
    url: 'https://www.naturalearthdata.com/',
    role: 'Polygones des terres émergées (repli hors ligne)',
    freshness: 'delayed' as const,
    freshnessLabel: 'Jeu de données statique — précision ≈ 10 km',
  },
};

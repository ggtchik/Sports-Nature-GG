/**
 * Détermination du milieu — §5 du cahier des charges.
 *
 * Rassemble les trois signaux disponibles (OSM, Natural Earth, maille marine du
 * modèle) et produit une conclusion AUTO, sans jamais inventer de valeur :
 * lorsqu'aucun signal n'aboutit, `distanceCoastKm` reste null et la conclusion
 * est explicitement signalée comme indéterminée.
 */

import {
  COAST_THRESHOLD_KM,
  naturalEarthCoastDistanceKm,
  naturalEarthLines,
  isInsideRings,
  osmCoastDistanceKm,
} from './coastline';
import { hasMarineGridSignal, probeMarineGrid } from './marine';
import { describeError } from './http';
import type { EnvironmentDetection, LatLng, MarineData, ResolvedMilieu } from '@/types';

export interface EnvironmentRequest {
  lat: number;
  lon: number;
  marine: MarineData | null;
  signal?: AbortSignal;
}

export async function detectEnvironment(req: EnvironmentRequest): Promise<EnvironmentDetection> {
  const point: LatLng = { lat: req.lat, lon: req.lon };
  // Signal « maille marine du modèle » : on réutilise la réponse Marine si elle
  // est déjà chargée, sinon on sonde la grille (une seule variable).
  const marineGrid = req.marine ? hasMarineGridSignal(req.marine) : await probeMarineGrid(req.lat, req.lon, req.signal);

  let distanceCoastKm: number | null = null;
  let precision: 'precise' | 'approx' | null = null;
  let source = 'Indéterminé';

  // 1. OpenStreetMap — précis.
  try {
    const d = await osmCoastDistanceKm(point, 12000, req.signal);
    if (d != null) {
      distanceCoastKm = d;
      precision = 'precise';
      source = 'OpenStreetMap (laisse de haute mer)';
    }
  } catch (err) {
    void describeError(err);
  }

  // 2. Natural Earth 110 m — approximatif, toujours disponible.
  let approxDistance: number | null = null;
  try {
    approxDistance = await naturalEarthCoastDistanceKm(point);
  } catch {
    approxDistance = null;
  }

  if (distanceCoastKm == null && approxDistance != null) {
    distanceCoastKm = approxDistance;
    precision = 'approx';
    source = 'Natural Earth 110 m (terres émergées)';
  } else if (distanceCoastKm != null && precision === 'precise' && approxDistance != null) {
    // OSM a borné la recherche à 12 km : Natural Earth confirme l'ordre de grandeur.
    if (distanceCoastKm >= 12) {
      distanceCoastKm = Math.max(distanceCoastKm, approxDistance);
      source = 'OpenStreetMap + Natural Earth 110 m';
    }
  }

  // 3. Le point est-il dans l'eau d'après le masque côtier ?
  let inWater = false;
  try {
    const lines = await naturalEarthLines();
    if (lines.length > 0) {
      // Un point est « en mer » s'il n'est dans aucun polygone de terre émergée.
      inWater = !isInsideRings(point, lines);
    }
  } catch {
    inWater = false;
  }

  // Conclusion.
  let auto: ResolvedMilieu;
  if (distanceCoastKm != null) {
    auto = distanceCoastKm < COAST_THRESHOLD_KM ? 'mer' : 'eau_douce';
  } else if (marineGrid) {
    // Repli : la maille marine du modèle couvre le point (≈ 8 km).
    auto = 'mer';
  } else {
    auto = 'eau_douce';
  }

  return {
    distanceCoastKm,
    precision,
    marineGrid,
    inWater,
    source,
    thresholdKm: COAST_THRESHOLD_KM,
    auto,
    computedAt: new Date().toISOString(),
  };
}

/** Milieu effectif : le choix manuel prime toujours (§5). */
export function resolveMilieu(
  selector: 'auto' | 'mer' | 'eau_douce',
  detection: EnvironmentDetection | null,
): ResolvedMilieu {
  if (selector === 'mer' || selector === 'eau_douce') return selector;
  return detection?.auto ?? 'eau_douce';
}

export const COAST_THRESHOLD = COAST_THRESHOLD_KM;

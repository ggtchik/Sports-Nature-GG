/**
 * Hydrologie — §12 du cahier des charges (pêche en eau douce).
 *
 * Source : API Hydrométrie de Hub'Eau (Office français de la biodiversité /
 * SANDRE), qui diffuse les mesures du réseau français en quasi temps réel.
 *  · ouvert, sans clé API, CORS complet ;
 *  · ≈ 5 000 stations (hauteur d'eau H et débit Q) ;
 *  · les observations « temps réel » sont bancarisées toutes les 5 à 60 minutes
 *    par les producteurs ; Hub'Eau interroge la source toutes les 2 minutes ;
 *  · priorité donnée aux données du réseau national (Vigicrues / SCHAPI et
 *    DREAL), conformément au §12.
 */

import { buildUrl, getJson } from './http';
import { describeError } from './http';
import { haversineKm } from '@/core/geo';
import type { HydroStation, HydrologyData, LatLng } from '@/types';

const HUBEAU = 'https://hubeau.eaufrance.fr/api/v2/hydrometrie';

interface StationEntity {
  code_station: string;
  libelle_station: string;
  libelle_cours_eau?: string;
  libelle_commune?: string;
  longitude_station: number;
  latitude_station: number;
  distance?: number;
}

interface StationsResponse {
  count: number;
  data: StationEntity[];
}

interface ObservationEntity {
  code_station: string;
  date_obs: string;
  resultat_obs: number;
  grandeur_hydro: 'H' | 'Q';
  continuite_obs_hydro?: string;
}

interface ObservationsResponse {
  count: number;
  data: ObservationEntity[];
}

/** Stations les plus proches, triées par distance. */
async function fetchStations(
  p: LatLng,
  distanceM: number,
  signal?: AbortSignal,
): Promise<StationEntity[]> {
  const url = buildUrl(`${HUBEAU}/referentiel/stations`, {
    latitude: p.lat,
    longitude: p.lon,
    distance: distanceM,
    size: 20,
    format: 'json',
    fields:
      'code_station,libelle_station,libelle_cours_eau,libelle_commune,longitude_station,latitude_station,distance',
  });
  const res = await getJson<StationsResponse>(url, { signal, timeoutMs: 15000 });
  return (res.data ?? [])
    .filter((s) => Number.isFinite(s.latitude_station) && Number.isFinite(s.longitude_station))
    .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
}

/** Dernières observations d'une grandeur (H ou Q) pour une station. */
async function fetchObservations(
  codeStation: string,
  grandeur: 'H' | 'Q',
  signal?: AbortSignal,
): Promise<ObservationEntity[]> {
  const url = buildUrl(`${HUBEAU}/observations_tr`, {
    code_entite: codeStation,
    grandeur_hydro: grandeur,
    size: 10,
    sort: 'desc',
    format: 'json',
    fields: 'code_station,date_obs,resultat_obs,grandeur_hydro,continuite_obs_hydro',
  });
  const res = await getJson<ObservationsResponse>(url, { signal, timeoutMs: 15000 });
  return (res.data ?? []).sort((a, b) => b.date_obs.localeCompare(a.date_obs));
}

/** Série courte (24 h) d'une station, pour calculer une tendance. */
async function fetchTrend(
  codeStation: string,
  signal?: AbortSignal,
): Promise<ObservationEntity[]> {
  const url = buildUrl(`${HUBEAU}/observations_tr`, {
    code_entite: codeStation,
    grandeur_hydro: 'H',
    size: 200,
    sort: 'desc',
    format: 'json',
    fields: 'code_station,date_obs,resultat_obs,grandeur_hydro',
    date_debut_obs: new Date(Date.now() - 26 * 3600 * 1000).toISOString().slice(0, 19),
  });
  const res = await getJson<ObservationsResponse>(url, { signal, timeoutMs: 15000 });
  return (res.data ?? []).sort((a, b) => a.date_obs.localeCompare(b.date_obs));
}

export interface HydrologyRequest {
  lat: number;
  lon: number;
  /** Nombre maximum de stations retenues (5 par défaut). */
  maxStations?: number;
  /** Rayon de recherche en mètres. */
  radiusM?: number;
  signal?: AbortSignal;
}

export async function fetchHydrology(req: HydrologyRequest): Promise<HydrologyData> {
  const fetchedAt = new Date().toISOString();
  const maxStations = req.maxStations ?? 5;

  try {
    const stations = await fetchStations(
      { lat: req.lat, lon: req.lon },
      req.radiusM ?? 25000,
      req.signal,
    );

    if (stations.length === 0) {
      return {
        available: false,
        unavailableReason:
          'Aucune station hydrométrique du réseau national dans un rayon de 25 km. Les cours d’eau de ce secteur ne sont pas (ou peu) instrumentés.',
        stations: [],
        sourceLabel: 'Hub’Eau — API Hydrométrie (OFB / SANDRE)',
        sourceUrl: 'https://hubeau.eaufrance.fr/page/api-hydrometrie',
        updateFrequency: 'Observations bancarisées toutes les 5 à 60 min par les producteurs',
        updatedAt: null,
        fetchedAt,
      };
    }

    const selected = stations.slice(0, Math.max(maxStations * 2, 10));
    const details = await Promise.all(
      selected.map(async (s) => {
        const [heights, discharges, trend] = await Promise.all([
          fetchObservations(s.code_station, 'H', req.signal).catch(() => [] as ObservationEntity[]),
          fetchObservations(s.code_station, 'Q', req.signal).catch(() => [] as ObservationEntity[]),
          fetchTrend(s.code_station, req.signal).catch(() => [] as ObservationEntity[]),
        ]);
        return { station: s, heights, discharges, trend };
      }),
    );

    const result: HydroStation[] = details
      .map(({ station, heights, discharges, trend }): HydroStation => {
        const lastH = heights[0] ?? null;
        const lastQ = discharges[0] ?? null;
        const trendDelta =
          trend.length >= 2
            ? trend[trend.length - 1].resultat_obs - trend[0].resultat_obs
            : null;
        return {
          code: station.code_station,
          label: station.libelle_station,
          river: station.libelle_cours_eau ?? null,
          commune: station.libelle_commune ?? null,
          distanceKm: haversineKm(
            { lat: req.lat, lon: req.lon },
            { lat: station.latitude_station, lon: station.longitude_station },
          ),
          lat: station.latitude_station,
          lon: station.longitude_station,
          heightM: lastH ? lastH.resultat_obs : null,
          heightObsAt: lastH ? lastH.date_obs : null,
          dischargeM3s: lastQ ? lastQ.resultat_obs : null,
          dischargeObsAt: lastQ ? lastQ.date_obs : null,
          heightTrend24h: trendDelta != null ? Number(trendDelta.toFixed(3)) : null,
          lastObsAt: lastH?.date_obs ?? lastQ?.date_obs ?? null,
          quality: lastH?.continuite_obs_hydro ?? null,
        };
      })
      // On privilégie les stations qui ont effectivement des données récentes.
      .sort((a, b) => {
        const aScore = (a.heightM != null ? 2 : 0) + (a.dischargeM3s != null ? 1 : 0);
        const bScore = (b.heightM != null ? 2 : 0) + (b.dischargeM3s != null ? 1 : 0);
        if (bScore !== aScore) return bScore - aScore;
        return a.distanceKm - b.distanceKm;
      })
      .slice(0, maxStations);

    const lastObs = result.reduce<string | null>((acc, s) => {
      if (!s.lastObsAt) return acc;
      if (!acc) return s.lastObsAt;
      return s.lastObsAt > acc ? s.lastObsAt : acc;
    }, null);

    return {
      available: result.length > 0,
      unavailableReason:
        result.length === 0 ? 'Stations trouvées mais aucune donnée disponible.' : undefined,
      stations: result,
      sourceLabel: 'Hub’Eau — API Hydrométrie (OFB / SANDRE, réseau Vigicrues)',
      sourceUrl: 'https://hubeau.eaufrance.fr/page/api-hydrometrie',
      updateFrequency: 'Observations bancarisées toutes les 5 à 60 min par les producteurs',
      updatedAt: lastObs,
      fetchedAt,
    };
  } catch (err) {
    return {
      available: false,
      unavailableReason: describeError(err),
      stations: [],
      sourceLabel: 'Hub’Eau — API Hydrométrie (OFB / SANDRE)',
      sourceUrl: 'https://hubeau.eaufrance.fr/page/api-hydrometrie',
      updateFrequency: 'Observations bancarisées toutes les 5 à 60 min par les producteurs',
      updatedAt: null,
      fetchedAt,
    };
  }
}

export const hydrologySources = {
  hubeau: {
    label: 'Hub’Eau — API Hydrométrie',
    url: 'https://hubeau.eaufrance.fr/page/api-hydrometrie',
    role: 'Hauteurs d’eau et débits des stations du réseau français',
    freshness: 'realtime' as const,
    freshnessLabel: 'Quasi temps réel — 5 à 60 min selon les producteurs',
    note: 'Réseau national opéré par les DREAL et le SCHAPI (Vigicrues).',
  },
  vigicrues: {
    label: 'Vigicrues',
    url: 'https://www.vigicrues.gouv.fr/',
    role: 'Vigilance crues et cartes de référence',
    freshness: 'realtime' as const,
    freshnessLabel: 'Temps réel',
  },
};

export { describeError };

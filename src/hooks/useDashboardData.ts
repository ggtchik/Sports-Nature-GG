/**
 * Orchestration des données du dashboard.
 *
 * Une seule source de vérité pour « quelles données sont nécessaires pour
 * spot + activité + milieu + date + heure » (§25). Les appels partent en
 * parallèle dès que le triplet est connu.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '@/state/AppProvider';
import { ACTIVITY_MAP } from '@/state/activities';
import { detectEnvironment, resolveMilieu } from '@/services/environment';
import { fetchWeather } from '@/services/weather';
import { fetchMarine } from '@/services/marine';
import { fetchTides } from '@/services/tides';
import { fetchHydrology } from '@/services/hydrology';
import { computeAstronomy } from '@/services/astronomy';
import { haversineKm, estimateTrip } from '@/core/geo';
import type {
  ActivityId,
  AstronomyData,
  EnvironmentDetection,
  HydrologyData,
  MarineData,
  ResolvedMilieu,
  TideData,
  WeatherData,
} from '@/types';

export interface ModuleStatus {
  loading: boolean;
  error: string | null;
}

export interface DashboardData {
  weather: WeatherData | null;
  marine: MarineData | null;
  tides: TideData | null;
  hydrology: HydrologyData | null;
  astronomy: AstronomyData | null;
  detection: EnvironmentDetection | null;
  milieu: ResolvedMilieu;
  /** Distance à vol d'oiseau depuis la position de départ (km). */
  straightDistanceKm: number | null;
  /** Estimation de trajet (km, durée). */
  trip: { distanceKm: number; durationMinutes: number } | null;
  status: {
    weather: ModuleStatus;
    marine: ModuleStatus;
    tides: ModuleStatus;
    hydrology: ModuleStatus;
    detection: ModuleStatus;
  };
  refresh: () => void;
  /** Contexte temporel partagé (fuseau du spot). */
  timeContext: { timezone: string; utcOffsetSeconds: number };
}

/** Quelles données l'activité + le milieu exigent-ils ? */
export function requiredModules(
  activity: ActivityId | null,
  milieu: ResolvedMilieu,
): { weather: boolean; marine: boolean; tides: boolean; hydrology: boolean; astronomy: boolean } {
  const domain = activity ? ACTIVITY_MAP[activity]?.domain : null;
  const needsMarine = milieu === 'mer' && (domain === 'aquatique' || activity === 'natation');
  return {
    weather: true,
    marine: needsMarine,
    tides: needsMarine,
    hydrology: activity === 'peche' && milieu === 'eau_douce',
    astronomy: true,
  };
}

export function useDashboardData(): DashboardData {
  const { state } = useApp();
  const { spot, activity, milieu, units, origin, tideApiKey } = state;
  const unitsRef = useRef(units);
  unitsRef.current = units;
  void unitsRef;

  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [marine, setMarine] = useState<MarineData | null>(null);
  const [tides, setTides] = useState<TideData | null>(null);
  const [hydrology, setHydrology] = useState<HydrologyData | null>(null);
  const [astronomy, setAstronomy] = useState<AstronomyData | null>(null);
  const [detection, setDetection] = useState<EnvironmentDetection | null>(null);

  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [nonce, setNonce] = useState(0);

  const spotId = spot?.id ?? null;
  const spotLat = spot?.lat;
  const spotLon = spot?.lon;

  // Milieu effectif : le forçage manuel du spot prime sur tout (§5).
  const effectiveMilieu = useMemo<ResolvedMilieu>(() => {
    if (spot?.milieuOverride) return spot.milieuOverride;
    return resolveMilieu(milieu, detection);
  }, [spot, milieu, detection]);

  // Contexte temporel : fuseau du spot si connu, sinon fuseau du navigateur.
  const timeContext = useMemo(() => {
    if (weather) {
      return { timezone: weather.timezone, utcOffsetSeconds: weather.utcOffsetSeconds };
    }
    const offset = -new Date().getTimezoneOffset() * 60;
    return { timezone: 'local', utcOffsetSeconds: offset };
  }, [weather]);

  const needs = requiredModules(activity, effectiveMilieu);

  const setModule = useCallback((name: string, patch: Partial<ModuleStatus>) => {
    setLoading((l) => ({ ...l, [name]: patch.loading ?? l[name] ?? false }));
    setErrors((e) => ({ ...e, [name]: patch.error ?? e[name] ?? null }));
  }, []);

  // -------------------------------------------------------------------------
  // 1. Détection du milieu (doit précéder le reste : elle conditionne les modules)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (spotId == null || spotLat == null || spotLon == null) {
      setDetection(null);
      return;
    }
    const controller = new AbortController();
    setModule('detection', { loading: true, error: null });
    detectEnvironment({
      lat: spotLat,
      lon: spotLon,
      marine: null,
      signal: controller.signal,
    })
      .then((d) => {
        setDetection(d);
        setModule('detection', { loading: false, error: null });
      })
      .catch((err: unknown) => {
        setModule('detection', {
          loading: false,
          error: err instanceof Error ? err.message : 'Détection impossible.',
        });
      });
    return () => controller.abort();
  }, [spotId, spotLat, spotLon, setModule]);

  // -------------------------------------------------------------------------
  // 2. Météo
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (spotId == null || spotLat == null || spotLon == null) {
      setWeather(null);
      return;
    }
    const controller = new AbortController();
    setModule('weather', { loading: true, error: null });
    fetchWeather({ lat: spotLat, lon: spotLon, signal: controller.signal })
      .then((w) => {
        setWeather(w);
        setModule('weather', { loading: false, error: null });
      })
      .catch((err: unknown) => {
        setModule('weather', {
          loading: false,
          error: err instanceof Error ? err.message : 'Météo indisponible.',
        });
      });
    return () => controller.abort();
  }, [spotId, spotLat, spotLon, nonce, setModule]);

  // -------------------------------------------------------------------------
  // 3. Marine (houle / vagues / température d'eau)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!needs.marine || spotId == null || spotLat == null || spotLon == null) {
      setMarine(null);
      return;
    }
    const controller = new AbortController();
    setModule('marine', { loading: true, error: null });
    fetchMarine({ lat: spotLat, lon: spotLon, signal: controller.signal })
      .then((m) => {
        setMarine(m);
        setModule('marine', {
          loading: false,
          error: m.available ? null : m.unavailableReason ?? 'Données marines indisponibles.',
        });
      })
      .catch((err: unknown) => {
        setModule('marine', {
          loading: false,
          error: err instanceof Error ? err.message : 'Données marines indisponibles.',
        });
      });
    return () => controller.abort();
  }, [needs.marine, spotId, spotLat, spotLon, nonce, setModule]);

  // -------------------------------------------------------------------------
  // 4. Marée (dépend de la série marine)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!needs.tides || spotId == null || spotLat == null || spotLon == null) {
      setTides(null);
      return;
    }
    const controller = new AbortController();
    setModule('tides', { loading: true, error: null });
    const seaLevelSeries =
      marine?.hourly.map((h) => ({ time: h.time, seaLevelHeightMsl: h.seaLevelHeightMsl })) ?? [];
    fetchTides({
      lat: spotLat,
      lon: spotLon,
      seaLevelSeries,
      apiKey: tideApiKey,
      signal: controller.signal,
    })
      .then((t) => {
        setTides(t);
        setModule('tides', {
          loading: false,
          error: t.available ? null : t.unavailableReason ?? 'Marée indisponible.',
        });
      })
      .catch((err: unknown) => {
        setModule('tides', {
          loading: false,
          error: err instanceof Error ? err.message : 'Marée indisponible.',
        });
      });
    return () => controller.abort();
  }, [needs.tides, marine, spotId, spotLat, spotLon, tideApiKey, nonce, setModule]);

  // -------------------------------------------------------------------------
  // 5. Hydrologie (pêche en eau douce)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!needs.hydrology || spotId == null || spotLat == null || spotLon == null) {
      setHydrology(null);
      return;
    }
    const controller = new AbortController();
    setModule('hydrology', { loading: true, error: null });
    fetchHydrology({ lat: spotLat, lon: spotLon, signal: controller.signal })
      .then((h) => {
        setHydrology(h);
        setModule('hydrology', {
          loading: false,
          error: h.available ? null : h.unavailableReason ?? 'Hydrologie indisponible.',
        });
      })
      .catch((err: unknown) => {
        setModule('hydrology', {
          loading: false,
          error: err instanceof Error ? err.message : 'Hydrologie indisponible.',
        });
      });
    return () => controller.abort();
  }, [needs.hydrology, spotId, spotLat, spotLon, nonce, setModule]);

  // -------------------------------------------------------------------------
  // 6. Astronomie (calcul local, instantané)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (spotId == null || spotLat == null || spotLon == null) {
      setAstronomy(null);
      return;
    }
    setAstronomy(computeAstronomy({ lat: spotLat, lon: spotLon }));
    setModule('detection', { loading: false });
  }, [spotId, spotLat, spotLon, nonce, setModule]);

  // -------------------------------------------------------------------------
  // Distances
  // -------------------------------------------------------------------------
  const straightDistanceKm = useMemo(() => {
    if (!origin || spotLat == null || spotLon == null) return null;
    return haversineKm({ lat: origin.lat, lon: origin.lon }, { lat: spotLat, lon: spotLon });
  }, [origin, spotLat, spotLon]);

  const trip = useMemo(() => {
    if (straightDistanceKm == null) return null;
    const t = estimateTrip(straightDistanceKm);
    return { distanceKm: t.distanceKm, durationMinutes: t.durationMinutes };
  }, [straightDistanceKm]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  return {
    weather,
    marine,
    tides,
    hydrology,
    astronomy,
    detection,
    milieu: effectiveMilieu,
    straightDistanceKm,
    trip,
    status: {
      weather: { loading: !!loading.weather, error: errors.weather ?? null },
      marine: { loading: !!loading.marine, error: errors.marine ?? null },
      tides: { loading: !!loading.tides, error: errors.tides ?? null },
      hydrology: { loading: !!loading.hydrology, error: errors.hydrology ?? null },
      detection: { loading: !!loading.detection, error: errors.detection ?? null },
    },
    refresh,
    timeContext,
  };
}

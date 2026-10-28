/**
 * Fabrique les données astronomiques d'un spot — §7 du cahier des charges.
 * Calculs 100 % locaux (voir `core/astronomy.ts`), donc toujours disponibles.
 */

import { moonPhaseName, moonRiseSet, moonState, sunEvents } from '@/core/astronomy';
import type { AstronomyData } from '@/types';

export interface AstronomyRequest {
  lat: number;
  lon: number;
  /** Date de référence (défaut : maintenant). */
  date?: Date;
}

export function computeAstronomy(req: AstronomyRequest): AstronomyData {
  const date = req.date ?? new Date();
  const sun = sunEvents(date, req.lat, req.lon);
  const moon = moonState(date);
  const { moonrise, moonset } = moonRiseSet(date, req.lat, req.lon);

  return {
    timezone: 'UTC',
    sunrise: sun.sunrise ? sun.sunrise.toISOString() : null,
    sunset: sun.sunset ? sun.sunset.toISOString() : null,
    solarNoon: sun.solarNoon ? sun.solarNoon.toISOString() : null,
    dayLengthSeconds: sun.dayLengthSeconds,
    civilDawn: sun.civilDawn ? sun.civilDawn.toISOString() : null,
    civilDusk: sun.civilDusk ? sun.civilDusk.toISOString() : null,
    moonPhase: moon.phase,
    moonPhaseName: moonPhaseName(moon.phase),
    moonIllumination: moon.illumination,
    moonAgeDays: moon.ageDays,
    moonrise: moonrise ? moonrise.toISOString() : null,
    moonset: moonset ? moonset.toISOString() : null,
    computedAt: new Date().toISOString(),
  };
}

export const astronomySource = {
  label: 'Calcul astronomique local (algorithmes NOAA / Meeus)',
  url: 'https://gml.noaa.gov/grad/solcalc/solareqy.PDF',
  role: 'Lever / coucher du soleil, durée du jour, phase et illumination de la Lune',
  freshness: 'realtime' as const,
  freshnessLabel: 'Calcul déterministe — précision ± 1 min pour le soleil',
  note: 'Lever et coucher de Lune : méthode approchée, précision ± 30 min.',
};

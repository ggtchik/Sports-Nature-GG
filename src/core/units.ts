/**
 * Conversions d'unités — §6 du cahier des charges.
 *
 * RÈGLE ABSOLUE : aucune valeur issue d'une API n'est modifiée. Tout ce module
 * produit des chaînes d'affichage à partir d'une valeur source conservée intacte.
 *
 *  1 NM = 1,852 km
 *  1 kn = 1,852 km/h
 */

import type { UnitMode } from '@/types';

export const KM_PER_NAUTICAL_MILE = 1.852;
export const KMH_PER_KNOT = 1.852;

export const UNIT_MODES: { id: UnitMode; label: string; short: string; hint: string }[] = [
  { id: 'standard', label: 'Standard', short: 'STD', hint: 'km · km/h · °C · hPa · m' },
  { id: 'nautical', label: 'Nautique', short: 'NM', hint: 'NM · kn · m · °C · hPa' },
  { id: 'dual', label: 'Double', short: '2×', hint: 'Les deux unités simultanément' },
];

export function kmToNm(km: number): number {
  return km / KM_PER_NAUTICAL_MILE;
}

export function nmToKm(nm: number): number {
  return nm * KM_PER_NAUTICAL_MILE;
}

export function kmhToKn(kmh: number): number {
  return kmh / KMH_PER_KNOT;
}

export function knToKmh(kn: number): number {
  return kn * KMH_PER_KNOT;
}

/** Arrondi homogène dans toute l'application. */
export function round(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return NaN;
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

const nf = (min: number, max: number) =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: min, maximumFractionDigits: max });

const f0 = nf(0, 0);
const f1 = nf(1, 1);

function num(value: number, decimals: number): string {
  return decimals === 0 ? f0.format(value) : f1.format(value);
}

// ---------------------------------------------------------------------------
// Distance
// ---------------------------------------------------------------------------

/**
 * Distance en km (unité source) → affichage.
 * Les deux unités terrestres et nautiques sont toujours exprimées avec 1 décimale.
 */
export function formatDistance(km: number, mode: UnitMode): string {
  if (!Number.isFinite(km)) return '—';
  const nm = kmToNm(km);
  switch (mode) {
    case 'standard':
      return `${num(km, 1)} km`;
    case 'nautical':
      return `${num(nm, 1)} NM`;
    case 'dual':
      return `${num(km, 1)} km / ${num(nm, 1)} NM`;
  }
}

/** Libellé de l'unité de distance seule (pour les en-têtes de tableau). */
export function distanceUnit(mode: UnitMode): string {
  switch (mode) {
    case 'standard':
      return 'km';
    case 'nautical':
      return 'NM';
    case 'dual':
      return 'km / NM';
  }
}

export function distanceValue(km: number, mode: UnitMode): string {
  if (!Number.isFinite(km)) return '—';
  const nm = kmToNm(km);
  switch (mode) {
    case 'standard':
      return num(km, 1);
    case 'nautical':
      return num(nm, 1);
    case 'dual':
      return `${num(km, 1)} / ${num(nm, 1)}`;
  }
}

// ---------------------------------------------------------------------------
// Vitesse
// ---------------------------------------------------------------------------

/** Vitesse en km/h (unité source) → affichage. */
export function formatSpeed(kmh: number, mode: UnitMode): string {
  if (!Number.isFinite(kmh)) return '—';
  const kn = kmhToKn(kmh);
  switch (mode) {
    case 'standard':
      return `${num(kmh, 0)} km/h`;
    case 'nautical':
      return `${num(kn, 0)} kn`;
    case 'dual':
      return `${num(kmh, 0)} km/h / ${num(kn, 0)} kn`;
  }
}

export function speedUnit(mode: UnitMode): string {
  switch (mode) {
    case 'standard':
      return 'km/h';
    case 'nautical':
      return 'kn';
    case 'dual':
      return 'km/h / kn';
  }
}

export function speedValue(kmh: number, mode: UnitMode): string {
  if (!Number.isFinite(kmh)) return '—';
  const kn = kmhToKn(kmh);
  switch (mode) {
    case 'standard':
      return num(kmh, 0);
    case 'nautical':
      return num(kn, 0);
    case 'dual':
      return `${num(kmh, 0)} / ${num(kn, 0)}`;
  }
}

/**
 * Valeur seule de la vitesse, sans unité — pour les colonnes de tableau dont
 * l'en-tête porte déjà l'unité.
 */
export function formatSpeedValue(kmh: number, mode: UnitMode): string {
  return speedValue(kmh, mode);
}

// ---------------------------------------------------------------------------
// Grandeurs dont l'unité ne change pas
// ---------------------------------------------------------------------------

/** Hauteur de houle / vague / profondeur — toujours en mètres. */
export function formatHeight(m: number): string {
  if (!Number.isFinite(m)) return '—';
  return `${num(m, 1)} m`;
}

export function formatTemperature(c: number): string {
  if (!Number.isFinite(c)) return '—';
  return `${num(c, 1)} °C`;
}

export function formatPressure(hpa: number): string {
  if (!Number.isFinite(hpa)) return '—';
  return `${num(hpa, 0)} hPa`;
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${num(value, 0)} %`;
}

export function formatSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h} h ${String(m).padStart(2, '0')}`;
}

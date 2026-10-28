/**
 * Catalogue des activités — §2 du cahier des charges.
 *
 * Le terme officiel de la catégorie nautique est NAUTISME ; il couvre la voile,
 * le bateau à moteur, la plaisance et les autres pratiques nautiques
 * compatibles avec les données disponibles.
 */

import type { Activity, ActivityId } from '@/types';

export const ACTIVITIES: Activity[] = [
  {
    id: 'balade',
    label: 'Balade',
    emoji: '🥾',
    domain: 'terrestre',
    defaultMilieu: 'auto',
    tagline: 'Marche tranquille, parcours court',
  },
  {
    id: 'randonnee',
    label: 'Randonnée',
    emoji: '🏔️',
    domain: 'terrestre',
    defaultMilieu: 'auto',
    tagline: 'Itinéraire long, dénivelé, autonomie',
  },
  {
    id: 'jogging',
    label: 'Jogging',
    emoji: '🏃',
    domain: 'terrestre',
    defaultMilieu: 'auto',
    tagline: 'Course à pied, effort soutenu',
  },
  {
    id: 'natation',
    label: 'Natation',
    emoji: '🏊',
    domain: 'aquatique',
    defaultMilieu: 'auto',
    tagline: 'Baignade en eau douce ou dans le surf',
  },
  {
    id: 'nautisme',
    label: 'Nautisme',
    emoji: '⛵',
    domain: 'aquatique',
    defaultMilieu: 'mer',
    tagline: 'Voile, bateau à moteur, plaisance',
  },
  {
    id: 'peche',
    label: 'Pêche',
    emoji: '🎣',
    domain: 'aquatique',
    defaultMilieu: 'auto',
    tagline: 'Rivière, lac, étang ou bord de mer',
  },
  {
    id: 'chasse',
    label: 'Chasse',
    emoji: '🦌',
    domain: 'terrestre',
    defaultMilieu: 'auto',
    tagline: 'Affût, recherches, respect du gibier',
  },
];

export const ACTIVITY_MAP: Record<ActivityId, Activity> = ACTIVITIES.reduce(
  (acc, a) => {
    acc[a.id] = a;
    return acc;
  },
  {} as Record<ActivityId, Activity>,
);

export function getActivity(id: ActivityId | null): Activity | null {
  return id ? ACTIVITY_MAP[id] ?? null : null;
}

/** Les activités terrestres n'affichent jamais de données maritimes (§9). */
export function isTerrestrial(id: ActivityId | null): boolean {
  return id != null && ACTIVITY_MAP[id]?.domain === 'terrestre';
}

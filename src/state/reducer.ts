/**
 * État applicatif — réducteur unique, persistance sélective.
 */

import type {
  ActivityId,
  CostSettings,
  LatLng,
  MilieuMode,
  Place,
  Spot,
  UnitMode,
} from '@/types';

export const DEFAULT_COSTS: CostSettings = {
  consumptionL100: 7,
  fuelPricePerL: 1.75,
  tolls: 0,
  lodging: 0,
  other: 0,
  useDrivingDistance: true,
};

export interface AppState {
  /** Étape courante du parcours (§24). */
  step: 1 | 2 | 3 | 4 | 5 | 6;
  /** Position de départ. */
  origin: Place | null;
  /** Géolocalisation en cours. */
  locating: boolean;
  locateError: string | null;
  activity: ActivityId | null;
  /** Spot sélectionné. */
  spot: Spot | null;
  /** Sélecteur de milieu AUTO | MER | EAU DOUCE (§5). */
  milieu: MilieuMode;
  /** Sélecteur global d'unités (§6). */
  units: UnitMode;
  /** Spots enregistrés localement. */
  spots: Spot[];
  /** Réglages de frais (§15). */
  costs: CostSettings;
  /** Clé api-maree.fr personnelle (stockée dans le navigateur de l'utilisateur). */
  tideApiKey: string;
}

export const initialState: AppState = {
  step: 1,
  origin: null,
  locating: false,
  locateError: null,
  activity: null,
  spot: null,
  milieu: 'auto',
  units: 'standard',
  spots: [],
  costs: DEFAULT_COSTS,
  tideApiKey: '',
};

export type Action =
  | { type: 'setStep'; step: AppState['step'] }
  | { type: 'setOrigin'; place: Place | null }
  | { type: 'setOriginCoords'; coords: LatLng; label?: string }
  | { type: 'locating'; value: boolean }
  | { type: 'locateError'; message: string | null }
  | { type: 'setActivity'; activity: ActivityId | null }
  | { type: 'setSpot'; spot: Spot | null }
  | { type: 'setMilieu'; milieu: MilieuMode }
  | { type: 'setUnits'; units: UnitMode }
  | { type: 'upsertSpot'; spot: Spot }
  | { type: 'deleteSpot'; id: string }
  | { type: 'setSpots'; spots: Spot[] }
  | { type: 'setCosts'; costs: Partial<CostSettings> }
  | { type: 'setTideApiKey'; key: string }
  | { type: 'hydrate'; payload: Partial<AppState> }
  | { type: 'reset' };

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'setStep':
      return { ...state, step: action.step };

    case 'setOrigin':
      return { ...state, origin: action.place, locateError: null };

    case 'setOriginCoords': {
      const place: Place = {
        id: `coords:${action.coords.lat.toFixed(5)}:${action.coords.lon.toFixed(5)}`,
        label: action.label ?? `Position ${action.coords.lat.toFixed(5)}, ${action.coords.lon.toFixed(5)}`,
        kind: 'coordonnees',
        lat: action.coords.lat,
        lon: action.coords.lon,
        source: 'Géolocalisation',
      };
      return { ...state, origin: place, locateError: null };
    }

    case 'locating':
      return { ...state, locating: action.value };

    case 'locateError':
      return { ...state, locating: false, locateError: action.message };

    case 'setActivity':
      return {
        ...state,
        activity: action.activity,
        // Le milieu par défaut suit l'activité, sauf si l'utilisateur a déjà forcé.
        milieu:
          action.activity && state.milieu === 'auto'
            ? 'auto'
            : state.milieu,
        step: Math.max(state.step, 3) as AppState['step'],
      };

    case 'setSpot':
      return { ...state, spot: action.spot, step: 4 };

    case 'setMilieu':
      return { ...state, milieu: action.milieu };

    case 'setUnits':
      return { ...state, units: action.units };

    case 'upsertSpot': {
      const exists = state.spots.some((s) => s.id === action.spot.id);
      return {
        ...state,
        spots: exists
          ? state.spots.map((s) => (s.id === action.spot.id ? action.spot : s))
          : [...state.spots, action.spot],
        spot: action.spot,
      };
    }

    case 'deleteSpot':
      return {
        ...state,
        spots: state.spots.filter((s) => s.id !== action.id),
        spot: state.spot?.id === action.id ? null : state.spot,
      };

    case 'setSpots':
      return { ...state, spots: action.spots };

    case 'setCosts':
      return { ...state, costs: { ...state.costs, ...action.costs } };

    case 'setTideApiKey':
      return { ...state, tideApiKey: action.key };

    case 'hydrate':
      return { ...state, ...action.payload };

    case 'reset':
      return { ...initialState, spots: state.spots, costs: state.costs, units: state.units, tideApiKey: state.tideApiKey };

    default:
      return state;
  }
}

/** Un spot est-il complet au minimum (§4) ? */
export function isSpotComplete(spot: Partial<Spot> | null): spot is Spot {
  return !!spot && !!spot.name?.trim() && !!spot.id;
}

export function newSpot(partial: Partial<Spot> & Pick<Spot, 'name' | 'lat' | 'lon'>): Spot {
  const now = Date.now();
  return {
    id: partial.id ?? `spot-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: partial.name.trim(),
    commune: partial.commune,
    lat: partial.lat,
    lon: partial.lon,
    milieuOverride: partial.milieuOverride,
    activity: partial.activity,
    notes: partial.notes,
    createdAt: partial.createdAt ?? now,
    updatedAt: now,
  };
}

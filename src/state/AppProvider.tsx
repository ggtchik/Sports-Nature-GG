/**
 * Contexte applicatif : état + persistance + actions dérivées.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';
import { reducer, initialState, type Action, type AppState } from './reducer';
import { loadJson, saveJson, storageAvailable, STORAGE_KEYS } from '@/core/storage';
import type { ActivityId, CostSettings, MilieuMode, Place, Spot, UnitMode } from '@/types';

interface PersistedShape {
  spots: Spot[];
  costs: CostSettings;
  units: UnitMode;
  tideApiKey: string;
  activity: ActivityId | null;
  milieu: MilieuMode;
}

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  /** Vrai si le stockage local est utilisable. */
  persisted: boolean;
  setStep: (step: AppState['step']) => void;
  setOrigin: (place: Place | null) => void;
  setActivity: (activity: ActivityId | null) => void;
  setSpot: (spot: Spot | null) => void;
  setMilieu: (milieu: MilieuMode) => void;
  setUnits: (units: UnitMode) => void;
  saveSpot: (spot: Spot) => void;
  deleteSpot: (id: string) => void;
  setCosts: (costs: Partial<CostSettings>) => void;
  setTideApiKey: (key: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function readPersisted(): Partial<AppState> {
  const ls = typeof window !== 'undefined' ? window.localStorage : undefined;
  const saved = loadJson<Partial<PersistedShape>>(ls as Storage, STORAGE_KEYS.settings, {});
  return {
    spots: Array.isArray(saved.spots) ? saved.spots : [],
    costs: { ...initialState.costs, ...(saved.costs ?? {}) },
    units: saved.units ?? initialState.units,
    tideApiKey: saved.tideApiKey ?? '',
    activity: saved.activity ?? null,
    milieu: saved.milieu ?? 'auto',
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState, (init) => ({
    ...init,
    ...readPersisted(),
  }));

  const persisted = useMemo(
    () => storageAvailable(typeof window !== 'undefined' ? window.localStorage : undefined),
    [],
  );

  // Persistance (préférences et spots uniquement — jamais les données de source).
  useEffect(() => {
    if (!persisted) return;
    const payload: PersistedShape = {
      spots: state.spots,
      costs: state.costs,
      units: state.units,
      tideApiKey: state.tideApiKey,
      activity: state.activity,
      milieu: state.milieu,
    };
    saveJson(window.localStorage, STORAGE_KEYS.settings, payload);
  }, [
    persisted,
    state.spots,
    state.costs,
    state.units,
    state.tideApiKey,
    state.activity,
    state.milieu,
  ]);

  const setStep = useCallback((step: AppState['step']) => dispatch({ type: 'setStep', step }), []);
  const setOrigin = useCallback((place: Place | null) => dispatch({ type: 'setOrigin', place }), []);
  const setActivity = useCallback(
    (activity: ActivityId | null) => dispatch({ type: 'setActivity', activity }),
    [],
  );
  const setSpot = useCallback((spot: Spot | null) => dispatch({ type: 'setSpot', spot }), []);
  const setMilieu = useCallback((milieu: MilieuMode) => dispatch({ type: 'setMilieu', milieu }), []);
  const setUnits = useCallback((units: UnitMode) => dispatch({ type: 'setUnits', units }), []);
  const saveSpot = useCallback((spot: Spot) => dispatch({ type: 'upsertSpot', spot }), []);
  const deleteSpot = useCallback((id: string) => dispatch({ type: 'deleteSpot', id }), []);
  const setCosts = useCallback(
    (costs: Partial<CostSettings>) => dispatch({ type: 'setCosts', costs }),
    [],
  );
  const setTideApiKey = useCallback(
    (key: string) => dispatch({ type: 'setTideApiKey', key }),
    [],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      dispatch,
      persisted,
      setStep,
      setOrigin,
      setActivity,
      setSpot,
      setMilieu,
      setUnits,
      saveSpot,
      deleteSpot,
      setCosts,
      setTideApiKey,
    }),
    [
      state,
      persisted,
      setStep,
      setOrigin,
      setActivity,
      setSpot,
      setMilieu,
      setUnits,
      saveSpot,
      deleteSpot,
      setCosts,
      setTideApiKey,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp doit être utilisé dans <AppProvider>.');
  return ctx;
}

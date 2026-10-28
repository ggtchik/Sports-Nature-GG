/**
 * Étape 1 — Position de départ (§3, §24).
 * Géolocalisation automatique ou saisie manuelle (adresse, commune, code
 * postal, lieu, coordonnées GPS).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Notice } from '@/components/ui/Notice';
import { useApp } from '@/state/AppProvider';
import { parseCoords, placeFromCoords, reverseGeocode, searchPlaces } from '@/services/geocoding';
import { describeError } from '@/services/http';
import { formatCoords } from '@/core/geo';
import type { Place } from '@/types';

export function StepPosition() {
  const { state, setOrigin, dispatch } = useApp();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [coordsInput, setCoordsInput] = useState('');
  const [coordsError, setCoordsError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setSearching(true);
    setSearchError(null);
    try {
      const places = await searchPlaces(q, { limit: 8, signal: controller.signal });
      setResults(places);
      if (places.length === 0) setSearchError('Aucun résultat. Essayez une autre orthographe.');
    } catch (err) {
      setResults([]);
      setSearchError(describeError(err));
    } finally {
      setSearching(false);
    }
  }, []);

  // Recherche anti-rebond.
  useEffect(() => {
    const t = setTimeout(() => {
      if (query.trim().length >= 2) void runSearch(query);
      else setResults([]);
    }, 350);
    return () => clearTimeout(t);
  }, [query, runSearch]);

  const geolocate = useCallback(() => {
    if (!('geolocation' in navigator)) {
      dispatch({ type: 'locateError', message: 'Ce terminal ne fournit pas de géolocalisation.' });
      return;
    }
    dispatch({ type: 'locating', value: true });
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        dispatch({ type: 'setOriginCoords', coords });
        // Géocodage inverse pour obtenir un libellé lisible.
        try {
          const place = await reverseGeocode(coords);
          if (place) setOrigin(place);
        } catch {
          /* le libellé de secours reste affiché */
        }
        dispatch({ type: 'locating', value: false });
      },
      (err) => {
        const messages: Record<number, string> = {
          1: 'Autorisation refusée. Saisissez votre position manuellement.',
          2: 'Position indisponible sur ce terminal.',
          3: 'Délai dépassé. Réessayez ou saisissez votre position.',
        };
        dispatch({ type: 'locateError', message: messages[err.code] ?? 'Géolocalisation impossible.' });
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 },
    );
  }, [dispatch, setOrigin]);

  const submitCoords = useCallback(() => {
    const parsed = parseCoords(coordsInput);
    if (!parsed) {
      setCoordsError(
        'Format non reconnu. Exemples : 43.2951, 5.3727 · 43,2951 -5,3727 · 43°17\'42"N 5°22\'21"E',
      );
      return;
    }
    setCoordsError(null);
    setOrigin(placeFromCoords(parsed));
  }, [coordsInput, setOrigin]);

  return (
    <div className="stack stack--lg">
      <Card
        title="📍 Ma position actuelle"
        subtitle="Utilisée pour calculer la distance jusqu'au spot, la durée de trajet et les frais"
        icon="📍"
        iconTone="clay"
      >
        <div className="stack">
          <div className="row row--wrap">
            <button
              type="button"
              className="btn btn--primary btn--lg"
              onClick={geolocate}
              disabled={state.locating}
            >
              {state.locating ? (
                <>
                  <span className="spinner spinner--light" /> Localisation…
                </>
              ) : (
                <>🛰️ Me géolocaliser</>
              )}
            </button>
            <span className="u-dim" style={{ fontSize: 'var(--t-sm)' }}>
              La position reste dans votre navigateur — aucune donnée n’est envoyée à un serveur tiers.
            </span>
          </div>

          {state.locateError && (
            <Notice tone="warn" title="Géolocalisation">
              {state.locateError}
            </Notice>
          )}

          {state.origin && (
            <div className="spot-item spot-item--active">
              <div className="card__icon card__icon--forest" aria-hidden="true">
                ✅
              </div>
              <div className="spot-item__body">
                <div className="spot-item__name">{state.origin.label}</div>
                <div className="spot-item__meta">
                  {formatCoords({ lat: state.origin.lat, lon: state.origin.lon })} ·{' '}
                  {state.origin.source}
                </div>
              </div>
              <div className="spot-item__actions">
                <button type="button" className="btn btn--sm btn--ghost" onClick={() => setOrigin(null)}>
                  Changer
                </button>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card
        title="📍 Saisir une position"
        subtitle="Adresse, commune, code postal, lieu ou coordonnées GPS"
        icon="⌨️"
        iconTone="sky"
      >
        <div className="stack">
          <div className="field">
            <label className="field__label" htmlFor="place-search">
              Rechercher un lieu
            </label>
            <div className="input-group">
              <input
                id="place-search"
                className="input"
                type="search"
                placeholder="Ex. : Lac de Vassivière, 33185 Le Haillan, 44.8378, -0.5792…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
              />
              <button
                type="button"
                className="btn"
                onClick={() => void runSearch(query)}
                disabled={searching || query.trim().length < 2}
              >
                {searching ? <span className="spinner spinner--sm" /> : '🔍'} Rechercher
              </button>
            </div>
            <span className="field__hint">
              Géocodage : API de la Géoplateforme (IGN / Base Adresse Nationale), puis API Adresse,
              puis Nominatim. Aucune clé API requise.
            </span>
          </div>

          {searchError && <Notice tone="warn">{searchError}</Notice>}

          {results.length > 0 && (
            <div className="results" role="listbox" aria-label="Résultats de recherche">
              {results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="result"
                  aria-pressed={state.origin?.id === r.id}
                  onClick={() => {
                    setOrigin(r);
                    setResults([]);
                    setQuery('');
                  }}
                >
                  <span className="result__icon" aria-hidden="true">
                    {r.kind === 'commune' ? '🏙️' : r.kind === 'adresse' ? '🏠' : r.kind === 'coordonnees' ? '📌' : '📍'}
                  </span>
                  <span className="result__body">
                    <span className="result__title">{r.label}</span>
                    <span className="result__meta">
                      {formatCoords({ lat: r.lat, lon: r.lon })}
                      {r.score != null && ` · pertinence ${Math.round(r.score * 100)} %`}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}

          <hr className="divider" />

          <div className="field">
            <label className="field__label" htmlFor="coords-input">
              Coordonnées GPS
            </label>
            <div className="input-group">
              <input
                id="coords-input"
                className="input"
                type="text"
                inputMode="decimal"
                placeholder="43.2951, 5.3727"
                value={coordsInput}
                onChange={(e) => setCoordsInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitCoords();
                }}
              />
              <button type="button" className="btn" onClick={submitCoords}>
                Utiliser
              </button>
            </div>
            {coordsError ? (
              <span className="field__hint" style={{ color: 'var(--danger-600)' }}>
                {coordsError}
              </span>
            ) : (
              <span className="field__hint">
                Degrés décimaux (43.2951, 5.3727 · 43.2951 5.3727 · 43,2951 -5,3727) ou
                degrés minutes secondes (43°17'42"N 5°22'21"E). Séparateur décimal : point ou
                virgule.
              </span>
            )}
          </div>

          <div className="row row--wrap" style={{ gap: 8 }}>
            <Chip tone="neutral">💡 Astuce : la position de départ est mémorisée pour la session</Chip>
          </div>
        </div>
      </Card>
    </div>
  );
}

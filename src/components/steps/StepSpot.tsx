/**
 * Étape 3 — Recherche et sélection du spot (§4, §24).
 * Recherche libre, coordonnées, sélection d'un spot enregistré,
 * ajout / modification / suppression, persistance locale.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Notice } from '@/components/ui/Notice';
import { useApp } from '@/state/AppProvider';
import { newSpot } from '@/state/reducer';
import { parseCoords, placeFromCoords, searchPlaces } from '@/services/geocoding';
import { describeError } from '@/services/http';
import { formatCoords } from '@/core/geo';
import { formatDistance as fmtDistance } from '@/core/units';
import type { Place, Spot } from '@/types';

export function StepSpot() {
  const { state, setSpot, saveSpot, deleteSpot } = useApp();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Formulaire d'ajout / édition
  const [editing, setEditing] = useState<Spot | null>(null);
  const [form, setForm] = useState({ name: '', commune: '', coords: '', notes: '' });
  const [formError, setFormError] = useState<string | null>(null);

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
      if (places.length === 0) setSearchError('Aucun lieu trouvé.');
    } catch (err) {
      setResults([]);
      setSearchError(describeError(err));
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      if (query.trim().length >= 2) void runSearch(query);
      else setResults([]);
    }, 350);
    return () => clearTimeout(t);
  }, [query, runSearch]);

  const startCreate = () => {
    setEditing(newSpot({ name: '', lat: 0, lon: 0 }));
    setForm({ name: '', commune: '', coords: '', notes: '' });
    setFormError(null);
  };

  const startEdit = (spot: Spot) => {
    setEditing(spot);
    setForm({
      name: spot.name,
      commune: spot.commune ?? '',
      coords: `${spot.lat}, ${spot.lon}`,
      notes: spot.notes ?? '',
    });
    setFormError(null);
  };

  const submitForm = () => {
    if (!editing) return;
    const name = form.name.trim();
    if (name.length < 2) {
      setFormError('Donnez un nom au spot (2 caractères minimum).');
      return;
    }
    const coords = parseCoords(form.coords);
    if (!coords) {
      setFormError('Coordonnées GPS invalides. Exemple : 44.8378, -0.5792');
      return;
    }
    setFormError(null);
    const spot = newSpot({
      id: editing.id,
      name,
      commune: form.commune.trim() || undefined,
      lat: coords.lat,
      lon: coords.lon,
      notes: form.notes.trim() || undefined,
      milieuOverride: editing.milieuOverride,
      activity: editing.activity ?? state.activity ?? undefined,
      createdAt: editing.createdAt,
    });
    saveSpot(spot);
    setSpot(spot);
    setEditing(null);
  };

  return (
    <div className="stack stack--lg">
      <Card
        title="Rechercher un spot"
        subtitle="Nom de lieu, commune, code postal ou coordonnées"
        icon="🔍"
        iconTone="forest"
      >
        <div className="stack">
          <div className="field">
            <label className="field__label" htmlFor="spot-search">
              Recherche
            </label>
            <div className="input-group">
              <input
                id="spot-search"
                className="input"
                type="search"
                placeholder="Ex. : Lac de Vassivière, Arcachon, 33950, 44.65, -1.16…"
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
                {searching ? <span className="spinner spinner--sm" /> : '🔍'} Chercher
              </button>
            </div>
          </div>

          {searchError && <Notice tone="warn">{searchError}</Notice>}

          {results.length > 0 && (
            <div className="results">
              {results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="result"
                  onClick={() => {
                    const spot = newSpot({
                      name: r.label,
                      commune: r.city,
                      lat: r.lat,
                      lon: r.lon,
                      activity: state.activity ?? undefined,
                    });
                    setSpot(spot);
                    setResults([]);
                    setQuery('');
                  }}
                >
                  <span className="result__icon" aria-hidden="true">
                    📍
                  </span>
                  <span className="result__body">
                    <span className="result__title">{r.label}</span>
                    <span className="result__meta">{formatCoords({ lat: r.lat, lon: r.lon })}</span>
                  </span>
                  <span className="chip chip--forest">Sélectionner</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Card
        title="Mes spots enregistrés"
        subtitle={`${state.spots.length} spot${state.spots.length > 1 ? 's' : ''} conservé${
          state.spots.length > 1 ? 's' : ''
        } localement`}
        icon="📌"
        iconTone="clay"
        actions={
          <button type="button" className="btn btn--sm btn--primary" onClick={startCreate}>
            + Nouveau spot
          </button>
        }
        footer={<span>Stockage local du navigateur (LocalStorage) — aucune synchronisation serveur.</span>}
      >
        {state.spots.length === 0 ? (
          <Notice tone="info" title="Aucun spot enregistré">
            Utilisez la recherche ci-dessus ou créez un spot manuellement avec ses coordonnées GPS.
          </Notice>
        ) : (
          <div className="spot-list">
            {state.spots.map((s) => (
              <div key={s.id} className={`spot-item${state.spot?.id === s.id ? ' spot-item--active' : ''}`}>
                <div className="card__icon card__icon--forest" aria-hidden="true">
                  📍
                </div>
                <div className="spot-item__body">
                  <div className="spot-item__name">{s.name}</div>
                  <div className="spot-item__meta">
                    {s.commune ? `${s.commune} · ` : ''}
                    {formatCoords({ lat: s.lat, lon: s.lon })}
                    {s.milieuOverride && ` · ${s.milieuOverride === 'mer' ? 'Mer' : 'Eau douce'} (forcé)`}
                  </div>
                </div>
                <div className="spot-item__actions">
                  <button
                    type="button"
                    className="btn btn--sm"
                    onClick={() => setSpot(s)}
                    aria-label={`Sélectionner ${s.name}`}
                  >
                    Choisir
                  </button>
                  <button
                    type="button"
                    className="btn btn--sm btn--ghost"
                    onClick={() => startEdit(s)}
                    aria-label={`Modifier ${s.name}`}
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    className="btn btn--sm btn--danger"
                    onClick={() => {
                      if (window.confirm(`Supprimer le spot « ${s.name} » ?`)) deleteSpot(s.id);
                    }}
                    aria-label={`Supprimer ${s.name}`}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {state.spot && (
        <Card
          title="Spot sélectionné"
          icon="✅"
          iconTone="forest"
          actions={<Chip tone="ok" dot pulse>Actif</Chip>}
          footer={
            <span>
              Distance depuis la position de départ :{' '}
              {state.origin
                ? fmtDistance(
                    straightLine(state.origin, state.spot),
                    state.units,
                  )
                : 'position de départ non définie'}
            </span>
          }
        >
          <dl className="kv">
            <dt>Nom</dt>
            <dd>{state.spot.name}</dd>
            <dt>Commune</dt>
            <dd>{state.spot.commune ?? '—'}</dd>
            <dt>Coordonnées</dt>
            <dd style={{ fontSize: 'var(--t-xs)' }}>
              {formatCoords({ lat: state.spot.lat, lon: state.spot.lon })}
            </dd>
            <dt>Contexte enregistré</dt>
            <dd>{state.spot.milieuOverride ? (state.spot.milieuOverride === 'mer' ? 'Mer' : 'Eau douce') : 'Automatique'}</dd>
            <dt>Notes</dt>
            <dd style={{ fontSize: 'var(--t-xs)' }}>{state.spot.notes ?? '—'}</dd>
          </dl>
          <div className="row row--wrap" style={{ gap: 8, marginTop: 'var(--gap-4)' }}>
            <button type="button" className="btn btn--sm" onClick={() => startEdit(state.spot as Spot)}>
              ✏️ Modifier
            </button>
            <button type="button" className="btn btn--sm" onClick={() => saveSpot(state.spot as Spot)}>
              💾 Enregistrer les modifications
            </button>
          </div>
        </Card>
      )}

      {editing && (
        <Card
          title={editing.name ? `Modifier « ${editing.name} »` : 'Nouveau spot'}
          subtitle="Nom, localisation et coordonnées GPS obligatoires"
          icon="✏️"
          iconTone="sky"
        >
          <div className="stack">
            <div className="grid grid--2">
              <div className="field">
                <label className="field__label" htmlFor="spot-name">
                  Nom du spot
                </label>
                <input
                  id="spot-name"
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Lac de Vassivière"
                />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="spot-commune">
                  Commune (optionnel)
                </label>
                <input
                  id="spot-commune"
                  className="input"
                  value={form.commune}
                  onChange={(e) => setForm((f) => ({ ...f, commune: e.target.value }))}
                  placeholder="Peyrat-le-Château"
                />
              </div>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="spot-coords">
                Coordonnées GPS
              </label>
              <input
                id="spot-coords"
                className="input"
                value={form.coords}
                onChange={(e) => setForm((f) => ({ ...f, coords: e.target.value }))}
                placeholder="45.7975, 1.9486"
              />
              <span className="field__hint">Latitude, longitude en degrés décimaux (WGS84).</span>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="spot-notes">
                Notes (optionnel)
              </label>
              <textarea
                id="spot-notes"
                className="textarea"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Accès, mise à l'eau, réglementation…"
              />
            </div>
            {formError && <Notice tone="danger">{formError}</Notice>}
            <div className="row row--wrap">
              <button type="button" className="btn btn--primary" onClick={submitForm}>
                💾 Enregistrer
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setEditing(null)}>
                Annuler
              </button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function straightLine(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371.0088;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export { placeFromCoords };

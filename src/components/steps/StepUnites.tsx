/**
 * Étape 5 — Sélecteur global des unités (§6, §24).
 * STANDARD | NAUTIQUE | DOUBLE. Le changement est immédiat, sans rechargement.
 */

import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Notice } from '@/components/ui/Notice';
import { UnitSelector } from '@/components/UnitSelector';
import { useApp } from '@/state/AppProvider';
import { formatDistance, formatSpeed, UNIT_MODES } from '@/core/units';
import type { UnitMode } from '@/types';

const SAMPLE_DISTANCE_KM = 12.4;
const SAMPLE_WIND_KMH = 24;

export function StepUnites() {
  const { state, setUnits } = useApp();

  return (
    <div className="stack stack--lg">
      <Card
        title="Sélecteur global des unités"
        subtitle="S'applique immédiatement à toute l'application, sans rechargement"
        icon="📐"
        iconTone="clay"
      >
        <div className="stack">
          <UnitSelector value={state.units} onChange={(u) => setUnits(u as UnitMode)} block />

          <div className="grid grid--3">
            {UNIT_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`activity-card${state.units === m.id ? ' spot-item--active' : ''}`}
                aria-pressed={state.units === m.id}
                onClick={() => setUnits(m.id)}
              >
                <span className="activity-card__label">{m.label}</span>
                <span className="activity-card__tag">{m.hint}</span>
                <span className="chip chip--forest" style={{ marginTop: 6 }}>
                  {m.id === 'standard' ? 'km · km/h' : m.id === 'nautical' ? 'NM · kn' : 'km / NM'}
                </span>
              </button>
            ))}
          </div>

          <hr className="divider" />

          <span className="field__label">Aperçu immédiat</span>
          <div className="grid grid--3">
            <div className="metric metric--accent">
              <div className="metric__label">Distance (exemple 12,4 km)</div>
              <div className="metric__value" style={{ fontSize: 'var(--t-lg)' }}>
                {formatDistance(SAMPLE_DISTANCE_KM, state.units)}
              </div>
            </div>
            <div className="metric metric--water">
              <div className="metric__label">Vent (exemple 24 km/h)</div>
              <div className="metric__value" style={{ fontSize: 'var(--t-lg)' }}>
                {formatSpeed(SAMPLE_WIND_KMH, state.units)}
              </div>
            </div>
            <div className="metric metric--clay">
              <div className="metric__label">Hauteur de houle</div>
              <div className="metric__value" style={{ fontSize: 'var(--t-lg)' }}>
                2,1 m
              </div>
              <div className="metric__sub">Toujours en mètres, quel que soit le mode</div>
            </div>
          </div>

          <Notice tone="info" title="Valeurs sources préservées">
            Les données remontées par les API sont conservées dans leur unité d’origine
            (km/h, °C, hPa, m). La conversion est effectuée uniquement au moment de l’affichage :
            la valeur source n’est jamais modifiée.
          </Notice>

          <div className="row row--wrap" style={{ gap: 8 }}>
            <Chip tone="forest">1 NM = 1,852 km</Chip>
            <Chip tone="water">1 kn = 1,852 km/h</Chip>
            <Chip tone="neutral">Arrondis homogènes dans toute l’application</Chip>
          </div>
        </div>
      </Card>

      <Card title="Ce que couvre chaque mode" icon="📋" iconTone="sky">
        <div className="table-wrap">
          <table className="table table--cards">
            <thead>
              <tr>
                <th>Grandeur</th>
                <th>Standard</th>
                <th>Nautique</th>
                <th>Double</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Distance', 'km', 'NM', 'km / NM'],
                ['Vitesse du vent', 'km/h', 'kn', 'km/h / kn'],
                ['Température', '°C', '°C', '°C'],
                ['Pression', 'hPa', 'hPa', 'hPa'],
                ['Hauteur de houle / vague', 'm', 'm', 'm'],
                ['Profondeur', 'm', 'm', 'm'],
                ['Hauteur d’eau (hydrologie)', 'm', 'm', 'm'],
              ].map(([g, s, n, d]) => (
                <tr key={g}>
                  <td data-label="Grandeur" className="strong">
                    {g}
                  </td>
                  <td data-label="Standard">{s}</td>
                  <td data-label="Nautique">{n}</td>
                  <td data-label="Double">{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/**
 * Frais de déplacement — §15.
 * Distance départ → spot, puis tableau carburant / péages / hébergement /
 * autres / total. Les paramètres sont modifiables par l'utilisateur.
 */

import { useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Metric } from '@/components/ui/Metric';
import { Notice } from '@/components/ui/Notice';
import { formatDuration } from '@/core/geo';
import { formatEuro, formatNumber, formatNumber as fmtNum } from '@/core/format';
import { formatDistance } from '@/core/units';
import type { CostBreakdown, CostSettings, UnitMode } from '@/types';

interface Props {
  distanceKm: number | null;
  trip: { distanceKm: number; durationMinutes: number } | null;
  costs: CostSettings;
  units: UnitMode;
  onChange: (patch: Partial<CostSettings>) => void;
  originLabel: string | null;
}

export function computeCosts(
  distanceKm: number | null,
  costs: CostSettings,
  useDrivingDistance: boolean,
): CostBreakdown {
  if (distanceKm == null) {
    return { distanceKm: NaN, fuel: null, tolls: null, lodging: null, other: null, total: null };
  }
  const base = useDrivingDistance ? distanceKm : distanceKm;
  const fuel = (base / 100) * costs.consumptionL100 * costs.fuelPricePerL;
  const tolls = costs.tolls || null;
  const lodging = costs.lodging || null;
  const other = costs.other || null;
  const total = fuel + (tolls ?? 0) + (lodging ?? 0) + (other ?? 0);
  return { distanceKm: base, fuel, tolls, lodging, other, total };
}

export function Frais({ distanceKm, trip, costs, units, onChange, originLabel }: Props) {
  const breakdown = useMemo(
    () => computeCosts(trip?.distanceKm ?? distanceKm, costs, costs.useDrivingDistance),
    [trip, distanceKm, costs],
  );

  if (distanceKm == null) {
    return (
      <Card title="Frais de déplacement" icon="🚗" iconTone="clay">
        <Notice tone="info" title="Position de départ non définie">
          Renseignez votre position à l’étape 1 pour obtenir la distance, la durée estimée et
          l’estimation des frais.
        </Notice>
      </Card>
    );
  }

  return (
    <Card
      title="Frais de déplacement"
      subtitle={originLabel ? `Depuis ${originLabel}` : undefined}
      icon="🚗"
      iconTone="clay"
      footer={
        <>
          <span>Durée et distance sont des estimations à vol d’oiseau majorées d’un coefficient de routage (×1,25).</span>
        </>
      }
    >
      <div className="stack">
        <div className="grid grid--3">
          <Metric
            label="Distance"
            value={formatDistance(trip?.distanceKm ?? distanceKm, units)}
            sub={`${fmtNum(distanceKm, 1)} km à vol d’oiseau`}
            tone="clay"
            icon="📏"
          />
          <Metric
            label="Durée estimée"
            value={trip ? formatDuration(trip.durationMinutes) : '—'}
            sub="À 70 km/h en moyenne"
            tone="forest"
            icon="⏱️"
          />
          <Metric
            label="Total estimé"
            value={formatEuro(breakdown.total)}
            sub="Carburant + frais annexes"
            tone="water"
            icon="💶"
          />
        </div>

        <div className="table-wrap">
          <table className="cost-table">
            <thead>
              <tr>
                <th>Poste</th>
                <th className="num">Valeur</th>
                <th className="num">Réglage</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Distance</td>
                <td className="num strong">{formatDistance(trip?.distanceKm ?? distanceKm, units)}</td>
                <td className="num u-dim" style={{ fontSize: 'var(--t-xs)' }}>
                  calculée
                </td>
              </tr>
              <tr>
                <td>Carburant</td>
                <td className="num strong">{formatEuro(breakdown.fuel)}</td>
                <td className="num">
                  <span className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                    <input
                      className="cost-input"
                      type="number"
                      min={0}
                      max={40}
                      step={0.1}
                      value={costs.consumptionL100}
                      onChange={(e) => onChange({ consumptionL100: clamp(Number(e.target.value), 0, 40) })}
                      aria-label="Consommation pour 100 km"
                    />
                    <span className="u-dim" style={{ fontSize: 'var(--t-xs)' }}>L/100</span>
                    <input
                      className="cost-input"
                      type="number"
                      min={0}
                      max={10}
                      step={0.01}
                      value={costs.fuelPricePerL}
                      onChange={(e) => onChange({ fuelPricePerL: clamp(Number(e.target.value), 0, 10) })}
                      aria-label="Prix du carburant par litre"
                    />
                    <span className="u-dim" style={{ fontSize: 'var(--t-xs)' }}>€/L</span>
                  </span>
                </td>
              </tr>
              <tr>
                <td>Péages</td>
                <td className="num strong">{formatEuro(breakdown.tolls)}</td>
                <td className="num">
                  <input
                    className="cost-input"
                    type="number"
                    min={0}
                    step={0.5}
                    value={costs.tolls}
                    onChange={(e) => onChange({ tolls: clamp(Number(e.target.value), 0, 100000) })}
                    aria-label="Péages"
                  />
                </td>
              </tr>
              <tr>
                <td>Hébergement</td>
                <td className="num strong">{formatEuro(breakdown.lodging)}</td>
                <td className="num">
                  <input
                    className="cost-input"
                    type="number"
                    min={0}
                    step={5}
                    value={costs.lodging}
                    onChange={(e) => onChange({ lodging: clamp(Number(e.target.value), 0, 100000) })}
                    aria-label="Hébergement"
                  />
                </td>
              </tr>
              <tr>
                <td>Autres frais</td>
                <td className="num strong">{formatEuro(breakdown.other)}</td>
                <td className="num">
                  <input
                    className="cost-input"
                    type="number"
                    min={0}
                    step={5}
                    value={costs.other}
                    onChange={(e) => onChange({ other: clamp(Number(e.target.value), 0, 100000) })}
                    aria-label="Autres frais"
                  />
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td>Total estimé</td>
                <td className="num">{formatEuro(breakdown.total)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        <label className="toggle">
          <input
            type="checkbox"
            checked={costs.useDrivingDistance}
            onChange={(e) => onChange({ useDrivingDistance: e.target.checked })}
          />
          <span className="toggle__track" aria-hidden="true" />
          <span>
            Utiliser la distance routière estimée ({formatNumber(breakdown.distanceKm, 1)} km) pour le
            calcul du carburant
          </span>
        </label>
      </div>
    </Card>
  );
}

function clamp(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, v));
}

/**
 * Hydrologie — §12 (pêche en eau douce).
 * Stations hydrologiques les plus proches : nom, distance, hauteur d'eau,
 * débit, date/heure du relevé, évolution sur 24 h.
 */

import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Notice, LoadingBlock } from '@/components/ui/Notice';
import { SourceList } from '@/components/ui/SourceLink';
import { formatDateTime, formatNumber, formatRelative } from '@/core/format';
import { formatDistance } from '@/core/units';
import { hydrologySources } from '@/services/hydrology';
import type { HydrologyData, UnitMode } from '@/types';

interface TimeContext {
  timezone: string;
  utcOffsetSeconds: number;
}

interface Props {
  hydrology: HydrologyData | null;
  loading: boolean;
  error: string | null;
  units: UnitMode;
  timeContext: TimeContext;
  onStationSelect?: (station: HydrologyData['stations'][number]) => void;
}

export function Hydrologie({ hydrology, loading, error, units, timeContext }: Props) {
  if (loading) {
    return (
      <Card title="Stations hydrologiques" icon="💧" iconTone="water">
        <LoadingBlock lines={4} />
      </Card>
    );
  }

  if (!hydrology?.available) {
    return (
      <Card
        title="Stations hydrologiques"
        icon="💧"
        iconTone="water"
        footer={<span>Source : Hub’Eau — API Hydrométrie (réseau français)</span>}
      >
        <Notice tone="warn" title="Aucune station hydrologique disponible">
          {error ??
            hydrology?.unavailableReason ??
            'Aucune station du réseau national à proximité de ce spot.'}
          <div style={{ marginTop: 8 }}>
            <a className="btn btn--sm" href={hydrologySources.vigicrues.url} target="_blank" rel="noreferrer noopener">
              Consulter Vigicrues ↗
            </a>
          </div>
        </Notice>
      </Card>
    );
  }

  const stations = hydrology.stations;

  return (
    <div className="stack">
      <Card
        title="Stations hydrologiques"
        subtitle={`${stations.length} station${stations.length > 1 ? 's' : ''} la ou les plus proche${
          stations.length > 1 ? 's' : ''
        } du spot`}
        icon="💧"
        iconTone="water"
        actions={
          <Chip tone="ok" dot pulse>
            {formatRelative(hydrology.updatedAt ?? hydrology.fetchedAt)}
          </Chip>
        }
        footer={
          <>
            <span>{hydrology.updateFrequency}</span>
            <span>· Sélection géographique par rapport au spot</span>
          </>
        }
      >
        <div className="table-wrap">
          <table className="table table--cards">
            <thead>
              <tr>
                <th>Station</th>
                <th>Cours d’eau</th>
                <th className="num">Distance</th>
                <th className="num">Hauteur d’eau</th>
                <th className="num">Débit</th>
                <th className="num">Évolution 24 h</th>
                <th>Dernier relevé</th>
              </tr>
            </thead>
            <tbody>
              {stations.map((s) => (
                <tr key={s.code}>
                  <td data-label="Station" className="strong">
                    {s.label}
                    {s.commune && <div className="u-dim" style={{ fontSize: 'var(--t-xs)', fontWeight: 400 }}>{s.commune}</div>}
                  </td>
                  <td data-label="Cours d’eau">{s.river ?? '—'}</td>
                  <td data-label="Distance" className="num">
                    {formatDistance(s.distanceKm, units)}
                  </td>
                  <td data-label="Hauteur d’eau" className="num strong">
                    {s.heightM != null ? `${formatNumber(s.heightM, 2)} m` : '—'}
                  </td>
                  <td data-label="Débit" className="num">
                    {s.dischargeM3s != null ? `${formatNumber(s.dischargeM3s, 1)} m³/s` : '—'}
                  </td>
                  <td data-label="Évolution 24 h" className="num">
                    {s.heightTrend24h != null ? (
                      <span style={{ color: s.heightTrend24h > 0.01 ? 'var(--water-700)' : s.heightTrend24h < -0.01 ? 'var(--clay-600)' : 'var(--ink-500)' }}>
                        {s.heightTrend24h > 0 ? '+' : ''}
                        {formatNumber(s.heightTrend24h, 2)} m
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td data-label="Dernier relevé">
                    {s.lastObsAt ? formatDateTime(s.lastObsAt, timeContext) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {stations.every((s) => s.heightM == null && s.dischargeM3s == null) && (
          <div style={{ marginTop: 'var(--gap-4)' }}>
            <Notice tone="info">
              Ces stations sont référencées mais ne publient pas d’observation en temps réel.
              Aucune valeur n’est estimée à leur place.
            </Notice>
          </div>
        )}
      </Card>

      <Card title="Sources des données" icon="🔗" iconTone="forest" tight>
        <SourceList
          sources={[
            {
              label: hydrologySources.hubeau.label,
              url: hydrologySources.hubeau.url,
              role: hydrologySources.hubeau.role,
              freshness: 'realtime',
              freshnessLabel: hydrology.updateFrequency,
              updatedAt: hydrology.updatedAt,
            },
            {
              label: hydrologySources.vigicrues.label,
              url: hydrologySources.vigicrues.url,
              role: hydrologySources.vigicrues.role,
              freshness: 'realtime',
              freshnessLabel: hydrologySources.vigicrues.freshnessLabel,
              updatedAt: null,
            },
          ]}
        />
        <p className="u-dim" style={{ fontSize: 'var(--t-xs)', marginTop: 8 }}>
          Données diffusées sous Licence Ouverte Etalab 2.0. La hauteur d’eau est exprimée à
          l’échelle de la station ; elle n’est pas directement transposable au niveau du spot.
        </p>
      </Card>
    </div>
  );
}

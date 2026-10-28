/**
 * Évolution détaillée de la journée (§8) — température, vent, rafales,
 * probabilité de pluie heure par heure.
 */

import { useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Notice, LoadingBlock } from '@/components/ui/Notice';
import { LineChart, type Series } from '@/components/charts/LineChart';
import { formatTime, formatNumber } from '@/core/format';
import { formatSpeed, formatSpeedValue } from '@/core/units';
import { isoDateIn } from '@/core/format';
import type { UnitMode, WeatherData } from '@/types';

interface Props {
  weather: WeatherData | null;
  loading: boolean;
  error: string | null;
  units: UnitMode;
  timeContext: { timezone: string; utcOffsetSeconds: number };
}

export function Journee({ weather, loading, error, units, timeContext }: Props) {
  const todayIso = isoDateIn(new Date(), timeContext);

  const { points, labels, nowIndex } = useMemo(() => {
    if (!weather) return { points: [] as WeatherData['hourly'], labels: [] as string[], nowIndex: null as number | null };
    const dayPoints = weather.hourly.filter((p) => isoDateIn(new Date(p.time), timeContext) === todayIso);
    const used = dayPoints.length >= 6 ? dayPoints : weather.hourly.slice(0, 24);
    const labels = used.map((p) => formatTime(p.time, timeContext));
    const nowT = Date.now();
    let idx: number | null = null;
    let bestD = Infinity;
    used.forEach((p, i) => {
      const d = Math.abs(new Date(p.time).getTime() - nowT);
      if (d < bestD) {
        bestD = d;
        idx = i;
      }
    });
    return { points: used, labels, nowIndex: idx };
  }, [weather, timeContext, todayIso]);

  if (loading) {
    return (
      <Card title="Évolution de la journée" icon="📈" iconTone="clay">
        <LoadingBlock lines={4} />
      </Card>
    );
  }

  if (error || !weather) {
    return (
      <Card title="Évolution de la journée" icon="📈" iconTone="clay">
        <Notice tone="warn" title="Évolution indisponible">
          {error ?? 'Donnée non disponible pour ce spot.'}
        </Notice>
      </Card>
    );
  }

  if (points.length === 0) {
    return (
      <Card title="Évolution de la journée" icon="📈" iconTone="clay">
        <Notice tone="warn">Aucune donnée horaire pour aujourd’hui.</Notice>
      </Card>
    );
  }

  const series: Series[] = [
    {
      key: 'temp',
      label: 'Température',
      color: 'var(--clay-500)',
      values: points.map((p) => p.temperature),
      area: true,
    },
    {
      key: 'ressenti',
      label: 'Ressenti',
      color: 'var(--clay-400)',
      values: points.map((p) => p.apparentTemperature),
      width: 1.4,
      dashed: true,
    },
    {
      key: 'vent',
      label: `Vent (${units === 'nautical' ? 'kn' : 'km/h'})`,
      color: 'var(--forest-500)',
      values: points.map((p) => p.windSpeed),
      area: true,
      width: 1.8,
    },
    {
      key: 'rafales',
      label: `Rafales (${units === 'nautical' ? 'kn' : 'km/h'})`,
      color: 'var(--water-600)',
      values: points.map((p) => p.windGusts),
      width: 1.4,
      dashed: true,
    },
  ];

  // Résumé de la journée
  const temps = points.map((p) => p.temperature).filter((v): v is number => v != null);
  const gusts = points.map((p) => p.windGusts).filter((v): v is number => v != null);
  const probs = points.map((p) => p.precipitationProbability).filter((v): v is number => v != null);

  return (
    <Card
      title="Évolution de la journée"
      subtitle={`${points.length} relevés horaires — heure du spot`}
      icon="📈"
      iconTone="clay"
      actions={
        <>
          {temps.length > 0 && (
            <Chip tone="clay">
              {formatNumber(Math.min(...temps), 1)} → {formatNumber(Math.max(...temps), 1)} °C
            </Chip>
          )}
          {gusts.length > 0 && (
            <Chip tone="water">Rafales max {formatSpeed(Math.max(...gusts), units)}</Chip>
          )}
        </>
      }
      footer={
        <>
          <span>
            Plage {points[0] ? formatTime(points[0].time, timeContext) : '—'} →{' '}
            {points[points.length - 1] ? formatTime(points[points.length - 1].time, timeContext) : '—'}
          </span>
          {probs.length > 0 && (
            <span>· Probabilité de pluie max {formatNumber(Math.max(...probs), 0)} %</span>
          )}
        </>
      }
    >
      <LineChart
        labels={labels}
        series={series}
        height={220}
        unit={units === 'nautical' ? 'kn / °C' : 'km/h / °C'}
        formatY={(v) => v.toFixed(0)}
        highlightIndex={nowIndex}
        xTicks={7}
      />

      <div className="table-wrap" style={{ marginTop: 'var(--gap-4)' }}>
        <table className="table table--cards">
          <thead>
            <tr>
              <th>Heure</th>
              <th className="num">Temp.</th>
              <th className="num">Ressenti</th>
              <th className="num">Vent</th>
              <th className="num">Rafales</th>
              <th>Dir.</th>
              <th className="num">Pluie</th>
              <th className="num">Nuages</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p, i) => (
              <tr key={p.time} data-now={i === nowIndex ? 'true' : undefined}>
                <td data-label="Heure" className="strong">
                  {formatTime(p.time, timeContext)}
                </td>
                <td data-label="Température" className="num">
                  {p.temperature != null ? `${formatNumber(p.temperature, 1)} °C` : '—'}
                </td>
                <td data-label="Ressenti" className="num u-dim">
                  {p.apparentTemperature != null ? `${formatNumber(p.apparentTemperature, 1)} °C` : '—'}
                </td>
                <td data-label="Vent" className="num">
                  {formatSpeed(p.windSpeed ?? NaN, units).replace(/ (km\/h|kn)/, '')}
                </td>
                <td data-label="Rafales" className="num">
                  {p.windGusts != null ? formatSpeedValue(p.windGusts, units) : '—'}
                </td>
                <td data-label="Direction">{p.windDirection != null ? `${Math.round(p.windDirection)}°` : '—'}</td>
                <td data-label="Pluie" className="num">
                  {p.precipitationProbability != null ? `${formatNumber(p.precipitationProbability, 0)} %` : '—'}
                </td>
                <td data-label="Nuages" className="num u-dim">
                  {p.cloudCover != null ? `${formatNumber(p.cloudCover, 0)} %` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

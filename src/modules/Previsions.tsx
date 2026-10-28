/**
 * Prévisions — §8 (5 jours) et §13.
 * Résumé quotidien + graphique comparatif des températures et du vent.
 */

import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Notice, LoadingBlock } from '@/components/ui/Notice';
import { BarChart } from '@/components/charts/BarChart';
import { LineChart, type Series } from '@/components/charts/LineChart';
import { formatDateShort, formatTime, formatWeekday, formatNumber } from '@/core/format';
import { formatSpeed, formatSpeedValue } from '@/core/units';
import { weatherCodeInfo } from '@/services/weather';
import type { UnitMode, WeatherData } from '@/types';

interface TimeContext {
  timezone: string;
  utcOffsetSeconds: number;
}

interface Props {
  weather: WeatherData | null;
  loading: boolean;
  error: string | null;
  units: UnitMode;
  timeContext: TimeContext;
  /** Nombre de jours affichés (5 par défaut). */
  days?: number;
}

export function Previsions({ weather, loading, error, units, timeContext, days = 5 }: Props) {
  if (loading) {
    return (
      <Card title={`Prévisions ${days} jours`} icon="📅" iconTone="sky">
        <LoadingBlock lines={4} />
      </Card>
    );
  }

  if (error || !weather) {
    return (
      <Card title={`Prévisions ${days} jours`} icon="📅" iconTone="sky">
        <Notice tone="warn" title="Prévisions indisponibles">
          {error ?? 'Donnée non disponible pour ce spot.'}
        </Notice>
      </Card>
    );
  }

  const daily = weather.daily.filter((d) => d.temperatureMax != null || d.temperatureMin != null).slice(0, days);

  if (daily.length === 0) {
    return (
      <Card title={`Prévisions ${days} jours`} icon="📅" iconTone="sky">
        <Notice tone="warn">Aucune prévision journalière disponible.</Notice>
      </Card>
    );
  }

  const speedUnitLabel = units === 'nautical' ? 'kn' : 'km/h';

  return (
    <Card
      title={`Prévisions ${daily.length} jours`}
      subtitle="Températures, vent, rafales, pluie et ensoleillement"
      icon="📅"
      iconTone="sky"
      actions={
        <Chip tone="sky" dot pulse>
          {formatRelative(weather.fetchedAt)}
        </Chip>
      }
      footer={
        <>
          <span>Modèle : {weather.model}</span>
          <span>· Prévisions calculées pour les coordonnées du spot</span>
        </>
      }
    >
      <div className="stack">
        <div className="table-wrap">
          <table className="table table--cards">
            <thead>
              <tr>
                <th>Jour</th>
                <th className="num">Min</th>
                <th className="num">Max</th>
                <th className="num">Vent max</th>
                <th className="num">Rafales</th>
                <th>Dir.</th>
                <th className="num">Pluie</th>
                <th className="num">UV</th>
                <th>Soleil</th>
              </tr>
            </thead>
            <tbody>
              {daily.map((d) => {
                const info = weatherCodeInfo(d.weatherCode);
                return (
                  <tr key={d.date}>
                    <td data-label="Jour" className="strong">
                      {formatWeekday(d.date, timeContext)}
                      <div className="u-dim" style={{ fontSize: 'var(--t-xs)', fontWeight: 400 }}>
                        {formatDateShort(d.date, timeContext)}
                      </div>
                    </td>
                    <td data-label="Min" className="num">
                      {d.temperatureMin != null ? `${formatNumber(d.temperatureMin, 1)} °C` : '—'}
                    </td>
                    <td data-label="Max" className="num strong">
                      {d.temperatureMax != null ? `${formatNumber(d.temperatureMax, 1)} °C` : '—'}
                    </td>
                    <td data-label="Vent max" className="num">
                      {d.windSpeedMax != null ? formatSpeed(d.windSpeedMax, units) : '—'}
                    </td>
                    <td data-label="Rafales" className="num">
                      {d.windGustsMax != null ? formatSpeed(d.windGustsMax, units) : '—'}
                    </td>
                    <td data-label="Direction">
                      {d.windDirectionDominant != null ? `${Math.round(d.windDirectionDominant)}°` : '—'}
                    </td>
                    <td data-label="Pluie" className="num">
                      {d.precipitationProbabilityMax != null
                        ? `${formatNumber(d.precipitationProbabilityMax, 0)} %`
                        : d.precipitationSum != null
                          ? `${formatNumber(d.precipitationSum, 1)} mm`
                          : '—'}
                    </td>
                    <td data-label="UV" className="num">
                      {d.uvIndexMax != null ? formatNumber(d.uvIndexMax, 1) : '—'}
                    </td>
                    <td data-label="Soleil">
                      <span title={info.label} aria-hidden="true">
                        {info.icon}
                      </span>
                      <span className="u-dim" style={{ fontSize: 'var(--t-xs)', marginLeft: 4 }}>
                        {d.sunrise ? formatTime(d.sunrise, timeContext) : '—'}
                        {' – '}
                        {d.sunset ? formatTime(d.sunset, timeContext) : '—'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="grid grid--2">
          <div className="stack stack--sm">
            <span className="field__label">Amplitude thermique (°C)</span>
            <BarChart
              height={160}
              unit="°C"
              color="var(--clay-400)"
              data={daily.map((d) => ({
                label: formatDateShort(d.date, timeContext).replace('.', ''),
                value: d.temperatureMax,
                caption: d.temperatureMax != null ? formatNumber(d.temperatureMax, 0) : undefined,
                subLabel: d.temperatureMin != null ? `min ${formatNumber(d.temperatureMin, 0)}` : undefined,
              }))}
            />
          </div>
          <div className="stack stack--sm">
            <span className="field__label">Vent maximal ({speedUnitLabel})</span>
            <BarChart
              height={160}
              unit={speedUnitLabel}
              color="var(--forest-400)"
              data={daily.map((d) => ({
                label: formatDateShort(d.date, timeContext).replace('.', ''),
                value: d.windSpeedMax != null ? (d.windSpeedMax / 1.852) : null,
                caption: d.windSpeedMax != null ? formatSpeedValue(d.windSpeedMax, units) : undefined,
              }))}
              formatValue={(v) => v.toFixed(0)}
            />
          </div>
        </div>

        {weather.hourly.length > 0 && <HourlyOutlook weather={weather} timeContext={timeContext} days={days} />}
      </div>
    </Card>
  );
}

function HourlyOutlook({
  weather,
  timeContext,
  days,
}: {
  weather: WeatherData;
  timeContext: TimeContext;
  days: number;
}) {
  const horizon = new Date(Date.now() + days * 86400000).getTime();
  const pts = weather.hourly.filter((p) => new Date(p.time).getTime() <= horizon);
  const step = Math.max(1, Math.ceil(pts.length / 48));
  const sampled = pts.filter((_, i) => i % step === 0).slice(0, 48);

  if (sampled.length < 3) return null;

  const series: Series[] = [
    {
      key: 'max',
      label: 'Température max',
      color: 'var(--clay-500)',
      values: sampled.map((p) => p.temperature),
      area: true,
    },
    {
      key: 'min',
      label: 'Température min',
      color: 'var(--water-500)',
      values: sampled.map((p) => p.apparentTemperature),
      width: 1.4,
      dashed: true,
    },
  ];

  return (
    <div className="stack stack--sm">
      <span className="field__label">Évolution synthétique — {days * 24} prochaines heures</span>
      <LineChart
        labels={sampled.map((p) => formatTime(p.time, timeContext))}
        series={series}
        height={170}
        unit="°C"
        formatY={(v) => v.toFixed(0)}
        xTicks={6}
      />
    </div>
  );
}

function formatRelative(iso: string): string {
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'à l’instant';
  if (diff < 3600) return `il y a ${Math.round(diff / 60)} min`;
  return `il y a ${Math.round(diff / 3600)} h`;
}

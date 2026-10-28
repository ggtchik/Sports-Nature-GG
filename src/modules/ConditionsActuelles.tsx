/**
 * Conditions actuelles — §8.
 * Affiche température, ressenti, couverture nuageuse, pluie, UV, pression,
 * vent moyen, rafales, direction. Jamais de donnée inventée : toute valeur
 * absente est signalée.
 */

import { Card } from '@/components/ui/Card';
import { Metric, MetricGrid } from '@/components/ui/Metric';
import { Chip } from '@/components/ui/Chip';
import { Notice, LoadingBlock } from '@/components/ui/Notice';
import { WindArrow } from '@/components/charts/WindArrow';
import { weatherCodeInfo } from '@/services/weather';
import { formatDateTime, formatRelative, formatNumber } from '@/core/format';
import {
  formatPercent,
  formatPressure,
  formatSpeed,
  formatTemperature,
} from '@/core/units';
import type { UnitMode, WeatherData } from '@/types';

interface Props {
  weather: WeatherData | null;
  loading: boolean;
  error: string | null;
  units: UnitMode;
  timeContext: { timezone: string; utcOffsetSeconds: number };
  marine?: { seaSurfaceTemperature: number | null } | null;
}

export function ConditionsActuelles({ weather, loading, error, units, timeContext, marine }: Props) {
  const code = weatherCodeInfo(weather?.current.weatherCode ?? null);
  const missing: string[] = [];
  if (weather) {
    if (weather.current.temperature == null) missing.push('température');
    if (weather.current.windSpeed == null) missing.push('vent');
    if (weather.current.pressureMsl == null) missing.push('pression');
  }

  return (
    <Card
      title="Conditions actuelles"
      subtitle={weather ? `Relevé ${formatDateTime(weather.current.time, timeContext)} (heure du spot)` : undefined}
      icon="🌤️"
      iconTone="sky"
      actions={
        weather && (
          <Chip tone="ok" dot pulse>
            {formatRelative(weather.fetchedAt)}
          </Chip>
        )
      }
      footer={
        weather && (
          <>
            <span>Modèle : {weather.model}</span>
            {weather.elevation != null && <span>· Altitude du point : {weather.elevation} m</span>}
          </>
        )
      }
    >
      {loading && <LoadingBlock lines={4} />}
      {!loading && error && (
        <Notice tone="danger" title="Météo indisponible">
          {error} La donnée n’est pas estimée ni remplacée.
        </Notice>
      )}
      {!loading && !error && !weather && (
        <Notice tone="info">Sélectionnez un spot pour afficher les conditions.</Notice>
      )}

      {!loading && !error && weather && (
        <div className="stack">
          <div className="row row--wrap" style={{ gap: 8 }}>
            <Chip tone="sky" size="lg">
              <span aria-hidden="true">{code.icon}</span> {code.label}
            </Chip>
            {weather.current.isDay === false && <Chip tone="neutral">🌙 Nuit</Chip>}
            {marine?.seaSurfaceTemperature != null && (
              <Chip tone="water">🌊 Eau {formatTemperature(marine.seaSurfaceTemperature)}</Chip>
            )}
            {missing.length > 0 && (
              <Chip tone="warn" title="La source ne fournit pas ces valeurs">
                Non disponible : {missing.join(', ')}
              </Chip>
            )}
          </div>

          <MetricGrid cols={4}>
            <Metric
              label="Température"
              value={formatTemperature(weather.current.temperature ?? NaN)}
              sub={
                weather.current.apparentTemperature != null
                  ? `Ressenti ${formatTemperature(weather.current.apparentTemperature)}`
                  : 'Ressenti non fourni'
              }
              tone="forest"
              icon="🌡️"
            />
            <Metric
              label="Vent moyen"
              value={formatSpeed(weather.current.windSpeed ?? NaN, units)}
              sub={
                weather.current.windGusts != null
                  ? `Rafales ${formatSpeed(weather.current.windGusts, units)}`
                  : 'Rafales non fournies'
              }
              tone="clay"
              icon="💨"
            />
            <Metric
              label="Pression"
              value={formatPressure(weather.current.pressureMsl ?? NaN)}
              sub="Niveau de la mer"
              icon="🧭"
            />
            <Metric
              label="Indice UV"
              value={weather.current.uvIndex != null ? formatNumber(weather.current.uvIndex, 1) : '—'}
              sub={uvLabel(weather.current.uvIndex)}
              icon="🔆"
            />
          </MetricGrid>

          <div className="split" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' }}>
            <div className="stack stack--sm">
              <span className="field__label">Direction du vent</span>
              <WindArrow
                directionDeg={weather.current.windDirection}
                speedLabel={
                  weather.current.windSpeed != null ? formatSpeed(weather.current.windSpeed, units) : null
                }
              />
            </div>
            <div className="stack stack--sm">
              <span className="field__label">Couverture nuageuse</span>
              <GaugeRow
                label="Nuages"
                value={weather.current.cloudCover}
                display={formatPercent(weather.current.cloudCover ?? NaN)}
                tone="sky"
              />
              <GaugeRow
                label="Probabilité de pluie"
                value={probabilityNow(weather)}
                display={
                  probabilityNow(weather) != null
                    ? formatPercent(probabilityNow(weather) as number)
                    : '—'
                }
                tone="water"
              />
              <GaugeRow
                label="Précipitations"
                value={
                  weather.current.precipitation != null
                    ? Math.min(100, weather.current.precipitation * 10)
                    : null
                }
                display={
                  weather.current.precipitation != null
                    ? `${formatNumber(weather.current.precipitation, 1)} mm`
                    : '—'
                }
                tone="forest"
              />
            </div>
          </div>

          {weather.current.humidity != null && (
            <div className="row row--wrap" style={{ gap: 8 }}>
              <Chip tone="neutral">Humidité {formatPercent(weather.current.humidity)}</Chip>
              {weather.current.rain != null && <Chip tone="water">Pluie {formatNumber(weather.current.rain, 1)} mm</Chip>}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function probabilityNow(weather: WeatherData): number | null {
  const t = new Date(weather.current.time).getTime();
  let best: number | null = null;
  let bestD = Infinity;
  for (const p of weather.hourly) {
    if (p.precipitationProbability == null) continue;
    const d = Math.abs(new Date(p.time).getTime() - t);
    if (d < bestD) {
      bestD = d;
      best = p.precipitationProbability;
    }
  }
  return best;
}

function uvLabel(uv: number | null): string {
  if (uv == null) return 'Non fourni';
  if (uv < 3) return 'Faible';
  if (uv < 6) return 'Modéré';
  if (uv < 8) return 'Élevé';
  if (uv < 11) return 'Très élevé';
  return 'Extrême';
}

interface GaugeRowProps {
  label: string;
  value: number | null;
  display: string;
  tone: 'forest' | 'water' | 'clay' | 'sky';
}

function GaugeRow({ label, value, display, tone }: GaugeRowProps) {
  return (
    <div className="gauge">
      <div className="row row--between">
        <span style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-600)' }}>{label}</span>
        <span className="u-num" style={{ fontSize: 'var(--t-sm)', fontWeight: 650, color: 'var(--ink-900)' }}>
          {display}
        </span>
      </div>
      <div className="gauge__track">
        <div
          className={`gauge__fill gauge__fill--${tone}`}
          style={{ width: `${value != null ? Math.max(0, Math.min(100, value)) : 0}%` }}
        />
      </div>
    </div>
  );
}

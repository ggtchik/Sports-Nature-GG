/**
 * Module maritime (§10 mer, §11, §13) — marées (pleine mer, basse mer,
 * horaires, hauteurs, coefficients), houle (hauteur, période, direction),
 * vagues (hauteur, direction), température de l'eau.
 *
 * Toutes les grandeurs suivent le sélecteur global d'unités : les hauteurs
 * restent en mètres, les vitesses de vent en km/h ou nœuds.
 */

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Metric, MetricGrid } from '@/components/ui/Metric';
import { Chip } from '@/components/ui/Chip';
import { Notice, LoadingBlock } from '@/components/ui/Notice';
import { TideCurve } from '@/components/charts/TideCurve';
import { WindArrow } from '@/components/charts/WindArrow';
import { SourceList } from '@/components/ui/SourceLink';
import { formatTime, formatDateShort, formatDateTime, formatNumber } from '@/core/format';
import { formatSpeed, distanceValue, distanceUnit } from '@/core/units';
import { directionLabel } from '@/core/geo';
import { tideSources } from '@/services/tides';
import type { MarineData, TideData, UnitMode } from '@/types';

interface TimeContext {
  timezone: string;
  utcOffsetSeconds: number;
}

interface Props {
  tides: TideData | null;
  marine: MarineData | null;
  loadingTides: boolean;
  loadingMarine: boolean;
  errorTides: string | null;
  errorMarine: string | null;
  units: UnitMode;
  timeContext: TimeContext;
  /** Distance du spot au port de référence (km), si fournie par la source. */
  portDistanceKm?: number | null;
  activity?: string | null;
}

export function Maritime({
  tides,
  marine,
  loadingTides,
  loadingMarine,
  errorTides,
  errorMarine,
  units,
  timeContext,
  portDistanceKm,
  activity,
}: Props) {
  const [showCurve, setShowCurve] = useState(true);
  const nowIso = new Date().toISOString();

  // Prochains extrêmes (les 6 prochains).
  const upcoming = (tides?.extrema ?? [])
    .filter((e) => new Date(e.time).getTime() >= Date.now() - 30 * 60000)
    .slice(0, 6);

  const nextExtremum = upcoming[0] ?? null;

  return (
    <div className="stack">
      {/* ---------------- Marées ---------------- */}
      <Card
        title="Marées"
        subtitle={
          tides?.portName
            ? `Port de référence : ${tides.portName}`
            : 'Pleines mers, basses mers, horaires, hauteurs et coefficients'
        }
        icon="🌊"
        iconTone="water"
        actions={
          <>
            {tides?.available && (
              <Chip tone={tides.kind === 'harmonic' ? 'ok' : 'warn'}>
                {tides.kind === 'harmonic' ? 'Atlas harmonique' : 'Modèle numérique'}
              </Chip>
            )}
            {tides?.available && tides.curve.length > 2 && (
              <button type="button" className="btn btn--sm btn--ghost" onClick={() => setShowCurve((v) => !v)}>
                {showCurve ? 'Masquer la courbe' : 'Afficher la courbe'}
              </button>
            )}
          </>
        }
        footer={
          tides?.available ? (
            <>
              <span>Référentiel vertical : {tides.datum}</span>
              {portDistanceKm != null && (
                <span>· Port à {formatNumber(portDistanceKm, 1)} km du spot</span>
              )}
            </>
          ) : undefined
        }
      >
        {loadingTides && <LoadingBlock lines={3} />}

        {!loadingTides && !tides?.available && (
          <Notice tone="warn" title="Marée indisponible">
            {errorTides ??
              tides?.unavailableReason ??
              'Aucune source de marée ne couvre cette position. Les horaires et hauteurs ne sont pas estimés.'}
            <div style={{ marginTop: 8 }}>
              <a className="btn btn--sm" href={tideSources.shom.url} target="_blank" rel="noreferrer noopener">
                Consulter l’annuaire officiel du SHOM ↗
              </a>
            </div>
          </Notice>
        )}

        {!loadingTides && tides?.available && (
          <div className="stack">
            {tides.kind === 'model' && (
              <Notice tone="warn" title="Marée modélisée — valeur indicative">
                Ces horaires et hauteurs sont déduits d’un modèle numérique de niveau marin
                (résolution ≈ 8 km). Ils ne remplacent pas l’annuaire de marée officiel du SHOM
                et sont impropres à la navigation. Les coefficients affichés sont des estimations
                dérivées du marnage.
              </Notice>
            )}

            <MetricGrid cols={4}>
              <Metric
                label={nextExtremum?.type === 'PM' ? 'Prochaine pleine mer' : 'Prochaine basse mer'}
                value={
                  nextExtremum ? (
                    <>
                      {formatTime(nextExtremum.time, timeContext)}
                      <small>{formatDateShort(nextExtremum.time, timeContext)}</small>
                    </>
                  ) : (
                    '—'
                  )
                }
                sub={nextExtremum ? `Hauteur ${formatNumber(nextExtremum.height, 2)} m` : undefined}
                tone="water"
                icon={nextExtremum?.type === 'PM' ? '⬆️' : '⬇️'}
              />
              <Metric
                label="Hauteur d’eau maintenant"
                value={tides.nowHeight != null ? formatNumber(tides.nowHeight, 2) : '—'}
                unit="m"
                sub={tides.trend ? `Marée ${tides.trend}` : undefined}
                tone="forest"
                icon="📏"
              />
              <Metric
                label="Coefficient"
                value={tides.coefficientNow != null ? formatNumber(tides.coefficientNow, 0) : '—'}
                sub={
                  tides.kind === 'model'
                    ? 'Estimation (modèle)'
                    : tides.coefficientNow != null
                      ? coefficientLabel(tides.coefficientNow)
                      : 'Non fourni'
                }
                tone="clay"
                icon="🌡️"
              />
              <Metric
                label="Marnage du jour"
                value={marnageDuJour(tides)}
                unit="m"
                sub="Écart pleine / basse mer"
                icon="↕️"
              />
            </MetricGrid>

            {showCurve && tides.curve.length > 2 && (
              <TideCurve
                points={tides.curve}
                extrema={tides.extrema}
                height={200}
                timeContext={timeContext}
                nowIso={nowIso}
              />
            )}

            {upcoming.length > 0 && (
              <div className="table-wrap">
                <table className="table table--cards">
                  <thead>
                    <tr>
                      <th>Jour</th>
                      <th>Heure</th>
                      <th>Type</th>
                      <th className="num">Hauteur</th>
                      <th className="num">Coefficient</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcoming.map((e, i) => (
                      <tr key={`${e.time}-${i}`} data-now={i === 0 ? 'true' : undefined}>
                        <td data-label="Jour">{formatDateShort(e.time, timeContext)}</td>
                        <td data-label="Heure" className="strong">
                          {formatTime(e.time, timeContext)}
                        </td>
                        <td data-label="Type">{e.type === 'PM' ? 'Pleine mer' : 'Basse mer'}</td>
                        <td data-label="Hauteur" className="num">
                          {formatNumber(e.height, 2)} m
                        </td>
                        <td data-label="Coefficient" className="num">
                          {e.coefficient != null ? formatNumber(e.coefficient, 0) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ---------------- État de la mer ---------------- */}
      <Card
        title="Houle et vagues"
        subtitle="Hauteur, période et direction"
        icon="🌬️"
        iconTone="water"
        actions={
          marine?.available && (
            <Chip tone="water" dot pulse>
              {formatRelative(marine.fetchedAt)}
            </Chip>
          )
        }
        footer={
          marine?.available ? (
            <span>
              Modèle à 0,08° (≈ 8 km) : précision limitée à proximité immédiate des côtes — ne
              remplace pas un bulletin officiel.
            </span>
          ) : undefined
        }
      >
        {loadingMarine && <LoadingBlock lines={3} />}

        {!loadingMarine && (!marine?.available || errorMarine) && (
          <Notice tone="warn" title="Données marines indisponibles">
            {errorMarine ?? marine?.unavailableReason ?? 'Position hors couverture du modèle marine.'}
          </Notice>
        )}

        {!loadingMarine && marine?.available && (
          <div className="stack">
            <MetricGrid cols={4}>
              <Metric
                label="Houle"
                value={marine.current.waveHeight != null ? formatNumber(marine.current.waveHeight, 1) : '—'}
                unit="m"
                sub={
                  marine.current.wavePeriod != null
                    ? `Période ${formatNumber(marine.current.wavePeriod, 0)} s`
                    : 'Période non fournie'
                }
                tone="water"
                icon="🌊"
              />
              <Metric
                label="Vague"
                value={marine.current.swellWaveHeight != null ? formatNumber(marine.current.swellWaveHeight, 1) : '—'}
                unit="m"
                sub={
                  marine.current.swellWavePeriod != null
                    ? `Période ${formatNumber(marine.current.swellWavePeriod, 0)} s`
                    : 'Non fournie'
                }
                icon="〰️"
              />
              <Metric
                label="Houle de vent"
                value={marine.current.windWaveHeight != null ? formatNumber(marine.current.windWaveHeight, 1) : '—'}
                unit="m"
                sub={
                  marine.current.windWavePeriod != null
                    ? `Période ${formatNumber(marine.current.windWavePeriod, 0)} s`
                    : 'Non fournie'
                }
                icon="💨"
              />
              <Metric
                label="Température de l’eau"
                value={
                  marine.current.seaSurfaceTemperature != null
                    ? formatNumber(marine.current.seaSurfaceTemperature, 1)
                    : '—'
                }
                unit="°C"
                sub="Surface"
                tone="clay"
                icon="🌡️"
              />
            </MetricGrid>

            <div className="grid grid--2">
              <div className="stack stack--sm">
                <span className="field__label">Direction de la houle</span>
                <WindArrow
                  directionDeg={marine.current.swellWaveDirection ?? marine.current.waveDirection}
                  speedLabel={null}
                  label="Houle"
                />
                <span className="u-dim" style={{ fontSize: 'var(--t-xs)' }}>
                  {marine.current.swellWaveDirection != null
                    ? `Houle de ${directionLabel(marine.current.swellWaveDirection)}`
                    : 'Direction non fournie'}
                </span>
              </div>
              <div className="stack stack--sm">
                <span className="field__label">Direction des vagues</span>
                <WindArrow
                  directionDeg={marine.current.waveDirection}
                  speedLabel={null}
                  label="Vagues"
                />
                <span className="u-dim" style={{ fontSize: 'var(--t-xs)' }}>
                  {marine.current.waveDirection != null
                    ? `Vagues de ${directionLabel(marine.current.waveDirection)}`
                    : 'Direction non fournie'}
                </span>
              </div>
            </div>

            {marine.hourly.length > 0 && (
              <SwellEvolution marine={marine} units={units} timeContext={timeContext} />
            )}

            {(marine.current.oceanCurrentVelocity != null ||
              marine.current.oceanCurrentDirection != null) && (
              <div className="row row--wrap" style={{ gap: 8 }}>
                <Chip tone="water">
                  Courant{' '}
                  {marine.current.oceanCurrentVelocity != null
                    ? formatSpeed(marine.current.oceanCurrentVelocity, units)
                    : 'vitesse non fournie'}
                  {marine.current.oceanCurrentDirection != null
                    ? ` · ${directionLabel(marine.current.oceanCurrentDirection)}`
                    : ''}
                </Chip>
              </div>
            )}
          </div>
        )}
      </Card>

      <Card title="Sources des données" icon="🔗" iconTone="forest" tight>
        <SourceList
          sources={[
            {
              label: tides?.kind === 'harmonic' ? tideSources.apiMaree.label : tideSources.openMeteoMarine.label,
              url: tides?.kind === 'harmonic' ? tideSources.apiMaree.url : tideSources.openMeteoMarine.url,
              role: tides?.kind === 'harmonic' ? tideSources.apiMaree.role : tideSources.openMeteoMarine.role,
              freshness: tides?.kind === 'harmonic' ? 'realtime' : 'delayed',
              freshnessLabel: tides?.kind === 'harmonic' ? tideSources.apiMaree.freshnessLabel : tideSources.openMeteoMarine.freshnessLabel,
              updatedAt: null,
              note: tides?.kind === 'harmonic' ? tideSources.apiMaree.note : tideSources.openMeteoMarine.note,
            },
            {
              label: tideSources.shom.label,
              url: tideSources.shom.url,
              role: tideSources.shom.role,
              freshness: 'realtime',
              freshnessLabel: tideSources.shom.freshnessLabel,
              updatedAt: null,
            },
            {
              label: 'Open-Meteo — Marine Weather API',
              url: 'https://open-meteo.com/en/docs/marine-weather-api',
              role: 'Houle, vagues, température de l’eau, courants',
              freshness: 'delayed',
              freshnessLabel: 'Modèles mis à jour toutes les 6 à 24 h',
              updatedAt: null,
            },
          ]}
        />
        {activity === 'natation' && (
          <p className="u-dim" style={{ fontSize: 'var(--t-xs)', marginTop: 8 }}>
            Les températures d’eau et de l’air, l’indice UV et les prévisions météo figurent dans
            les modules « Conditions actuelles » et « Prévisions ».
          </p>
        )}
      </Card>
    </div>
  );
}

function SwellEvolution({
  marine,
  units,
  timeContext,
}: {
  marine: MarineData;
  units: UnitMode;
  timeContext: TimeContext;
}) {
  // 48 prochaines heures, un point toutes les 3 h.
  const pts = marine.hourly.filter((_, i) => i % 3 === 0).slice(0, 16);
  return (
    <div className="stack stack--sm">
      <span className="field__label">Évolution de la houle (48 h)</span>
      <TideCurve
        points={pts
          .filter((p) => p.waveHeight != null)
          .map((p) => ({ time: p.time, height: p.waveHeight as number }))}
        extrema={[]}
        height={150}
        timeContext={timeContext}
      />
      <div className="legend">
        <span className="legend__item">
          <span className="legend__swatch" style={{ background: 'var(--water-600)' }} />
          Hauteur de houle (m)
        </span>
        {units !== 'standard' && (
          <span className="legend__item">
            <span className="legend__swatch" style={{ background: 'var(--forest-500)' }} />
            Vitesse de vent en {units === 'nautical' ? 'nœuds' : 'km/h'} (voir module météo)
          </span>
        )}
      </div>
      <span className="u-dim" style={{ fontSize: 'var(--t-xs)' }}>
        Unités : distance {distanceUnit(units)} · vitesse {formatSpeed(0, units).replace('0 ', '')}
      </span>
    </div>
  );
}

function marnageDuJour(tides: TideData): string {
  if (tides.extrema.length < 2) return '—';
  const todayIso = new Date().toISOString().slice(0, 10);
  const todays = tides.extrema.filter((e) => e.time.slice(0, 10) === todayIso);
  if (todays.length < 2) return '—';
  const heights = todays.map((e) => e.height);
  return formatNumber(Math.max(...heights) - Math.min(...heights), 2);
}

function coefficientLabel(c: number): string {
  if (c >= 100) return 'Grande marée';
  if (c >= 70) return 'Marée forte';
  if (c >= 45) return 'Marée moyenne';
  return 'Petite marée';
}

function formatRelative(iso: string): string {
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'à l’instant';
  if (diff < 3600) return `il y a ${Math.round(diff / 60)} min`;
  return `il y a ${Math.round(diff / 3600)} h`;
}

export function distanceLabel(km: number, mode: UnitMode): string {
  return `${distanceValue(km, mode)} ${distanceUnit(mode)}`;
}

export { formatDateTime };

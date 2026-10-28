/**
 * Dashboard principal — §18.
 *
 * Ordre recommandé :
 *   1. Spot et distance
 *   2. Conditions actuelles
 *   3. Évolution de la journée
 *   4. Astronomie
 *   5. Données spécifiques à l'activité
 *   6. Prévisions
 *   7. Sources
 *   8. Frais de déplacement
 *
 * Seuls les modules pertinents pour spot + activité + milieu sont rendus (§9,
 * §10, §11, §12, §13). Les activités terrestres n'affichent jamais de données
 * maritimes.
 */

import { useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Metric, MetricGrid } from '@/components/ui/Metric';
import { Notice } from '@/components/ui/Notice';
import { SpotMap } from '@/components/SpotMap';
import { ConditionsActuelles } from './ConditionsActuelles';
import { Journee } from './Journee';
import { Astronomie } from './Astronomie';
import { Maritime } from './Maritime';
import { Hydrologie } from './Hydrologie';
import { Previsions } from './Previsions';
import { Frais } from './Frais';
import { Sources } from './Sources';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useApp } from '@/state/AppProvider';
import { ACTIVITY_MAP } from '@/state/activities';
import { formatCoords, formatDuration } from '@/core/geo';
import { formatDateTime, formatNumber, formatRelative } from '@/core/format';
import { formatDistance } from '@/core/units';
import { astronomySource } from '@/services/astronomy';
import { weatherSource } from '@/services/weather';
import { marineSource } from '@/services/marine';
import { hydrologySources } from '@/services/hydrology';
import { coastlineSources } from '@/services/coastline';
import { geocodingSources } from '@/services/geocoding';
import type { SourceLink } from '@/types';

export function Dashboard() {
  const { state, setCosts, setStep, setMilieu } = useApp();
  const data = useDashboardData();
  const { spot, activity, units, origin, costs } = state;

  const activityDef = activity ? ACTIVITY_MAP[activity] : null;

  // -------------------------------------------------------------------------
  // Plan des modules (§9 à §13)
  // -------------------------------------------------------------------------
  const plan = useMemo(() => {
    const milieu = data.milieu;
    const maritime = milieu === 'mer';
    return {
      terrestrialData: activity === 'balade' || activity === 'randonnee' || activity === 'jogging' || activity === 'chasse',
      swimmingWater: activity === 'natation' && !maritime,
      swimmingSea: activity === 'natation' && maritime,
      nautismeGeneral: activity === 'nautisme',
      nautismeMaritime: activity === 'nautisme' && maritime,
      pecheDouce: activity === 'peche' && !maritime,
      pecheMer: activity === 'peche' && maritime,
      maritime,
    };
  }, [activity, data.milieu]);

  // -------------------------------------------------------------------------
  // Sources actives (§17)
  // -------------------------------------------------------------------------
  const activeSources = useMemo<SourceLink[]>(() => {
    const list: SourceLink[] = [
      {
        label: weatherSource.label,
        url: weatherSource.url,
        role: weatherSource.role,
        freshness: weatherSource.freshness,
        freshnessLabel: weatherSource.freshnessLabel,
        updatedAt: data.weather?.updatedAt ?? null,
        note: weatherSource.note,
      },
      {
        label: astronomySource.label,
        url: astronomySource.url,
        role: astronomySource.role,
        freshness: 'realtime',
        freshnessLabel: astronomySource.freshnessLabel,
        updatedAt: data.astronomy?.computedAt ?? null,
        note: astronomySource.note,
      },
    ];

    if (origin) {
      list.push({
        label: geocodingSources.geoplateforme.label,
        url: geocodingSources.geoplateforme.url,
        role: geocodingSources.geoplateforme.role,
        freshness: 'realtime',
        freshnessLabel: 'Base BAN actualisée chaque semaine',
        updatedAt: null,
      });
    }

    if (data.detection) {
      list.push({
        label:
          data.detection.precision === 'precise'
            ? coastlineSources.osm.label
            : coastlineSources.naturalEarth.label,
        url:
          data.detection.precision === 'precise'
            ? coastlineSources.osm.url
            : coastlineSources.naturalEarth.url,
        role: coastlineSources.osm.role,
        freshness: data.detection.precision === 'precise' ? 'realtime' : 'delayed',
        freshnessLabel:
          data.detection.precision === 'precise'
            ? coastlineSources.osm.freshnessLabel
            : coastlineSources.naturalEarth.freshnessLabel,
        updatedAt: data.detection.computedAt,
      });
    }

    if (plan.maritime && data.marine?.available) {
      list.push({
        label: marineSource.label,
        url: marineSource.url,
        role: marineSource.role,
        freshness: marineSource.freshness,
        freshnessLabel: marineSource.freshnessLabel,
        updatedAt: null,
        note: marineSource.note,
      });
    }

    if (plan.maritime && data.tides?.available) {
      list.push({
        label: data.tides.sourceLabel,
        url: data.tides.sourceUrl,
        role: 'Horaires, hauteurs et coefficients de marée',
        freshness: data.tides.kind === 'harmonic' ? 'realtime' : 'delayed',
        freshnessLabel:
          data.tides.kind === 'harmonic'
            ? 'Calcul astronomique — atlas harmonique'
            : 'Modèle numérique mis à jour toutes les 24 h',
        updatedAt: null,
        note: data.tides.caveat,
      });
    }

    if (plan.maritime && !data.tides?.available) {
      list.push({
        label: 'SHOM — annuaire des marées',
        url: 'https://maree.shom.fr/',
        role: 'Référence officielle française des marées',
        freshness: 'realtime',
        freshnessLabel: 'Mise à jour quotidienne',
        updatedAt: null,
        note: 'Source de consultation : aucune donnée n’a été substituée.',
      });
    }

    if (data.hydrology?.available) {
      list.push({
        label: hydrologySources.hubeau.label,
        url: hydrologySources.hubeau.url,
        role: hydrologySources.hubeau.role,
        freshness: 'realtime',
        freshnessLabel: data.hydrology.updateFrequency,
        updatedAt: data.hydrology.updatedAt,
      });
    }

    return list;
  }, [plan, data, origin]);

  if (!spot || !activity) {
    return (
      <Card>
        <Notice tone="info" title="Parcours incomplet">
          Sélectionnez une activité puis un spot pour générer le dashboard.
          <div style={{ marginTop: 10 }}>
            <button type="button" className="btn btn--primary btn--sm" onClick={() => setStep(1)}>
              Reprendre au début
            </button>
          </div>
        </Notice>
      </Card>
    );
  }

  const tctx = data.timeContext;
  const distance = data.straightDistanceKm;

  return (
    <div className="stack stack--lg">
      {/* ---------------- 1. Spot et distance ---------------- */}
      <section className="hero fade-in">
        <div className="hero__inner">
          <div className="hero__spot">
            <span className="hero__eyebrow">
              <span aria-hidden="true">{activityDef?.emoji}</span> {activityDef?.label}
            </span>
            <h1 className="hero__title">{spot.name}</h1>
            <div className="hero__meta">
              <Chip tone={data.milieu === 'mer' ? 'water' : 'forest'} size="lg" dot pulse>
                Milieu : {data.milieu === 'mer' ? 'Mer' : 'Eau douce'}
              </Chip>
              {state.milieu === 'auto' ? (
                <Chip tone="neutral" title="Contexte déterminé automatiquement">
                  AUTO · seuil {data.detection?.thresholdKm ?? 5} km
                </Chip>
              ) : (
                <Chip tone="clay" title="Contexte forcé manuellement — prioritaire">
                  Forcé manuellement
                </Chip>
              )}
              {spot.milieuOverride && (
                <Chip tone="clay" title="Contexte enregistré avec ce spot">
                  Contexte du spot : {spot.milieuOverride === 'mer' ? 'Mer' : 'Eau douce'}
                </Chip>
              )}
              {spot.commune && <Chip tone="neutral">📍 {spot.commune}</Chip>}
            </div>
          </div>
          <div className="hero__side">
            <MetricGrid cols={2}>
              <Metric
                label="Distance départ"
                value={distance != null ? formatDistance(distance, units) : '—'}
                sub={origin ? `Depuis ${origin.label}` : 'Position non définie'}
                tone="forest"
                icon="📏"
              />
              <Metric
                label="Trajet estimé"
                value={data.trip ? formatDuration(data.trip.durationMinutes) : '—'}
                sub={data.trip ? `${formatNumber(data.trip.distanceKm, 1)} km routiers` : undefined}
                tone="clay"
                icon="⏱️"
              />
            </MetricGrid>
            <div className="row row--wrap" style={{ gap: 8 }}>
              <Chip tone="neutral" title="Coordonnées GPS du spot">
                {formatCoords({ lat: spot.lat, lon: spot.lon })}
              </Chip>
              {data.weather && <Chip tone="sky">{data.weather.timezone}</Chip>}
              <button type="button" className="btn btn--sm" onClick={data.refresh}>
                ↻ Actualiser
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Carte + détection du milieu */}
      <div className="split">
        <Card
          title="Carte du spot"
          subtitle="Spot, position de départ, environnement"
          icon="🗺️"
          iconTone="forest"
          flush
        >
          <div style={{ padding: 'var(--gap-4)' }}>
            <SpotMap
              spot={{ lat: spot.lat, lon: spot.lon, name: spot.name }}
              origin={origin ? { lat: origin.lat, lon: origin.lon } : null}
              stations={data.hydrology?.stations ?? []}
              showMaritimeZone={state.milieu === 'auto'}
              maritimeRadiusKm={data.detection?.thresholdKm ?? 5}
              height="tall"
            />
            <div className="map-legend">
              <span className="legend__item">
                <span className="legend__swatch" style={{ background: 'var(--forest-500)' }} />
                Spot
              </span>
              {origin && (
                <span className="legend__item">
                  <span className="legend__swatch" style={{ background: 'var(--clay-500)', borderRadius: '50%' }} />
                  Position de départ
                </span>
              )}
              {state.milieu === 'auto' && (
                <span className="legend__item">
                  <span className="legend__swatch" style={{ background: 'var(--water-300)' }} />
                  Rayon de détection maritime ({(data.detection?.thresholdKm ?? 5).toString()} km)
                </span>
              )}
              {data.hydrology && data.hydrology.stations.length > 0 && (
                <span className="legend__item">
                  <span className="legend__swatch" style={{ background: 'var(--water-500)' }} />
                  Stations hydrologiques
                </span>
              )}
              <span className="legend__item">
                Fond de carte © OpenStreetMap (ODbL)
              </span>
            </div>
          </div>
        </Card>

        <Card
          title="Détermination du milieu"
          subtitle="Détection automatique et forçage manuel"
          icon="🧭"
          iconTone={data.milieu === 'mer' ? 'water' : 'forest'}
          actions={
            <Chip tone={data.milieu === 'mer' ? 'water' : 'forest'}>
              {data.milieu === 'mer' ? 'Mer' : 'Eau douce'}
            </Chip>
          }
        >
          <div className="stack stack--sm">
            {data.status.detection.loading && (
              <div className="row" style={{ gap: 8 }}>
                <span className="spinner spinner--sm" />
                <span className="u-dim">Analyse de la position…</span>
              </div>
            )}

            {data.detection ? (
              <>
                <dl className="kv">
                  <dt>Distance à la côte</dt>
                  <dd>
                    {data.detection.distanceCoastKm != null
                      ? formatDistance(data.detection.distanceCoastKm, units)
                      : '—'}
                  </dd>
                  <dt>Précision</dt>
                  <dd>
                    {data.detection.precision === 'precise'
                      ? 'Élevée (OSM)'
                      : data.detection.precision === 'approx'
                        ? 'Approximative (± 10 km)'
                        : '—'}
                  </dd>
                  <dt>Maille marine du modèle</dt>
                  <dd>{data.detection.marineGrid ? 'Oui' : 'Non'}</dd>
                  <dt>Seuil appliqué</dt>
                  <dd>{data.detection.thresholdKm} km</dd>
                  <dt>Conclusion AUTO</dt>
                  <dd>{data.detection.auto === 'mer' ? 'Mer' : 'Eau douce'}</dd>
                  <dt>Source</dt>
                  <dd style={{ fontSize: 'var(--t-xs)' }}>{data.detection.source}</dd>
                </dl>

                {data.detection.precision === 'approx' && (
                  <Notice tone="warn" title="Précision limitée">
                    Le tracé de côte utilisé est un jeu de données mondial à 110 m de résolution :
                    sur les côtes lisses (baies, estuaires), la distance peut être erronée de
                    plusieurs kilomètres à plusieurs dizaines de kilomètres. Pour les spots proches
                    de la limite terre/mer, forcez manuellement le contexte.
                  </Notice>
                )}

                {data.milieu === 'mer' && state.milieu !== 'mer' && !spot.milieuOverride && (
                  <Notice tone="info" title="Contexte maritime retenu automatiquement">
                    Le spot est à moins de {data.detection.thresholdKm} km d’une zone maritime.
                  </Notice>
                )}
              </>
            ) : (
              !data.status.detection.loading && (
                <Notice tone="warn" title="Détection indisponible">
                  {data.status.detection.error ??
                    'Impossible de déterminer la distance à la côte. Le contexte doit alors être choisi manuellement.'}
                </Notice>
              )
            )}

            <hr className="divider" />
            <span className="field__label">Forcer le contexte</span>
            <div className="row row--wrap" style={{ gap: 6 }}>
              {(['auto', 'mer', 'eau_douce'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`btn btn--sm${state.milieu === m ? ' btn--primary' : ''}`}
                  onClick={() => setMilieu(m)}
                >
                  {m === 'auto' ? 'AUTO' : m === 'mer' ? 'MER' : 'EAU DOUCE'}
                </button>
              ))}
            </div>
            <p className="u-dim" style={{ fontSize: 'var(--t-xs)' }}>
              Le choix manuel est prioritaire sur la détection automatique (§5).
            </p>
          </div>
        </Card>
      </div>

      {/* ---------------- 2. Conditions actuelles ---------------- */}
      <ConditionsActuelles
        weather={data.weather}
        loading={data.status.weather.loading}
        error={data.status.weather.error}
        units={units}
        timeContext={tctx}
        marine={plan.maritime ? data.marine?.current ?? null : null}
      />

      {/* ---------------- 3. Évolution de la journée ---------------- */}
      <Journee
        weather={data.weather}
        loading={data.status.weather.loading}
        error={data.status.weather.error}
        units={units}
        timeContext={tctx}
      />

      {/* ---------------- 4. Astronomie ---------------- */}
      <Astronomie astronomy={data.astronomy} timeContext={tctx} />

      {/* ---------------- 5. Données spécifiques à l'activité ---------------- */}
      {plan.maritime && (
        <Maritime
          tides={data.tides}
          marine={data.marine}
          loadingTides={data.status.tides.loading}
          loadingMarine={data.status.marine.loading}
          errorTides={data.status.tides.error}
          errorMarine={data.status.marine.error}
          units={units}
          timeContext={tctx}
          portDistanceKm={data.tides?.portDistanceKm ?? null}
          activity={activity}
        />
      )}

      {plan.pecheDouce && (
        <Hydrologie
          hydrology={data.hydrology}
          loading={data.status.hydrology.loading}
          error={data.status.hydrology.error}
          units={units}
          timeContext={tctx}
        />
      )}

      {plan.terrestrialData && (
        <Card
          title="Informations environnementales"
          subtitle={`Données terrestres — ${activityDef?.label.toLowerCase()}`}
          icon="🌿"
          iconTone="forest"
        >
          <div className="stack">
            <MetricGrid cols={4}>
              <Metric
                label="Couverture nuageuse"
                value={
                  data.weather?.current.cloudCover != null
                    ? formatNumber(data.weather.current.cloudCover, 0)
                    : '—'
                }
                unit="%"
                tone="sky"
                icon="☁️"
              />
              <Metric
                label="UV maximal du jour"
                value={
                  data.weather?.daily[0]?.uvIndexMax != null
                    ? formatNumber(data.weather.daily[0].uvIndexMax, 1)
                    : '—'
                }
                tone="clay"
                icon="🔆"
              />
              <Metric
                label="Précipitations du jour"
                value={
                  data.weather?.daily[0]?.precipitationSum != null
                    ? formatNumber(data.weather.daily[0].precipitationSum, 1)
                    : '—'
                }
                unit="mm"
                tone="water"
                icon="🌧️"
              />
              <Metric
                label="Durée du jour"
                value={
                  data.astronomy?.dayLengthSeconds != null
                    ? formatNumber(data.astronomy.dayLengthSeconds / 3600, 1)
                    : '—'
                }
                unit="h"
                tone="forest"
                icon="☀️"
              />
            </MetricGrid>
            <Notice tone="info" title="Aucune donnée maritime affichée">
              Conformément au cahier des charges, les activités terrestres ne présentent pas les
              données maritimes (marée, houle, vagues), hors nécessité pour l’activité choisie.
            </Notice>
          </div>
        </Card>
      )}

      {/* ---------------- 6. Prévisions ---------------- */}
      <Previsions
        weather={data.weather}
        loading={data.status.weather.loading}
        error={data.status.weather.error}
        units={units}
        timeContext={tctx}
      />

      {/* ---------------- 7. Sources ---------------- */}
      <Sources active={activeSources} />

      {/* ---------------- 8. Frais ---------------- */}
      <Frais
        distanceKm={data.straightDistanceKm}
        trip={data.trip}
        costs={costs}
        units={units}
        onChange={setCosts}
        originLabel={origin?.label ?? null}
      />

      <footer className="u-dim" style={{ fontSize: 'var(--t-xs)', textAlign: 'center' }}>
        Données récupérées {data.weather ? formatDateTime(data.weather.fetchedAt, tctx) : '—'} ·
        Heure du spot {formatDateTime(new Date().toISOString(), tctx)} ·{' '}
        {formatRelative(data.weather?.fetchedAt ?? null)}
      </footer>
    </div>
  );
}

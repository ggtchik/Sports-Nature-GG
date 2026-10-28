/**
 * Étape 4 — Milieu : AUTO | MER | EAU DOUCE (§5, §24).
 * Le choix manuel est prioritaire sur la détection automatique.
 */

import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Notice } from '@/components/ui/Notice';
import { useApp } from '@/state/AppProvider';
import { useDashboardData } from '@/hooks/useDashboardData';
import { formatDistance } from '@/core/units';
import type { MilieuMode } from '@/types';

const OPTIONS: { id: MilieuMode; label: string; hint: string; detail: string }[] = [
  {
    id: 'auto',
    label: 'AUTO',
    hint: 'détection',
    detail:
      'Le contexte est déterminé automatiquement : un spot à moins de 5 km d’une zone maritime est considéré comme potentiellement maritime, au-delà il est continental / eau douce.',
  },
  {
    id: 'mer',
    label: 'MER',
    hint: 'forcé',
    detail:
      'Force le contexte maritime : marées, coefficients, houle, vagues et température de l’eau sont alors affichés.',
  },
  {
    id: 'eau_douce',
    label: 'EAU DOUCE',
    hint: 'forcé',
    detail:
      'Force le contexte continental : rivière, lac ou étang. Les stations hydrologiques sont recherchées pour la pêche.',
  },
];

export function StepMilieu() {
  const { state, setMilieu, saveSpot } = useApp();
  const data = useDashboardData();
  const spot = state.spot;

  return (
    <div className="stack stack--lg">
      <Card
        title="Détermination du milieu"
        subtitle="Automatique ou forçage manuel — le choix manuel est toujours prioritaire"
        icon="🧭"
        iconTone={data.milieu === 'mer' ? 'water' : 'forest'}
      >
        <div className="stack">
          {!spot && (
            <Notice tone="warn" title="Aucun spot sélectionné">
              Sélectionnez d’abord un spot à l’étape 3 pour permettre la détection automatique.
            </Notice>
          )}

          <div className="segment segment--block" role="group" aria-label="Sélecteur de milieu">
            {OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                className="segment__btn"
                aria-pressed={state.milieu === o.id}
                onClick={() => setMilieu(o.id)}
              >
                {o.label}
                <small>{o.hint}</small>
              </button>
            ))}
          </div>

          {OPTIONS.filter((o) => o.id === state.milieu).map((o) => (
            <Notice key={o.id} tone="info">
              {o.detail}
            </Notice>
          ))}

          {spot && data.detection && (
            <div className="grid grid--3">
              <div className="metric">
                <div className="metric__label">Distance à la côte</div>
                <div className="metric__value">
                  {data.detection.distanceCoastKm != null
                    ? formatDistance(data.detection.distanceCoastKm, state.units)
                    : '—'}
                </div>
                <div className="metric__sub">
                  {data.detection.precision === 'precise'
                    ? 'Traçé OpenStreetMap'
                    : data.detection.precision === 'approx'
                      ? 'Natural Earth 110 m (indicatif)'
                      : 'Source inconnue'}
                </div>
              </div>
              <div className="metric">
                <div className="metric__label">Seuil appliqué</div>
                <div className="metric__value">{data.detection.thresholdKm} km</div>
                <div className="metric__sub">Règle du cahier des charges</div>
              </div>
              <div className="metric">
                <div className="metric__label">Conclusion automatique</div>
                <div className="metric__value">{data.detection.auto === 'mer' ? 'Mer' : 'Eau douce'}</div>
                <div className="metric__sub">Source : {data.detection.source}</div>
              </div>
            </div>
          )}

          <div className="row row--wrap" style={{ gap: 8 }}>
            <Chip tone={data.milieu === 'mer' ? 'water' : 'forest'} size="lg" dot pulse>
              Milieu retenu : {data.milieu === 'mer' ? 'Mer' : 'Eau douce'}
            </Chip>
            {state.milieu !== 'auto' && <Chip tone="clay">Forcé manuellement — prioritaire</Chip>}
          </div>

          {spot && state.milieu !== 'auto' && (
            <Notice tone="info" title="Enregistrer ce contexte avec le spot">
              <div style={{ marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={() =>
                    saveSpot({
                      ...spot,
                      milieuOverride: state.milieu === 'mer' ? 'mer' : 'eau_douce',
                      updatedAt: Date.now(),
                    })
                  }
                >
                  💾 Mémoriser « {state.milieu === 'mer' ? 'Mer' : 'Eau douce'} » pour {spot.name}
                </button>
              </div>
            </Notice>
          )}
        </div>
      </Card>

      <Card title="Pourquoi cette étape est indispensable" icon="💡" iconTone="sky">
        <p>
          Certains spots se trouvent à proximité immédiate de la limite terre/mer : un estuaire, une
          retenue à quelques centaines de mètres de la côte, ou un point dont le tracé de côte est
          imprécis à cette échelle. Dans ces cas, la détection automatique peut se tromper. Le
          sélecteur manuel garantit que le dashboard affiche toujours les bonnes données.
        </p>
      </Card>
    </div>
  );
}

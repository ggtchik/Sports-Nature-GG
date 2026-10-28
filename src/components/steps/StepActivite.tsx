/**
 * Étape 2 — Choix de l'activité (§2, §24).
 */

import { Card } from '@/components/ui/Card';
import { Notice } from '@/components/ui/Notice';
import { useApp } from '@/state/AppProvider';
import { ACTIVITIES } from '@/state/activities';
import type { ActivityId } from '@/types';

export function StepActivite() {
  const { state, setActivity } = useApp();

  return (
    <Card
      title="Choisir une activité"
      subtitle="Le dashboard n'affichera que les modules pertinents pour l'activité et le milieu retenus"
      icon={state.activity ? undefined : '🎯'}
      iconTone="forest"
    >
      <div className="stack">
        <div className="activity-grid" role="group" aria-label="Activités disponibles">
          {ACTIVITIES.map((a) => (
            <button
              key={a.id}
              type="button"
              className="activity-card"
              aria-pressed={state.activity === a.id}
              onClick={() => setActivity(a.id as ActivityId)}
            >
              <span className="activity-card__emoji" aria-hidden="true">
                {a.emoji}
              </span>
              <span className="activity-card__label">{a.label}</span>
              <span className="activity-card__tag">{a.tagline}</span>
              <span className={`chip ${a.domain === 'aquatique' ? 'chip--water' : 'chip--forest'}`} style={{ marginTop: 4 }}>
                {a.domain === 'aquatique' ? 'Aquatique' : 'Terrestre'}
              </span>
            </button>
          ))}
        </div>

        <Notice tone="info" title="Nautisme">
          La catégorie <b>Nautisme</b> est le terme officiel de la catégorie nautique. Elle couvre la
          voile, le bateau à moteur, la plaisance et les autres pratiques nautiques compatibles avec
          les données disponibles.
        </Notice>
      </div>
    </Card>
  );
}

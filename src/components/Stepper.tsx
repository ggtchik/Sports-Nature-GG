/**
 * Bandeau d'étapes du parcours utilisateur (§24).
 */

import { useApp } from '@/state/AppProvider';

const STEPS: { n: 1 | 2 | 3 | 4 | 5 | 6; label: string }[] = [
  { n: 1, label: 'Position' },
  { n: 2, label: 'Activité' },
  { n: 3, label: 'Spot' },
  { n: 4, label: 'Milieu' },
  { n: 5, label: 'Unités' },
  { n: 6, label: 'Dashboard' },
];

export function Stepper() {
  const { state, setStep } = useApp();

  // Une étape n'est atteignable que si les précédentes sont renseignées.
  const reachable = (n: number): boolean => {
    if (n === 1) return true;
    if (n === 2) return true;
    if (n === 3) return state.activity != null;
    if (n === 4) return state.spot != null;
    if (n === 5) return state.spot != null;
    if (n === 6) return state.spot != null && state.activity != null;
    return false;
  };

  const progress = ((state.step - 1) / (STEPS.length - 1)) * 100;

  return (
    <nav className="stepper" aria-label="Progression">
      <div className="stepper__track">
        {STEPS.map((s) => {
          const done = s.n < state.step;
          const current = s.n === state.step;
          const enabled = reachable(s.n);
          return (
            <button
              key={s.n}
              type="button"
              className={`stepper__item${done ? ' stepper__item--done' : ''}`}
              aria-current={current ? 'step' : undefined}
              disabled={!enabled}
              onClick={() => setStep(s.n)}
            >
              <span className="stepper__dot">{done ? '✓' : s.n}</span>
              {s.label}
            </button>
          );
        })}
      </div>
      <div className="stepper__bar">
        <i style={{ width: `${progress}%` }} />
      </div>
    </nav>
  );
}

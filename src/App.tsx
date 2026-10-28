import { useEffect, useState } from 'react';
import { AppProvider, useApp } from '@/state/AppProvider';
import { Topbar } from '@/components/Topbar';
import { Stepper } from '@/components/Stepper';
import { Footer } from '@/components/Footer';
import { StepPosition } from '@/components/steps/StepPosition';
import { StepActivite } from '@/components/steps/StepActivite';
import { StepSpot } from '@/components/steps/StepSpot';
import { StepMilieu } from '@/components/steps/StepMilieu';
import { StepUnites } from '@/components/steps/StepUnites';
import { Dashboard } from '@/modules/Dashboard';
import { Reglages } from '@/modules/Reglages';

function Shell() {
  const { state, setStep } = useApp();
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Dès que le parcours est complet, le dashboard devient l'écran par défaut.
  useEffect(() => {
    if (state.step === 6 && (!state.spot || !state.activity)) setStep(1);
  }, [state.step, state.spot, state.activity, setStep]);

  // Fermeture du panneau de réglages au clavier.
  useEffect(() => {
    if (!settingsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSettingsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [settingsOpen]);

  return (
    <div className="app">
      <Topbar onOpenSettings={() => setSettingsOpen(true)} />
      <Stepper />
      <main className={`shell${state.step === 6 ? ' shell--wide' : ''}`}>
        <div className="fade-in" key={state.step}>
          {state.step === 1 && <StepPosition />}
          {state.step === 2 && <StepActivite />}
          {state.step === 3 && <StepSpot />}
          {state.step === 4 && <StepMilieu />}
          {state.step === 5 && <StepUnites />}
          {state.step === 6 && <Dashboard />}
        </div>
      </main>
      <Footer />

      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

function SettingsPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="drawer" role="dialog" aria-modal="true" aria-label="Réglages">
      <button type="button" className="drawer__backdrop" aria-label="Fermer les réglages" onClick={onClose} />
      <aside className="drawer__panel">
        <header className="drawer__head">
          <div>
            <h2 style={{ fontSize: 'var(--t-lg)' }}>Réglages</h2>
            <span className="u-dim" style={{ fontSize: 'var(--t-sm)' }}>
              Unités, frais de déplacement, source des marées, stockage local
            </span>
          </div>
          <button type="button" className="btn btn--icon" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </header>
        <div className="drawer__body">
          <Reglages />
        </div>
      </aside>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}

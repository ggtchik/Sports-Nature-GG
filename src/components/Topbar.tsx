/**
 * En-tête applicatif : marque, sélecteur d'unités global, accès aux réglages.
 */

import { UnitSelector } from './UnitSelector';
import { useApp } from '@/state/AppProvider';
import { ACTIVITY_MAP } from '@/state/activities';
import { formatTime } from '@/core/format';

interface TopbarProps {
  onOpenSettings: () => void;
}

export function Topbar({ onOpenSettings }: TopbarProps) {
  const { state, setUnits, setStep } = useApp();
  const now = new Date();
  const tctx = { timezone: 'local', utcOffsetSeconds: -now.getTimezoneOffset() * 60 };

  return (
    <header className="topbar">
      <div className="topbar__inner">
        <a className="brand" href="#/" onClick={(e) => { e.preventDefault(); setStep(1); }}>
          <span className="brand__mark" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 18.5l5.2-8.4 3.6 5.4 2.6-3.6L21 18.5H3z"
                fill="#e8d9bd"
              />
              <circle cx="17.4" cy="6.6" r="2.6" fill="#f0b27a" />
              <path d="M3 18.5h18" stroke="#f6f1e7" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </span>
          <span className="brand__text">
            <span className="brand__name">GG Sports-Nature</span>
            <span className="brand__sub">Plein air &amp; nautisme</span>
          </span>
        </a>

        <div className="topbar__spacer" />

        <div className="topbar__clock">
          <b>{formatTime(now.toISOString(), tctx)}</b>
          <span>
            {state.activity ? `${ACTIVITY_MAP[state.activity].emoji} ${ACTIVITY_MAP[state.activity].label}` : 'Aucune activité'}
          </span>
        </div>

        <div className="topbar__tools">
          <UnitSelector value={state.units} onChange={setUnits} compact />
          <button type="button" className="btn btn--sm" onClick={onOpenSettings}>
            ⚙️ Réglages
          </button>
        </div>
      </div>
    </header>
  );
}

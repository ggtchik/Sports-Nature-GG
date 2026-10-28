/**
 * Sélecteur global d'unités — accessible depuis le dashboard et les réglages (§6).
 */

import { UNIT_MODES } from '@/core/units';
import type { UnitMode } from '@/types';

interface Props {
  value: UnitMode;
  onChange: (mode: UnitMode) => void;
  block?: boolean;
  compact?: boolean;
}

export function UnitSelector({ value, onChange, block, compact }: Props) {
  return (
    <div
      className={`segment${block ? ' segment--block' : ''}`}
      role="group"
      aria-label="Sélecteur global des unités"
    >
      {UNIT_MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          className="segment__btn"
          aria-pressed={value === m.id}
          onClick={() => onChange(m.id)}
          title={m.hint}
        >
          {compact ? m.short : m.label}
          {!compact && <small>{m.short}</small>}
        </button>
      ))}
    </div>
  );
}

/**
 * Rose des vents simplifiée et indicateur de direction.
 * La vitesse est reçue déjà formatée selon le sélecteur global d'unités (§6).
 */

import { compassPoint, directionLabel } from '@/core/geo';

interface WindArrowProps {
  directionDeg: number | null;
  /** Vitesse déjà convertie pour l'affichage. */
  speedLabel: string | null;
  size?: number;
  label?: string;
}

export function WindArrow({ directionDeg, speedLabel, size = 62, label }: WindArrowProps) {
  if (directionDeg == null) {
    return (
      <div className="row" style={{ gap: 8, color: 'var(--ink-400)' }}>
        <span style={{ fontSize: 22 }} aria-hidden="true">
          —
        </span>
        <span className="u-dim">Direction inconnue</span>
      </div>
    );
  }

  const deg = ((directionDeg % 360) + 360) % 360;
  return (
    <div className="row" style={{ gap: 10 }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        role="img"
        aria-label={`${label ?? 'Vent'} de ${directionLabel(deg)}`}
      >
        <circle cx="32" cy="32" r="27" fill="var(--sand-100)" stroke="var(--line)" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
          const long = a % 90 === 0;
          const rad = (a - 90) * (Math.PI / 180);
          const r1 = long ? 19 : 22;
          const r2 = 26;
          return (
            <line
              key={a}
              x1={32 + Math.cos(rad) * r1}
              y1={32 + Math.sin(rad) * r1}
              x2={32 + Math.cos(rad) * r2}
              y2={32 + Math.sin(rad) * r2}
              stroke={long ? 'var(--ink-400)' : 'var(--sand-400)'}
              strokeWidth={long ? 1.4 : 1}
            />
          );
        })}
        {['N', 'E', 'S', 'O'].map((l, i) => {
          const rad = (i * 90 - 90) * (Math.PI / 180);
          return (
            <text
              key={l}
              x={32 + Math.cos(rad) * 14}
              y={32 + Math.sin(rad) * 14 + 3}
              textAnchor="middle"
              style={{ fontSize: 8, fontWeight: 700, fill: 'var(--ink-500)' }}
            >
              {l}
            </text>
          );
        })}
        {/* La flèche pointe dans la direction d'où vient le flux. */}
        <g transform={`rotate(${deg} 32 32)`}>
          <path d="M32 11 L37.5 34 L32 30 L26.5 34 Z" fill="var(--forest-500)" />
        </g>
        <circle cx="32" cy="32" r="3" fill="var(--forest-700)" />
      </svg>
      <div className="stack" style={{ gap: 1 }}>
        <span style={{ fontWeight: 700, fontSize: 'var(--t-sm)', color: 'var(--ink-900)' }}>
          {compassPoint(deg)}
        </span>
        <span className="u-dim" style={{ fontSize: 'var(--t-xs)' }}>
          {directionLabel(deg)}
        </span>
        {speedLabel && (
          <span className="u-num" style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-600)', fontWeight: 600 }}>
            {speedLabel}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Arc solaire (§7) — représentation graphique du lever au coucher du soleil,
 * et de la position du soleil / de la Lune à l'instant présent.
 */

interface SunArcProps {
  sunrise: string | null;
  sunset: string | null;
  solarNoon: string | null;
  now: Date;
  timeContext: { timezone: string; utcOffsetSeconds: number };
}

export function SunArc({ sunrise, sunset, solarNoon, now, timeContext }: SunArcProps) {
  const w = 320;
  const h = 120;
  const cx = w / 2;
  const cy = h - 18;
  const r = w / 2 - 22;

  const fmt = (iso: string) =>
    makeTimeFormatter(timeContext, { hour: '2-digit', minute: '2-digit', hour12: false })(new Date(iso));

  if (!sunrise || !sunset) {
    return (
      <svg className="chart" viewBox={`0 0 ${w} ${h}`} role="img" style={{ height: h }}>
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="var(--sand-300)" strokeWidth="2" strokeDasharray="4 5" />
        <text x={cx} y={h / 2} textAnchor="middle" className="chart__label">
          Lever / coucher non définis à cette latitude
        </text>
      </svg>
    );
  }

  const tRise = new Date(sunrise).getTime();
  const tSet = new Date(sunset).getTime();
  const tNoon = solarNoon ? new Date(solarNoon).getTime() : (tRise + tSet) / 2;
  const nowT = now.getTime();

  // Position courante sur l'arc (0 → lever, 1 → coucher).
  const progress = Math.max(0, Math.min(1, (nowT - tRise) / Math.max(1, tSet - tRise)));
  const angle = Math.PI * progress;
  const sx = cx - r * Math.cos(angle);
  const sy = cy - r * Math.sin(angle);
  const isDay = nowT >= tRise && nowT <= tSet;

  const arcPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const progressPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${sx} ${sy}`;

  return (
    <svg className="chart" viewBox={`0 0 ${w} ${h}`} role="img" style={{ height: h }}>
      <defs>
        <linearGradient id="sun-arc-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--clay-400)" />
          <stop offset="50%" stopColor="var(--sky-200)" />
          <stop offset="100%" stopColor="var(--clay-400)" />
        </linearGradient>
      </defs>

      {/* Horizon */}
      <line x1={8} x2={w - 8} y1={cy} y2={cy} stroke="var(--line-strong)" strokeWidth="1.5" />

      {/* Arc complet */}
      <path d={arcPath} fill="none" stroke="url(#sun-arc-grad)" strokeWidth="3" strokeLinecap="round" opacity="0.55" />
      {/* Arc parcouru */}
      <path d={progressPath} fill="none" stroke="var(--clay-500)" strokeWidth="3" strokeLinecap="round" />

      {/* Midi solaire */}
      <line
        x1={cx}
        x2={cx}
        y1={cy - r - 6}
        y2={cy}
        stroke="var(--line)"
        strokeWidth="1"
        strokeDasharray="2 3"
      />

      {/* Position du soleil */}
      {isDay && (
        <g>
          <circle cx={sx} cy={sy} r="9" fill="var(--clay-400)" opacity="0.28" />
          <circle cx={sx} cy={sy} r="5.5" fill="var(--clay-500)" stroke="#fff" strokeWidth="1.6" />
        </g>
      )}

      {/* Étiquettes */}
      <text x={cx - r} y={cy + 14} textAnchor="middle" className="chart__label">
        {fmt(sunrise)}
      </text>
      <text x={cx} y={cy - r - 10} textAnchor="middle" className="chart__label" style={{ fill: 'var(--ink-600)' }}>
        {fmt(tNoon.toString().length ? new Date(tNoon).toISOString() : '')}
      </text>
      <text x={cx + r} y={cy + 14} textAnchor="middle" className="chart__label">
        {fmt(sunset)}
      </text>
    </svg>
  );
}

/**
 * Représentation de la phase lunaire (§7) — disque découpé.
 */
interface MoonDiscProps {
  phase: number; // 0 → nouvelle, 0.5 → pleine
  illumination: number; // 0 → 1
  size?: number;
}

export function MoonDisc({ phase, illumination, size = 84 }: MoonDiscProps) {
  // Terminateur : on superpose un disque sombre dont le bord est une ellipse.
  const waxing = phase < 0.5;
  // k : 0 = nouvelle lune, 1 = pleine lune
  const k = illumination;
  const rx = Math.abs(1 - 2 * k) * (size / 2);

  // Le côté éclairé est à droite quand la lune est croissante.
  const sweepOuter = waxing ? 1 : 0;
  const sweepInner = phase < 0.25 || phase > 0.75 ? 0 : 1;

  const r = size / 2;
  const pathOuter = `M ${r} 0 A ${r} ${r} 0 0 ${sweepOuter} ${r} ${size} A ${rx} ${r} 0 0 ${sweepInner} ${r} 0 Z`;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Lune illuminée à ${Math.round(illumination * 100)} %`}
      style={{ flexShrink: 0 }}
    >
      <defs>
        <radialGradient id="moon-lit" cx="35%" cy="30%">
          <stop offset="0%" stopColor="#fffdf6" />
          <stop offset="100%" stopColor="#e6dcc6" />
        </radialGradient>
        <clipPath id="moon-clip">
          <circle cx={r} cy={r} r={r - 1} />
        </clipPath>
      </defs>
      <circle cx={r} cy={r} r={r - 1} fill="#cdc3ae" />
      <g clipPath="url(#moon-clip)">
        <circle cx={r} cy={r} r={r - 1} fill="url(#moon-lit)" />
        <path d={pathOuter} fill="rgba(29, 26, 22, 0.86)" />
        {/* Quelques cratères pour la lisibilité */}
        <circle cx={r * 0.62} cy={r * 0.55} r={r * 0.13} fill="rgba(120,110,92,0.22)" />
        <circle cx={r * 1.32} cy={r * 0.85} r={r * 0.1} fill="rgba(120,110,92,0.2)" />
        <circle cx={r * 1.05} cy={r * 0.38} r={r * 0.07} fill="rgba(120,110,92,0.18)" />
      </g>
      <circle cx={r} cy={r} r={r - 1} fill="none" stroke="var(--line-strong)" strokeWidth="1" />
    </svg>
  );
}

/**
 * Formate une date dans le fuseau du spot de manière robuste : fuseau IANA si
 * valide, sinon décalage fixe appliqué arithmétiquement (jamais de libellé de
 * fuseau construit à la main, refusé par `Intl.DateTimeFormat`).
 */
function makeTimeFormatter(
  ctx: { timezone: string; utcOffsetSeconds: number },
  opts: Intl.DateTimeFormatOptions,
): (d: Date) => string {
  try {
    const f = new Intl.DateTimeFormat('fr-FR', { timeZone: ctx.timezone, ...opts });
    f.format(new Date(0));
    return (d) => f.format(d);
  } catch {
    const utc = new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', ...opts });
    return (d) => utc.format(new Date(d.getTime() + ctx.utcOffsetSeconds * 1000));
  }
}

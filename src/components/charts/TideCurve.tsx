/**
 * Courbe de marée — aplatit la série de hauteurs et marque pleines / basses mers.
 */

import { useId } from 'react';
import { formatNumber } from '@/core/format';

interface TideCurveProps {
  points: { time: string; height: number }[];
  extrema: { type: 'PM' | 'BM'; time: string; height: number }[];
  height?: number;
  timeContext: { timezone: string; utcOffsetSeconds: number };
  nowIso?: string;
}

export function TideCurve({ points, extrema, height = 190, timeContext, nowIso }: TideCurveProps) {
  const uid = useId().replace(/:/g, '');
  const w = 640;
  const h = height;
  const PAD = { top: 14, right: 12, bottom: 22, left: 36 };
  const iw = w - PAD.left - PAD.right;
  const ih = h - PAD.top - PAD.bottom;

  if (points.length < 2) {
    return (
      <div className="empty" style={{ padding: 'var(--gap-5)' }}>
        <p className="u-dim">Courbe de marée indisponible.</p>
      </div>
    );
  }

  const values = points.map((p) => p.height);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const yLo = lo - span * 0.1;
  const yHi = hi + span * 0.1;

  const t0 = new Date(points[0].time).getTime();
  const t1 = new Date(points[points.length - 1].time).getTime();
  const x = (iso: string) => PAD.left + ((new Date(iso).getTime() - t0) / (t1 - t0)) * iw;
  const y = (v: number) => PAD.top + ih - ((v - yLo) / (yHi - yLo)) * ih;

  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.time)},${y(p.height)}`).join(' ');
  const areaD = `${d} L${x(points[points.length - 1].time)},${y(yLo)} L${x(points[0].time)},${y(yLo)} Z`;

  const fmtTick = makeTimeFormatter(timeContext, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const tickTimes = Array.from({ length: 7 }, (_, i) => new Date(t0 + ((t1 - t0) * i) / 6).toISOString());

  const nowX = nowIso ? x(nowIso) : null;

  return (
    <svg className="chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" style={{ height: h }}>
      <defs>
        <linearGradient id={`${uid}-tide`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--water-500)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--water-500)" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      <g className="chart__grid">
        {[yLo, lo, hi, yHi].map((v, i) => (
          <line key={i} x1={PAD.left} x2={w - PAD.right} y1={y(v)} y2={y(v)} strokeDasharray={i === 1 || i === 2 ? undefined : '2 4'} />
        ))}
      </g>

      <path d={areaD} fill={`url(#${uid}-tide)`} />
      <path d={d} className="chart__line" stroke="var(--water-600)" strokeWidth="2.2" />

      {extrema.map((e, i) => {
        const ex = x(e.time);
        const ey = y(e.height);
        const isPM = e.type === 'PM';
        return (
          <g key={i}>
            <line x1={ex} x2={ex} y1={ey} y2={PAD.top + ih} stroke={isPM ? 'var(--forest-400)' : 'var(--clay-400)'} strokeWidth="1" strokeDasharray="2 3" />
            <circle cx={ex} cy={ey} r="3.4" fill={isPM ? 'var(--forest-500)' : 'var(--clay-500)'} stroke="#fff" strokeWidth="1.4" />
            <text x={ex} y={isPM ? ey - 6 : ey + 12} textAnchor="middle" className="chart__label" style={{ fill: isPM ? 'var(--forest-600)' : 'var(--clay-600)' }}>
              {isPM ? 'PM' : 'BM'} {formatNumber(e.height, 1)} m
            </text>
          </g>
        );
      })}

      {nowX != null && nowX >= PAD.left && nowX <= w - PAD.right && (
        <g>
          <line x1={nowX} x2={nowX} y1={PAD.top} y2={PAD.top + ih} stroke="var(--ink-800)" strokeWidth="1.2" />
          <text x={nowX} y={PAD.top - 2} textAnchor="middle" className="chart__label" style={{ fill: 'var(--ink-800)' }}>
            maintenant
          </text>
        </g>
      )}

      <g className="chart__axis">
        {tickTimes.map((t, i) => (
          <text
            key={i}
            x={x(t)}
            y={h - 6}
            textAnchor={i === 0 ? 'start' : i === tickTimes.length - 1 ? 'end' : 'middle'}
          >
            {fmtTick(new Date(t))}
          </text>
        ))}
      </g>
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

/**
 * Graphique en barres verticales — prévisions 5 jours, précipitations…
 */

import type { ReactNode } from 'react';
import { formatNumber } from '@/core/format';

export interface BarDatum {
  label: string;
  value: number | null;
  /** Libellé affiché au-dessus de la barre. */
  caption?: string;
  /** Sous-libellé sous l'axe. */
  subLabel?: string;
}

interface BarChartProps {
  data: BarDatum[];
  height?: number;
  color?: string;
  unit?: string;
  formatValue?: (v: number) => string;
  /** Affiche une barre de repère (moyenne) . */
  reference?: { value: number; label: string };
  children?: ReactNode;
}

export function BarChart({
  data,
  height = 150,
  color = 'var(--forest-400)',
  unit,
  formatValue,
  reference,
}: BarChartProps) {
  const w = 640;
  const h = height;
  const PAD = { top: 16, right: 8, bottom: 26, left: 34 };
  const iw = w - PAD.left - PAD.right;
  const ih = h - PAD.top - PAD.bottom;

  const values = data.map((d) => d.value).filter((v): v is number => v != null && Number.isFinite(v));
  if (values.length === 0) {
    return (
      <div className="empty" style={{ padding: 'var(--gap-5)' }}>
        <p className="u-dim">Aucune donnée à représenter.</p>
      </div>
    );
  }

  const max = Math.max(...values, reference?.value ?? -Infinity);
  const min = Math.min(0, ...values);
  const span = max - min || 1;
  const hi = max + span * 0.12;
  const lo = min < 0 ? min - span * 0.12 : 0;

  const y = (v: number) => PAD.top + ih - ((v - lo) / (hi - lo)) * ih;
  const bw = iw / data.length;
  const barW = Math.min(38, bw * 0.56);

  const fmt = formatValue ?? ((v: number) => formatNumber(v, Math.abs(v) < 10 ? 1 : 0));

  return (
    <svg className="chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" style={{ height: h }}>
      <g className="chart__grid">
        {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
          const v = lo + (hi - lo) * f;
          return <line key={i} x1={PAD.left} x2={w - PAD.right} y1={y(v)} y2={y(v)} strokeDasharray={i === 0 ? undefined : '2 4'} />;
        })}
      </g>
      <g className="chart__axis">
        {[0, 0.5, 1].map((f) => {
          const v = lo + (hi - lo) * f;
          return (
            <text key={f} x={PAD.left - 6} y={y(v) + 3} textAnchor="end">
              {fmt(v)}
            </text>
          );
        })}
      </g>

      {reference && (
        <g>
          <line
            x1={PAD.left}
            x2={w - PAD.right}
            y1={y(reference.value)}
            y2={y(reference.value)}
            stroke="var(--clay-500)"
            strokeWidth="1.2"
            strokeDasharray="4 3"
          />
          <text x={w - PAD.right} y={y(reference.value) - 4} textAnchor="end" className="chart__label" style={{ fill: 'var(--clay-600)' }}>
            {reference.label}
          </text>
        </g>
      )}

      {data.map((d, i) => {
        const cx = PAD.left + bw * i + bw / 2;
        if (d.value == null || !Number.isFinite(d.value)) {
          return (
            <g key={i}>
              <line x1={cx - barW / 2} x2={cx + barW / 2} y1={y(lo)} y2={y(lo)} stroke="var(--sand-300)" strokeWidth="2" />
              <text x={cx} y={h - 8} textAnchor="middle" className="chart__axis">
                {d.label}
              </text>
            </g>
          );
        }
        const top = y(Math.max(d.value, lo));
        const bottom = y(Math.min(d.value, lo));
        const barH = Math.max(1.5, bottom - top);
        return (
          <g key={i}>
            <rect x={cx - barW / 2} y={top} width={barW} height={barH} rx="3" fill={color} opacity="0.9" />
            {d.caption && (
              <text x={cx} y={top - 4} textAnchor="middle" className="chart__label" style={{ fill: 'var(--ink-600)' }}>
                {d.caption}
              </text>
            )}
            <text x={cx} y={h - 8} textAnchor="middle" className="chart__axis">
              {d.label}
            </text>
            {d.subLabel && (
              <text x={cx} y={h - 17} textAnchor="middle" className="chart__axis" style={{ fontSize: 8 }}>
                {d.subLabel}
              </text>
            )}
          </g>
        );
      })}
      {unit && (
        <text x={PAD.left - 6} y={PAD.top - 4} textAnchor="end" className="chart__axis" style={{ fontSize: 8.5 }}>
          {unit}
        </text>
      )}
    </svg>
  );
}

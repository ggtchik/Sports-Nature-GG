/**
 * Graphique en aire / lignes — SVG maison, sans dépendance.
 * Utilisé pour l'évolution de la journée, la houle, la température…
 */

import { useId } from 'react';
import { formatNumber } from '@/core/format';

export interface Series {
  key: string;
  label: string;
  color: string;
  values: (number | null)[];
  /** Affiche une aire dégradée sous la courbe. */
  area?: boolean;
  /** Épaisseur du trait. */
  width?: number;
  /** Tirets. */
  dashed?: boolean;
}

interface LineChartProps {
  labels: string[];
  series: Series[];
  height?: number;
  /** Libellé de l'axe des ordonnées (unité). */
  unit?: string;
  /** Formatteur d'étiquette d'axe Y. */
  formatY?: (v: number) => string;
  /** Forcer le domaine Y. */
  domain?: [number, number];
  /** Index à mettre en évidence (instant présent). */
  highlightIndex?: number | null;
  /** Nombre d'étiquettes X affichées. */
  xTicks?: number;
}

const PAD = { top: 10, right: 10, bottom: 20, left: 38 };

export function LineChart({
  labels,
  series,
  height = 180,
  unit,
  formatY,
  domain,
  highlightIndex = null,
  xTicks = 6,
}: LineChartProps) {
  const uid = useId().replace(/:/g, '');
  const w = 640;
  const h = height;
  const iw = w - PAD.left - PAD.right;
  const ih = h - PAD.top - PAD.bottom;

  const all = series.flatMap((s) => s.values).filter((v): v is number => v != null && Number.isFinite(v));
  const n = labels.length;

  if (n === 0 || all.length === 0) {
    return (
      <div className="empty" style={{ padding: 'var(--gap-5)' }}>
        <p className="u-dim">Aucune donnée à représenter.</p>
      </div>
    );
  }

  let lo = domain ? domain[0] : Math.min(...all);
  let hi = domain ? domain[1] : Math.max(...all);
  if (!domain) {
    const span = hi - lo || 1;
    lo -= span * 0.12;
    hi += span * 0.12;
    if (lo > 0 && span / (hi - lo) < 0.35) lo = Math.max(0, lo - span * 0.4);
  }
  if (hi === lo) hi = lo + 1;

  const x = (i: number) => PAD.left + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => PAD.top + ih - ((v - lo) / (hi - lo)) * ih;

  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => lo + ((hi - lo) * i) / ticks);
  const xTickIdx = Array.from({ length: xTicks }, (_, i) =>
    Math.round((i * (n - 1)) / Math.max(1, xTicks - 1)),
  );

  const fmtY = formatY ?? ((v: number) => formatNumber(v, Math.abs(v) < 10 ? 1 : 0));

  return (
    <div>
      <svg
        className="chart"
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        role="img"
        style={{ height: h }}
      >
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`${uid}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0.02" />
            </linearGradient>
          ))}
        </defs>

        {/* Grille horizontale */}
        <g className="chart__grid">
          {yTicks.map((t, i) => (
            <line key={i} x1={PAD.left} x2={w - PAD.right} y1={y(t)} y2={y(t)} strokeDasharray={i === 0 ? undefined : '2 4'} />
          ))}
        </g>

        {/* Axe Y */}
        <g className="chart__axis">
          {yTicks.map((t, i) => (
            <text key={i} x={PAD.left - 6} y={y(t) + 3} textAnchor="end">
              {fmtY(t)}
            </text>
          ))}
          {unit && (
            <text x={PAD.left - 6} y={PAD.top - 2} textAnchor="end" style={{ fontSize: 8.5 }}>
              {unit}
            </text>
          )}
        </g>

        {/* Axe X */}
        <g className="chart__axis">
          {xTickIdx.map((i, k) => (
            <text key={k} x={x(i)} y={h - 6} textAnchor={k === 0 ? 'start' : k === xTickIdx.length - 1 ? 'end' : 'middle'}>
              {labels[i]}
            </text>
          ))}
        </g>

        {/* Instant présent */}
        {highlightIndex != null && highlightIndex >= 0 && highlightIndex < n && (
          <g>
            <line
              x1={x(highlightIndex)}
              x2={x(highlightIndex)}
              y1={PAD.top}
              y2={PAD.top + ih}
              stroke="var(--clay-500)"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
            <text
              x={x(highlightIndex)}
              y={PAD.top - 1}
              textAnchor="middle"
              className="chart__label"
              style={{ fill: 'var(--clay-600)' }}
            >
              maintenant
            </text>
          </g>
        )}

        {/* Séries */}
        {series.map((s) => {
          const pts: { i: number; v: number }[] = [];
          s.values.forEach((v, i) => {
            if (v != null && Number.isFinite(v)) pts.push({ i, v });
          });
          if (pts.length === 0) return null;

          const d = pts.map((p, k) => `${k === 0 ? 'M' : 'L'}${x(p.i)},${y(p.v)}`).join(' ');
          const areaD = `${d} L${x(pts[pts.length - 1].i)},${y(lo)} L${x(pts[0].i)},${y(lo)} Z`;

          return (
            <g key={s.key}>
              {s.area && <path d={areaD} fill={`url(#${uid}-${s.key})`} className="chart__area" />}
              <path
                d={d}
                className="chart__line"
                stroke={s.color}
                strokeWidth={s.width ?? 2}
                strokeDasharray={s.dashed ? '4 4' : undefined}
              />
              {pts.length <= 30 &&
                pts.map((p, k) => (
                  <circle key={k} cx={x(p.i)} cy={y(p.v)} r={highlightIndex === p.i ? 3.5 : 2} fill={s.color} className="chart__dot" />
                ))}
            </g>
          );
        })}
      </svg>
      {series.length > 1 && (
        <div className="legend" style={{ marginTop: 8 }}>
          {series.map((s) => (
            <span key={s.key} className="legend__item">
              <span className="legend__swatch" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

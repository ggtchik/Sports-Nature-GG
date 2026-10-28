import type { ReactNode } from 'react';

interface MetricProps {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  sub?: ReactNode;
  tone?: 'plain' | 'forest' | 'water' | 'clay' | 'sky';
  size?: 'md' | 'lg';
  icon?: ReactNode;
}

export function Metric({
  label,
  value,
  unit,
  sub,
  tone = 'plain',
  size = 'md',
  icon,
}: MetricProps) {
  const cls = [
    'metric',
    tone !== 'plain' ? `metric--${tone}` : '',
    size === 'lg' ? 'metric--lg' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cls}>
      <div className="metric__label">
        {icon && <span aria-hidden="true">{icon}</span>}
        {label}
      </div>
      <div className="metric__value">
        <span className="u-num">{value}</span>
        {unit && <small>{unit}</small>}
      </div>
      {sub && <div className="metric__sub">{sub}</div>}
    </div>
  );
}

interface MetricGridProps {
  children: ReactNode;
  cols?: 2 | 3 | 4;
}

export function MetricGrid({ children, cols = 4 }: MetricGridProps) {
  return <div className={`grid grid--${cols}`}>{children}</div>;
}

import type { ReactNode } from 'react';

type Tone = 'neutral' | 'forest' | 'water' | 'clay' | 'sky' | 'ok' | 'warn' | 'danger';

interface ChipProps {
  children: ReactNode;
  tone?: Tone;
  size?: 'sm' | 'lg';
  dot?: boolean;
  pulse?: boolean;
  title?: string;
}

export function Chip({ children, tone = 'neutral', size, dot, pulse, title }: ChipProps) {
  const cls = [
    'chip',
    tone !== 'neutral' ? `chip--${tone}` : '',
    size === 'lg' ? 'chip--lg' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <span className={cls} title={title}>
      {dot && <span className={`chip__dot${pulse ? ' chip__dot--pulse' : ''}`} aria-hidden="true" />}
      {children}
    </span>
  );
}

interface SegmentOption<T extends string> {
  id: T;
  label: string;
  hint?: string;
}

interface SegmentProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  block?: boolean;
  ariaLabel: string;
}

export function Segment<T extends string>({
  options,
  value,
  onChange,
  block,
  ariaLabel,
}: SegmentProps<T>) {
  return (
    <div className={`segment${block ? ' segment--block' : ''}`} role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className="segment__btn"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
        >
          {o.label}
          {o.hint && <small>{o.hint}</small>}
        </button>
      ))}
    </div>
  );
}

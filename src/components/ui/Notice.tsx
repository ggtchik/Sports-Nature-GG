import type { ReactNode } from 'react';

type Tone = 'info' | 'warn' | 'danger' | 'ok';

const ICONS: Record<Tone, string> = {
  info: 'ℹ️',
  warn: '⚠️',
  danger: '⛔',
  ok: '✅',
};

interface NoticeProps {
  tone?: Tone;
  title?: ReactNode;
  children: ReactNode;
  icon?: ReactNode;
}

export function Notice({ tone = 'info', title, children, icon }: NoticeProps) {
  return (
    <div className={`notice notice--${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <span className="notice__icon" aria-hidden="true">
        {icon ?? ICONS[tone]}
      </span>
      <div>
        {title && <b>{title}</b>}
        <div>{children}</div>
      </div>
    </div>
  );
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ icon = '🧭', title, children, action }: EmptyStateProps) {
  return (
    <div className="empty">
      <div className="empty__icon" aria-hidden="true">
        {icon}
      </div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

interface SkeletonProps {
  width?: string;
  height?: string;
  variant?: 'text' | 'title' | 'block';
}

export function Skeleton({ width, height, variant = 'text' }: SkeletonProps) {
  const cls = [
    'skeleton',
    variant === 'title' ? 'skeleton--title' : '',
    variant === 'block' ? 'skeleton--block' : 'skeleton--text',
  ]
    .filter(Boolean)
    .join(' ');
  return <div className={cls} style={{ width, height }} aria-hidden="true" />;
}

export function LoadingBlock({ lines = 3 }: { lines?: number }) {
  return (
    <div className="stack stack--sm" aria-busy="true" aria-live="polite">
      <Skeleton variant="title" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={`${95 - i * 12}%`} />
      ))}
    </div>
  );
}

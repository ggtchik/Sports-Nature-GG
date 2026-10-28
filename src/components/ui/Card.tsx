import type { ReactNode } from 'react';

interface CardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  iconTone?: 'forest' | 'water' | 'clay' | 'sky';
  actions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  flush?: boolean;
  tight?: boolean;
  className?: string;
  as?: 'section' | 'div' | 'article';
}

export function Card({
  title,
  subtitle,
  icon,
  iconTone,
  actions,
  children,
  footer,
  flush,
  tight,
  className = '',
  as: Tag = 'section',
}: CardProps) {
  const tone = iconTone ? `card__icon--${iconTone}` : '';
  return (
    <Tag className={`card ${className}`}>
      {(title || actions) && (
        <header className="card__head">
          {icon && <div className={`card__icon ${tone}`}>{icon}</div>}
          <div className="card__title">
            {typeof title === 'string' ? <h3>{title}</h3> : title}
            {subtitle && <span>{subtitle}</span>}
          </div>
          {actions && <div className="row row--wrap" style={{ gap: 8 }}>{actions}</div>}
        </header>
      )}
      <div
        className={`card__body${flush ? ' card__body--flush' : ''}${tight ? ' card__body--tight' : ''}`}
      >
        {children}
      </div>
      {footer && <footer className="card__foot">{footer}</footer>}
    </Tag>
  );
}

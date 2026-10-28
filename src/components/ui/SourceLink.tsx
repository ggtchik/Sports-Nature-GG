import type { FreshnessLevel, SourceLink } from '@/types';

const TONE: Record<FreshnessLevel, 'ok' | 'warn' | 'danger'> = {
  realtime: 'ok',
  delayed: 'warn',
  unavailable: 'danger',
};

const LABEL: Record<FreshnessLevel, string> = {
  realtime: 'Temps réel',
  delayed: 'Différé',
  unavailable: 'Indisponible',
};

interface SourceLinkItemProps {
  source: SourceLink;
  /** Affiche l'horodatage de dernière mise à jour si disponible. */
  showUpdated?: boolean;
  timeContext?: { timezone: string; utcOffsetSeconds: number };
}

/**
 * Lien « Source des données » — §17.
 * Chaque module expose un lien cliquable vers la source qu'il utilise.
 */
export function SourceLinkItem({ source, showUpdated = true }: SourceLinkItemProps) {
  return (
    <a className="source-item" href={source.url} target="_blank" rel="noreferrer noopener">
      <span className={`chip chip--${TONE[source.freshness]}`} style={{ flexShrink: 0 }}>
        <span className="chip__dot" aria-hidden="true" />
        {LABEL[source.freshness]}
      </span>
      <span className="source-item__body">
        <span className="source-item__label">{source.label}</span>
        <span className="source-item__meta">
          {source.role}
          {source.freshnessLabel ? ` · ${source.freshnessLabel}` : ''}
          {showUpdated && source.updatedAt ? ` · Dernière mise à jour ${formatStamp(source.updatedAt)}` : ''}
        </span>
      </span>
      <span className="source-item__arrow" aria-hidden="true">
        ↗
      </span>
    </a>
  );
}

function formatStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

interface SourceListProps {
  sources: SourceLink[];
}

export function SourceList({ sources }: SourceListProps) {
  return (
    <div className="source-list">
      {sources.map((s) => (
        <SourceLinkItem key={s.url + s.label} source={s} />
      ))}
    </div>
  );
}

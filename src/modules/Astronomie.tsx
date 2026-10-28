/**
 * Informations astronomiques (§7) — lever / coucher du soleil, durée du jour,
 * phase et illumination de la Lune, représentation graphique.
 */

import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { MoonDisc, SunArc } from '@/components/charts/SunArc';
import { formatTime, formatDateShort, formatNumber } from '@/core/format';
import { formatSeconds } from '@/core/units';
import type { AstronomyData } from '@/types';

interface TimeContext {
  timezone: string;
  utcOffsetSeconds: number;
}

interface Props {
  astronomy: AstronomyData | null;
  timeContext: TimeContext;
}

export function Astronomie({ astronomy, timeContext }: Props) {
  if (!astronomy) {
    return (
      <Card title="Astronomie" icon="🌅" iconTone="clay">
        <p className="u-dim">Sélectionnez un spot pour afficher les données astronomiques.</p>
      </Card>
    );
  }

  const now = new Date();

  return (
    <Card
      title="Astronomie"
      subtitle="Lever / coucher du soleil, durée du jour, phase lunaire"
      icon="🌅"
      iconTone="clay"
      actions={<Chip tone="clay">Calcul local · précision ± 1 min</Chip>}
      footer={
        <>
          <span>
            Aube civile {formatTime(astronomy.civilDawn, timeContext)} · Crépuscule civil{' '}
            {formatTime(astronomy.civilDusk, timeContext)}
          </span>
          <span>
            · Lever de Lune {formatTime(astronomy.moonrise, timeContext)} · Coucher{' '}
            {formatTime(astronomy.moonset, timeContext)} (± 30 min)
          </span>
        </>
      }
    >
      <div className="stack">
        <SunArc
          sunrise={astronomy.sunrise}
          sunset={astronomy.sunset}
          solarNoon={astronomy.solarNoon}
          now={now}
          timeContext={timeContext}
        />

        <div className="split" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 'var(--gap-4)' }}>
          <div className="stack stack--sm">
            <span className="field__label">Soleil</span>
            <dl className="kv">
              <dt>Lever</dt>
              <dd>{formatTime(astronomy.sunrise, timeContext)}</dd>
              <dt>Midi solaire</dt>
              <dd>{formatTime(astronomy.solarNoon, timeContext)}</dd>
              <dt>Coucher</dt>
              <dd>{formatTime(astronomy.sunset, timeContext)}</dd>
              <dt>Durée du jour</dt>
              <dd>{formatSeconds(astronomy.dayLengthSeconds ?? NaN)}</dd>
            </dl>
          </div>

          <div className="stack stack--sm">
            <span className="field__label">Lune</span>
            <div className="row" style={{ gap: 'var(--gap-4)', alignItems: 'center' }}>
              <MoonDisc phase={astronomy.moonPhase} illumination={astronomy.moonIllumination} size={78} />
              <dl className="kv" style={{ flex: 1 }}>
                <dt>Phase</dt>
                <dd style={{ textAlign: 'right' }}>{astronomy.moonPhaseName}</dd>
                <dt>Illumination</dt>
                <dd>{formatNumber(astronomy.moonIllumination * 100, 0)} %</dd>
                <dt>Âge</dt>
                <dd>{formatNumber(astronomy.moonAgeDays, 1)} j</dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="row row--wrap" style={{ gap: 8 }}>
          <Chip tone="clay">☀️ Jour {formatSeconds(astronomy.dayLengthSeconds ?? NaN)}</Chip>
          <Chip tone="neutral">
            🌙 Nuit{' '}
            {astronomy.dayLengthSeconds != null
              ? formatSeconds(86400 - astronomy.dayLengthSeconds)
              : '—'}
          </Chip>
          <Chip tone={astronomy.moonIllumination > 0.6 ? 'sky' : 'neutral'}>
            {astronomy.moonIllumination > 0.6 ? '🌕 Nuit claire' : '🌑 Nuit sombre'}
          </Chip>
          <Chip tone="neutral">Calculé le {formatDateShort(astronomy.computedAt, timeContext)}</Chip>
        </div>
      </div>
    </Card>
  );
}

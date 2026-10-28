/**
 * Sources — §16, §17.
 * Registre documenté de toutes les sources examinées : API, gratuité, clé,
 * accessibilité navigateur, fréquence réelle de mise à jour, licence.
 */

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { SourceList } from '@/components/ui/SourceLink';
import { SOURCE_REGISTRY } from '@/services/sources';
import type { SourceLink } from '@/types';

interface Props {
  /** Sources effectivement utilisées par le dashboard courant. */
  active: SourceLink[];
}

export function Sources({ active }: Props) {
  const [showAll, setShowAll] = useState(false);

  const activeLabels = new Set(active.map((s) => s.label));
  const others = SOURCE_REGISTRY.filter((s) => !activeLabels.has(s.label));

  return (
    <div className="stack">
      <Card
        title="Sources des données"
        subtitle="Chaque module renvoie vers la source qu'il utilise"
        icon="🔗"
        iconTone="forest"
        actions={
          <button type="button" className="btn btn--sm btn--ghost" onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'Masquer le registre complet' : 'Voir le registre complet'}
          </button>
        }
        footer={
          <span>
            Aucune donnée n’est inventée ni remplacée : lorsqu’une source est muette, le module
            l’indique explicitement.
          </span>
        }
      >
        <SourceList sources={active} />
      </Card>

      {showAll && (
        <Card
          title="Registre des sources examinées"
          subtitle="Conditions d'utilisation, API, gratuité, clé, accès navigateur, fréquence de mise à jour"
          icon="📚"
          iconTone="forest"
        >
          <div className="table-wrap">
            <table className="table table--cards">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>API</th>
                  <th>Clé</th>
                  <th>Navigateur</th>
                  <th>Mise à jour réelle</th>
                  <th>Licence</th>
                </tr>
              </thead>
              <tbody>
                {SOURCE_REGISTRY.map((s) => (
                  <tr key={s.label}>
                    <td data-label="Source">
                      <a href={s.url} target="_blank" rel="noreferrer noopener">
                        {s.label}
                      </a>
                      <div className="u-dim" style={{ fontSize: 'var(--t-xs)', fontWeight: 400 }}>
                        {s.reviewNote}
                      </div>
                    </td>
                    <td data-label="API">
                      <Chip tone={s.api ? 'ok' : 'neutral'}>{s.api ? 'Oui' : 'Non'}</Chip>
                    </td>
                    <td data-label="Clé">
                      <Chip tone={s.apiKey ? 'warn' : 'ok'}>{s.apiKey ? 'Requise' : 'Aucune'}</Chip>
                    </td>
                    <td data-label="Navigateur">
                      <Chip tone={s.browserAccessible ? 'ok' : 'warn'}>
                        {s.browserAccessible ? 'Directe' : 'Non'}
                      </Chip>
                    </td>
                    <td data-label="Mise à jour">{s.updateFrequency}</td>
                    <td data-label="Licence">{s.license}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {others.length > 0 && (
            <>
              <hr className="divider" />
              <span className="field__label">Autres sources examinées (liens de consultation)</span>
              <div style={{ marginTop: 'var(--gap-3)' }}>
                <SourceList sources={others} />
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
}

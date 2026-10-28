/**
 * Réglages — sélecteur d'unités, frais de déplacement, clé api-maree.fr,
 * gestion du stockage local.
 */

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Notice } from '@/components/ui/Notice';
import { UnitSelector } from '@/components/UnitSelector';
import { useApp } from '@/state/AppProvider';
import { idbClear } from '@/core/storage';
import { formatDistance, formatSpeed } from '@/core/units';

export function Reglages() {
  const { state, setUnits, setCosts, setTideApiKey, persisted, deleteSpot } = useApp();
  const [cleared, setCleared] = useState(false);
  const [showKey, setShowKey] = useState(false);

  return (
    <div className="stack stack--lg">
      <Card
        title="Unités de mesure"
        subtitle="Sélecteur global — appliqué immédiatement à toute l'application"
        icon="📐"
        iconTone="clay"
      >
        <div className="stack">
          <UnitSelector value={state.units} onChange={setUnits} block />
          <div className="row row--wrap" style={{ gap: 8 }}>
            <Chip tone="forest">Distance : {formatDistance(12.4, state.units)}</Chip>
            <Chip tone="water">Vent : {formatSpeed(24, state.units)}</Chip>
            <Chip tone="neutral">Hauteur : toujours en m</Chip>
            <Chip tone="neutral">Pression : toujours en hPa</Chip>
          </div>
        </div>
      </Card>

      <Card
        title="Frais de déplacement"
        subtitle="Paramètres utilisés pour l'estimation du tableau des frais"
        icon="🚗"
        iconTone="clay"
      >
        <div className="settings-grid">
          <div className="field">
            <label className="field__label" htmlFor="set-consumption">
              Consommation (L/100 km)
            </label>
            <input
              id="set-consumption"
              className="input"
              type="number"
              min={0}
              max={40}
              step={0.1}
              value={state.costs.consumptionL100}
              onChange={(e) => setCosts({ consumptionL100: Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="set-fuel">
              Prix du carburant (€/L)
            </label>
            <input
              id="set-fuel"
              className="input"
              type="number"
              min={0}
              max={10}
              step={0.01}
              value={state.costs.fuelPricePerL}
              onChange={(e) => setCosts({ fuelPricePerL: Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="set-tolls">
              Péages (€)
            </label>
            <input
              id="set-tolls"
              className="input"
              type="number"
              min={0}
              step={0.5}
              value={state.costs.tolls}
              onChange={(e) => setCosts({ tolls: Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="set-lodging">
              Hébergement (€)
            </label>
            <input
              id="set-lodging"
              className="input"
              type="number"
              min={0}
              step={5}
              value={state.costs.lodging}
              onChange={(e) => setCosts({ lodging: Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="set-other">
              Autres frais (€)
            </label>
            <input
              id="set-other"
              className="input"
              type="number"
              min={0}
              step={5}
              value={state.costs.other}
              onChange={(e) => setCosts({ other: Number(e.target.value) })}
            />
          </div>
        </div>
        <div style={{ marginTop: 'var(--gap-4)' }}>
          <label className="toggle">
            <input
              type="checkbox"
              checked={state.costs.useDrivingDistance}
              onChange={(e) => setCosts({ useDrivingDistance: e.target.checked })}
            />
            <span className="toggle__track" aria-hidden="true" />
            <span>Utiliser la distance routière estimée pour le calcul du carburant</span>
          </label>
        </div>
      </Card>

      <Card
        title="Marées — source officielle (optionnel)"
        subtitle="api-maree.fr : atlas de composantes harmoniques Ifremer / PREVIMER (CC BY)"
        icon="🌊"
        iconTone="water"
        footer={
          <span>
            Sans clé, l’application utilise le modèle de niveau marin d’Open-Meteo (indicatif). La clé
            reste dans votre navigateur : elle n’est jamais transmise à un serveur de l’application.
          </span>
        }
      >
        <div className="stack">
          <div className="field">
            <label className="field__label" htmlFor="set-tide-key">
              Clé API api-maree.fr (gratuite)
            </label>
            <div className="input-group">
              <input
                id="set-tide-key"
                className="input"
                type={showKey ? 'text' : 'password'}
                value={state.tideApiKey}
                onChange={(e) => setTideApiKey(e.target.value)}
                placeholder="Coller votre clé"
                autoComplete="off"
              />
              <button type="button" className="btn" onClick={() => setShowKey((v) => !v)}>
                {showKey ? 'Masquer' : 'Afficher'}
              </button>
            </div>
            <span className="field__hint">
              Créez un compte gratuit sur{' '}
              <a href="https://api-maree.fr/" target="_blank" rel="noreferrer noopener">
                api-maree.fr
              </a>{' '}
              puis collez la clé ici. 360 requêtes/heure. Fournit horaires, hauteurs au-dessus du zéro
              hydrographique et coefficients de marée.
            </span>
          </div>
          {state.tideApiKey ? (
            <Notice tone="ok" title="Clé renseignée">
              Les marées utiliseront en priorité l’atlas harmonique. En cas d’échec, l’application
              bascule automatiquement sur le modèle numérique.
            </Notice>
          ) : (
            <Notice tone="info" title="Aucune clé renseignée">
              Les marées proviendront du modèle de niveau marin Open-Meteo, clairement identifié comme
              indicatif dans le dashboard.
            </Notice>
          )}
        </div>
      </Card>

      <Card
        title="Stockage local"
        subtitle="Spots, préférences et cache de données"
        icon="💾"
        iconTone="forest"
        actions={
          <Chip tone={persisted ? 'ok' : 'danger'} dot pulse>
            {persisted ? 'Disponible' : 'Indisponible'}
          </Chip>
        }
      >
        <div className="stack">
          {!persisted && (
            <Notice tone="warn" title="Stockage local bloqué">
              Votre navigateur refuse le stockage local (navigation privée ou cookies bloqués). Les
              spots et préférences ne seront pas conservés après fermeture.
            </Notice>
          )}
          <p>
            {state.spots.length} spot{state.spots.length > 1 ? 's' : ''} enregistré
            {state.spots.length > 1 ? 's' : ''} dans ce navigateur.
          </p>
          <div className="row row--wrap">
            <button
              type="button"
              className="btn btn--sm"
              onClick={async () => {
                await idbClear();
                setCleared(true);
                window.setTimeout(() => setCleared(false), 2500);
              }}
            >
              🧹 Vider le cache de données
            </button>
            <button
              type="button"
              className="btn btn--sm btn--danger"
              onClick={() => {
                if (window.confirm('Supprimer tous les spots enregistrés ?')) {
                  state.spots.forEach((s) => deleteSpot(s.id));
                }
              }}
            >
              🗑️ Supprimer tous les spots
            </button>
          </div>
          {cleared && <Notice tone="ok">Cache vidé.</Notice>}
        </div>
      </Card>
    </div>
  );
}

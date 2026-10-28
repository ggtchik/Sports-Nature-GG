import { SOURCE_REGISTRY } from '@/services/sources';

export function Footer() {
  const keyless = SOURCE_REGISTRY.filter((s) => !s.apiKey && s.api).length;
  return (
    <footer className="footer">
      <div className="footer__inner">
        <div className="footer__col">
          <b>GG Sports-Nature</b>
          <span>
            Station de préparation et d’aide à la décision pour les activités de plein air et
            nautiques.
          </span>
          <span className="u-dim">
            Fiabilité → Pertinence → Lisibilité → Simplicité → Esthétique
          </span>
        </div>
        <div className="footer__col">
          <b>Données</b>
          <span>{keyless} sources API ouvertes, sans clé, accessibles depuis le navigateur.</span>
          <span>
            Aucune donnée n’est inventée : une source muette est signalée comme indisponible.
          </span>
        </div>
        <div className="footer__col">
          <b>Vie privée</b>
          <span>
            Spots et préférences stockés localement (LocalStorage / IndexedDB). Aucun compte, aucun
            serveur, aucune donnée transmise à des tiers.
          </span>
        </div>
        <div className="footer__col">
          <b>Avertissement</b>
          <span>
            Les données marines et de marée sont des modèles numériques à titre indicatif. Elles ne
            remplacent pas les bulletins officiels (SHOM, Météo-France, Vigicrues) et sont impropres
            à la navigation.
          </span>
        </div>
      </div>
    </footer>
  );
}

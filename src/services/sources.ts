/**
 * Registre des sources — §16, §17 du cahier des charges.
 *
 * Chaque source est documentée : conditions d'utilisation, existence d'une API,
 * gratuité, clé nécessaire, accessibilité depuis le navigateur, fréquence réelle
 * de mise à jour. Le dashboard affiche un lien cliquable par module (§17).
 */

import type { SourceLink } from '@/types';

export interface SourceDoc extends SourceLink {
  api: boolean;
  apiKey: boolean;
  browserAccessible: boolean;
  license: string;
  updateFrequency: string;
  /** Étudie / non étudié — §16 demande un examen explicite. */
  reviewed: boolean;
  reviewNote: string;
}

export const SOURCE_REGISTRY: SourceDoc[] = [
  {
    label: 'Open-Meteo — Weather Forecast API',
    url: 'https://open-meteo.com/en/docs',
    role: 'Météo, vent, rafales, UV, pression, prévisions 5 jours',
    freshness: 'realtime',
    freshnessLabel: 'Temps réel — modèles ré-initialisés toutes les 1 à 6 h',
    updatedAt: null,
    api: true,
    apiKey: false,
    browserAccessible: true,
    license: 'CC BY 4.0 — gratuit pour usage non commercial',
    updateFrequency: 'Météo-France AROME 1 h, ARPEGE 1 h, DWD ICON 3 h, ECMWF IFS 6 h, NOAA GFS 1 h',
    reviewed: true,
    reviewNote:
      'Aucune clé requise, CORS complet, aucune donnée personnelle collectée. Source retenue en primaire pour la météo car elle agrège Météo-France.',
  },
  {
    label: 'Open-Meteo — Marine Weather API',
    url: 'https://open-meteo.com/en/docs/marine-weather-api',
    role: 'Houle, vagues, température de l’eau, courants, niveau marin',
    freshness: 'delayed',
    freshnessLabel: 'Modèles mis à jour toutes les 6 à 24 h',
    updatedAt: null,
    api: true,
    apiKey: false,
    browserAccessible: true,
    license: 'CC BY 4.0 — gratuit pour usage non commercial',
    updateFrequency: 'Copernicus Marine (MFWAM/SMOC) toutes les 12 à 24 h, DWD EWAM/GWAM 2×/jour',
    reviewed: true,
    reviewNote:
      'Résolution 0,08° (≈ 8 km) : précision limitée en zone côtière, ce qui est indiqué à l’écran. Ne remplace pas un bulletin officiel.',
  },
  {
    label: 'Hub’Eau — API Hydrométrie (OFB / SANDRE)',
    url: 'https://hubeau.eaufrance.fr/page/api-hydrometrie',
    role: 'Hauteurs d’eau et débits des stations du réseau français',
    freshness: 'realtime',
    freshnessLabel: 'Quasi temps réel — 5 à 60 min selon les producteurs',
    updatedAt: null,
    api: true,
    apiKey: false,
    browserAccessible: true,
    license: 'Licence Ouverte Etalab 2.0',
    updateFrequency: 'Bancarisation toutes les 5 à 60 min ; Hub’Eau interroge la source toutes les 2 min',
    reviewed: true,
    reviewNote:
      'Diffuse le réseau national (DREAL, SCHAPI / Vigicrues) : priorité respectée au §12. Historique d’un mois pour le temps réel.',
  },
  {
    label: 'Géoplateforme — API de géocodage (IGN / BAN)',
    url: 'https://cartes.gouv.fr/aide/fr/guides-utilisateur/utiliser-les-services-de-la-geoplateforme/geocodage/',
    role: 'Adresse, commune, code postal → coordonnées (et inverse)',
    freshness: 'realtime',
    freshnessLabel: 'Base BAN actualisée chaque semaine',
    updatedAt: null,
    api: true,
    apiKey: false,
    browserAccessible: true,
    license: 'Licence Ouverte Etalab 2.0',
    updateFrequency: 'Actualisation hebdomadaire de la Base Adresse Nationale',
    reviewed: true,
    reviewNote:
      'Remplace api-adresse.data.gouv.fr (décommissionnée). Limite : 50 requêtes/s/IP. Repli sur l’API Adresse puis Nominatim.',
  },
  {
    label: 'OpenStreetMap — Overpass API',
    url: 'https://overpass-api.de/api/interpreter',
    role: 'Tracé de la laisse de haute mer (détection du milieu AUTO)',
    freshness: 'realtime',
    freshnessLabel: 'Base contributive, mise à jour continue',
    updatedAt: null,
    api: true,
    apiKey: false,
    browserAccessible: true,
    license: 'ODbL — © les contributeurs d’OpenStreetMap',
    updateFrequency: 'Continue (édition collaborative)',
    reviewed: true,
    reviewNote:
      'CORS confirmé. Service contributif : en cas d’indisponibilité, repli automatique sur Natural Earth 110 m embarqué.',
  },
  {
    label: 'Natural Earth 110 m',
    url: 'https://www.naturalearthdata.com/',
    role: 'Polygones des terres émergées (repli hors ligne)',
    freshness: 'delayed',
    freshnessLabel: 'Jeu de données statique — précision indicative (± quelques km à quelques dizaines de km)',
    updatedAt: null,
    api: false,
    apiKey: false,
    browserAccessible: true,
    license: 'Domaine public',
    updateFrequency: 'Statique',
    reviewed: true,
    reviewNote:
      'Fichier embarqué (55 Ko) : la détection du milieu fonctionne même sans réseau. Résolution 110 m : jusqu’à ~35 km d’écart sur une côte lisse (baie de Seine). Écart systématiquement signalé à l’écran.',
  },
  {
    label: 'OpenStreetMap — tuiles cartographiques',
    url: 'https://www.openstreetmap.org/copyright',
    role: 'Fond de carte Leaflet',
    freshness: 'realtime',
    freshnessLabel: 'Rendu à la demande',
    updatedAt: null,
    api: false,
    apiKey: false,
    browserAccessible: true,
    license: 'ODbL — © les contributeurs d’OpenStreetMap',
    updateFrequency: 'Continue',
    reviewed: true,
    reviewNote:
      'Solution cartographique gratuite et open source retenue au §14. Leaflet (BSD-2-Clause) est embarqué dans l’application.',
  },
  {
    label: 'api-maree.fr (optionnel)',
    url: 'https://api-maree.fr/documentation',
    role: 'Horaires, hauteurs et coefficients de marée',
    freshness: 'realtime',
    freshnessLabel: 'Calculs astronomiques — 360 requêtes/h par compte gratuit',
    updatedAt: null,
    api: true,
    apiKey: true,
    browserAccessible: true,
    license: 'Données Ifremer / PREVIMER sous CC BY',
    updateFrequency: 'Calcul à la demande, fenêtre J-30 / J+30',
    reviewed: true,
    reviewNote:
      'Source la plus fiable pour les coefficients. Nécessite une clé gratuite : celle-ci est saisie par l’utilisateur et conservée dans son navigateur — aucune clé n’est embarquée dans le code (§22).',
  },
  {
    label: 'SHOM — annuaire des marées',
    url: 'https://maree.shom.fr/',
    role: 'Référence officielle française des marées',
    freshness: 'realtime',
    freshnessLabel: 'Mise à jour quotidienne',
    updatedAt: null,
    api: true,
    apiKey: true,
    browserAccessible: false,
    license: 'Licence commerciale pour la réutilisation automatisée',
    updateFrequency: 'Quotidienne',
    reviewed: true,
    reviewNote:
      'L’API SHOM (SUP Marée / SAPM) est payante et exige une clé : elle n’est donc pas appelée par l’application. Le lien officiel est proposé à l’utilisateur pour consultation (§16).',
  },
  {
    label: 'Météo-France',
    url: 'https://meteofrance.fr/',
    role: 'Référence nationale de la prévision',
    freshness: 'realtime',
    freshnessLabel: 'Vigilance et prévisions nationales',
    updatedAt: null,
    api: false,
    apiKey: false,
    browserAccessible: true,
    license: 'Réutilisation soumise à conditions',
    updateFrequency: 'Plusieurs fois par jour',
    reviewed: true,
    reviewNote:
      'Ses modèles AROME et ARPEGE sont consommés indirectement via Open-Meteo, qui en assure la diffusion API ouverte. Le site officiel est proposé en lien pour la vigilance.',
  },
  {
    label: 'Windguru / Windy / Surf-Report',
    url: 'https://www.windy.com/',
    role: 'Références externes de consultation (spécialisées vent / surf)',
    freshness: 'realtime',
    freshnessLabel: 'Selon le service',
    updatedAt: null,
    api: false,
    apiKey: false,
    browserAccessible: true,
    license: 'Propriétaire — consultation seule',
    updateFrequency: 'Variable',
    reviewed: true,
    reviewNote:
      'Aucune API publique gratuite et sans clé : ces services sont proposés en liens de consultation seulement, pas en source de données intégrée (§16).',
  },
];

export function sourceByLabel(label: string): SourceDoc | undefined {
  return SOURCE_REGISTRY.find((s) => s.label === label);
}

/** Rendu « Source des données » cliquable (§17). */
export function sourceLinkProps(s: { url: string; label: string }) {
  return {
    href: s.url,
    target: '_blank',
    rel: 'noreferrer noopener',
  };
}

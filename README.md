# GG Sports-Nature

**Station de préparation et d'aide à la décision** pour les activités de plein
air et nautiques. L'application guide l'utilisateur de sa position de départ
jusqu'à un tableau de bord complet, en n'affichant que les données réellement
disponibles — jamais une donnée inventée ni présentée à tort comme temps réel.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # vérification des types + bundle de production
npm test           # tests de logique + tests d'intégration navigateur
```

---

## 1. Parcours utilisateur (§24)

| Étape | Écran | Contenu |
|---|---|---|
| 1 | **Position** | 📍 Ma position actuelle (géolocalisation) · 📍 Saisir une position (adresse, commune, code postal, lieu, coordonnées) |
| 2 | **Activité** | 🥾 Balade · 🏔️ Randonnée · 🏃 Jogging · 🏊 Natation · ⛵ **Nautisme** · 🎣 Pêche · 🦌 Chasse |
| 3 | **Spot** | Recherche par nom, commune, code postal, coordonnées ou spot enregistré ; création / modification / suppression, persistée localement |
| 4 | **Milieu** | Détection automatique (< 5 km d'une zone maritime ⇒ potentiellement maritime) et forçage manuel **AUTO · MER · EAU DOUCE**, toujours prioritaire |
| 5 | **Unités** | **Standard** · **Nautique** · **Double** |
| 6 | **Dashboard** | 8 modules dans l'ordre imposé, plus une carte |

Le passage d'une étape à la suivante est automatique dès que la saisie est
complète ; le bandeau supérieur reste utilisable pour revenir en arrière.

## 2. Sources de données

Toutes les sources utilisées par défaut sont **ouvertes, sans clé API et
accessibles depuis le navigateur** (CORS) — aucune clé secrète n'est exposée
(§22).

| Donnée | Source | Fraîcheur |
|---|---|---|
| Météo | Open-Meteo `Best Match` (Météo-France AROME/ARPEGE, DWD ICON, ECMWF IFS, NOAA GFS) | temps réel, mise à jour continue |
| Marine | Open-Meteo Marine (Copernicus Marine / Météo-France MFWAM & SMOC, DWD EWAM/GWAM) | modèle diffusé toutes les 6 à 24 h |
| Marée | Niveau marin modélisé (PM/BM, hauteurs, courbe) — *indicatif* | modèle diffusé toutes les 24 h |
| Hydrométrie | Hub'Eau — API Hydrométrie (OFB / SANDRE) | observations bancarisées toutes les 5 à 60 min |
| Géocodage | API Géoplateforme (IGN), repli API Adresse, repli Nominatim | continu |
| Trait de côte | OpenStreetMap (laisse de haute mer, via Overpass) | continu |
| Carte | Leaflet + tuiles OpenStreetMap (ODbL) | — |
| **Astronomie** | **Calcul local** (NOAA pour le soleil, Meeus pour la lune) | — |

**Fiabilité des marées.** Les horaires et hauteurs sont déduits d'un modèle
numérique de niveau marin de résolution ≈ 8 km. Ils sont systématiquement
étiquetés « indicatifs », ne remplacent pas l'annuaire officiel du SHOM et sont
impropres à la navigation. Un lien vers le SHOM est proposé en complément.

**Précision du trait de côte.** La distance à la côte est calculée à partir
d'OpenStreetMap quand il est joignable. À défaut, un tracé Natural Earth 110 m
embarqué (`public/data/land-110m.json`) donne un ordre de grandeur **indicatif**
— l'écart peut atteindre quelques kilomètres sur les côtes lisses. La précision
effective est toujours affichée à l'écran.

## 3. Unités (§6)

Le sélecteur est global et s'applique instantanément, sans rechargement.

| Mode | Distance | Vitesse |
|---|---|---|
| Standard | km | km/h |
| Nautique | NM | kn (les informations terrestres restent en km / km/h) |
| Double | `12,4 km / 6,7 NM` | `24 km/h / 13 kn` |

Les valeurs sont conservées dans leur unité d'origine et converties
**uniquement à l'affichage** (`1 NM = 1,852 km`, `1 kn = 1,852 km/h`). Les
hauteurs restent en mètres et les pressions en hPa dans tous les modes.

## 4. Architecture

```
src/
  core/        units · geo · astronomy · format · storage   (logique pure, testée)
  services/    http · geocoding · weather · marine · tides · coastline
               hydrology · astronomy · environment · sources
  state/       activities · reducer · AppProvider
  hooks/       useDashboardData   (orchestration des appels en parallèle)
  components/  ui/ · charts/ · steps/ · SpotMap · Topbar · Stepper · Footer · UnitSelector
  modules/     les 8 modules du dashboard + Reglages
  styles/      tokens · base · layout · components · modules
public/data/   land-110m.json (Natural Earth 110 m, ODbL) — repli hors ligne
tests/         verify.ts + 4 tests d'intégration jsdom sur le bundle construit
```

- **Données et présentation séparées** : les services produisent des modèles
  typés dans l'unité source, les composants convertissent à l'affichage.
- **Persistance** : LocalStorage (spots, préférences, coûts) et IndexedDB
  (cache clé/valeur). Aucune donnée personnelle n'est envoyée à un tiers.
- **Dégradation gracieuse** : chaque appel est encadré par un timeout, une
  nouvelle tentative et un message explicite. Une source injoignable produit un
  état « donnée indisponible », jamais une valeur de remplacement.
- **Sans dépendance de graphiques** : les courbes (ligne, barres, marée, arc
  solaire) sont des SVG écrits à la main.

## 5. Tests

`npm test` construit le bundle puis exécute :

| Fichier | Vérifie |
|---|---|
| `tests/verify.ts` | conversions d'unités, haversine / trajet, lever-coucher-midi solaire, phase et illumination lunaires, distance au trait de côte, extraction des extrêmes de marée |
| `tests/coordonnees-gps.mjs` | tous les formats de saisie GPS acceptés, refus explicite des saisies invalides |
| `tests/parcours-complet.mjs` | les 6 étapes, toutes sources en échec : l'application reste utilisable et n'invente rien |
| `tests/nautisme-mer.mjs` | parcours nautisme / mer avec sources simulées : marées dérivées, houle, vagues, température d'eau, courants, conversions d'unités, formatage français |
| `tests/peche-eau-douce.mjs` | parcours pêche / eau douce avec Hub'Eau simulé : stations trouvées, hauteur, débit, distance, date de lecture, tendance 24 h |

Cette suite a permis de détecter et de corriger trois défauts réels pendant le
développement : les seuils de la phase lunaire, un plantage au rendu lié à un
fuseau horaire construit à la main, et l'interprétation des virgules dans la
saisie de coordonnées.

## 6. Priorités

**Fiabilité → Pertinence → Lisibilité → Simplicité → Esthétique.**

Chaque donnée affichée correspond au spot, à l'activité, au milieu, à la date et
à l'heure du spot. La date et l'heure de dernière mise à jour sont indiquées
dès que la source les fournit.

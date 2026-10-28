/**
 * GG Sports-Nature — modèle de données.
 *
 * Principe directeur (cf. cahier des charges §23) : les valeurs remontées par les
 * sources sont conservées telles quelles, dans leur unité d'origine. La conversion
 * n'intervient qu'à l'affichage (voir `core/units.ts`).
 */

// ---------------------------------------------------------------------------
// Unités
// ---------------------------------------------------------------------------

export type UnitMode = 'standard' | 'nautical' | 'dual';

// ---------------------------------------------------------------------------
// Activités
// ---------------------------------------------------------------------------

export type ActivityId =
  | 'balade'
  | 'randonnee'
  | 'jogging'
  | 'natation'
  | 'nautisme'
  | 'peche'
  | 'chasse';

export type ActivityDomain = 'terrestre' | 'aquatique';

export interface Activity {
  id: ActivityId;
  label: string;
  emoji: string;
  domain: ActivityDomain;
  /** Milieu pré-sélectionné par défaut lors du choix de l'activité. */
  defaultMilieu: MilieuMode;
  /** Phrase d'accroche affichée dans le sélecteur. */
  tagline: string;
}

// ---------------------------------------------------------------------------
// Milieu
// ---------------------------------------------------------------------------

export type MilieuMode = 'auto' | 'mer' | 'eau_douce';
export type ResolvedMilieu = 'mer' | 'eau_douce';

// ---------------------------------------------------------------------------
// Géographie
// ---------------------------------------------------------------------------

export interface LatLng {
  lat: number;
  lon: number;
}

export type PlaceKind = 'adresse' | 'commune' | 'lieu' | 'coordonnees' | 'position';

export interface Place {
  id: string;
  label: string;
  kind: PlaceKind;
  lat: number;
  lon: number;
  city?: string;
  postcode?: string;
  /** Score de confiance du géocodeur (0 → 1), quand la source le fournit. */
  score?: number;
  source: string;
}

export interface Spot {
  id: string;
  name: string;
  commune?: string;
  lat: number;
  lon: number;
  /** Contexte forcé manuellement pour ce spot précis. */
  milieuOverride?: ResolvedMilieu;
  activity?: ActivityId;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Détection du milieu
// ---------------------------------------------------------------------------

export type CoastPrecision = 'precise' | 'approx';

export interface EnvironmentDetection {
  /** Distance à la côte la plus proche, en km. */
  distanceCoastKm: number | null;
  precision: CoastPrecision | null;
  /** Le point tombe dans une maille marine du modèle (≈ 8 km). */
  marineGrid: boolean;
  /** Le point est dans l'eau (lac / mer) d'après le masque côtier. */
  inWater: boolean;
  /** Source ayant produit la mesure. */
  source: string;
  /** Seuil réglementaire appliqué (km). */
  thresholdKm: number;
  /** Conclusion automatique. */
  auto: ResolvedMilieu;
  /** Horodatage de la détection. */
  computedAt: string;
}

// ---------------------------------------------------------------------------
// Astronomie
// ---------------------------------------------------------------------------

export interface AstronomyData {
  timezone: string;
  sunrise: string | null;
  sunset: string | null;
  solarNoon: string | null;
  dayLengthSeconds: number | null;
  civilDawn: string | null;
  civilDusk: string | null;
  moonPhase: number; // 0 → nouvelle, 0.5 → pleine, 1 → nouvelle
  moonPhaseName: string;
  moonIllumination: number; // 0 → 1
  moonAgeDays: number;
  moonrise: string | null;
  moonset: string | null;
  computedAt: string;
}

// ---------------------------------------------------------------------------
// Météo
// ---------------------------------------------------------------------------

export interface WeatherCurrent {
  time: string;
  temperature: number | null;
  apparentTemperature: number | null;
  humidity: number | null;
  precipitation: number | null;
  rain: number | null;
  weatherCode: number | null;
  cloudCover: number | null;
  pressureMsl: number | null;
  windSpeed: number | null; // km/h — unité source
  windGusts: number | null; // km/h — unité source
  windDirection: number | null; // degrés
  uvIndex: number | null;
  isDay: boolean | null;
}

export interface HourlyPoint {
  time: string;
  temperature: number | null;
  apparentTemperature: number | null;
  precipitationProbability: number | null;
  precipitation: number | null;
  cloudCover: number | null;
  pressureMsl: number | null;
  windSpeed: number | null;
  windGusts: number | null;
  windDirection: number | null;
  uvIndex: number | null;
  isDay: boolean | null;
}

export interface DailyPoint {
  date: string;
  weatherCode: number | null;
  temperatureMax: number | null;
  temperatureMin: number | null;
  apparentTemperatureMax: number | null;
  apparentTemperatureMin: number | null;
  sunrise: string | null;
  sunset: string | null;
  daylightDuration: number | null;
  uvIndexMax: number | null;
  precipitationSum: number | null;
  precipitationProbabilityMax: number | null;
  windSpeedMax: number | null;
  windGustsMax: number | null;
  windDirectionDominant: number | null;
  moonPhase: number | null;
}

export interface WeatherData {
  current: WeatherCurrent;
  hourly: HourlyPoint[];
  daily: DailyPoint[];
  timezone: string;
  utcOffsetSeconds: number;
  model: string;
  /** Horodatage de la dernière mise à jour de la source. */
  updatedAt: string | null;
  fetchedAt: string;
  elevation: number | null;
}

// ---------------------------------------------------------------------------
// Marine (houle / vagues / température de l'eau)
// ---------------------------------------------------------------------------

export interface MarineCurrent {
  time: string;
  waveHeight: number | null; // m
  wavePeriod: number | null; // s
  waveDirection: number | null; // degrés
  swellWaveHeight: number | null; // m
  swellWavePeriod: number | null; // s
  swellWaveDirection: number | null; // degrés
  windWaveHeight: number | null; // m
  windWavePeriod: number | null; // s
  windWaveDirection: number | null; // degrés
  seaSurfaceTemperature: number | null; // °C
  seaLevelHeightMsl: number | null; // m — inclut la marée
  oceanCurrentVelocity: number | null; // km/h
  oceanCurrentDirection: number | null; // degrés
}

export interface MarineData {
  current: MarineCurrent;
  hourly: MarineCurrent[];
  updatedAt: string | null;
  fetchedAt: string;
  available: boolean;
  unavailableReason?: string;
}

// ---------------------------------------------------------------------------
// Marée
// ---------------------------------------------------------------------------

export interface TideExtremum {
  type: 'PM' | 'BM';
  /** Heure locale ISO complète. */
  time: string;
  /** Hauteur en mètres au-dessus du zéro hydrographique. */
  height: number;
  /** Coefficient de marée (uniquement sur les pleines mers, selon la source). */
  coefficient: number | null;
}

export interface TidePoint {
  time: string;
  height: number; // m
}

export type TideSourceKind = 'model' | 'harmonic' | 'gauge';

export interface TideData {
  available: boolean;
  unavailableReason?: string;
  kind: TideSourceKind;
  sourceLabel: string;
  sourceUrl: string;
  /** Port / site de référence retenu. */
  portName: string | null;
  /** Distance entre le spot et le port de référence (km). */
  portDistanceKm: number | null;
  extrema: TideExtremum[];
  curve: TidePoint[];
  /** Coefficient du prochain extrême (affichage « courant »). */
  coefficientNow: number | null;
  /** Heure et hauteur au moment présent. */
  nowHeight: number | null;
  nowTime: string | null;
  trend: 'montante' | 'descendante' | null;
  /** La hauteur est donnée au-dessus du zéro hydrographique local. */
  datum: string;
  /** Précision / limitations de la source. */
  caveat: string;
  updatedAt: string | null;
  fetchedAt: string;
}

// ---------------------------------------------------------------------------
// Hydrologie (pêche en eau douce)
// ---------------------------------------------------------------------------

export interface HydroStation {
  code: string;
  label: string;
  river: string | null;
  commune: string | null;
  distanceKm: number;
  lat: number;
  lon: number;
  /** Hauteur d'eau (m) et débit (m³/s) au dernier relevé. */
  heightM: number | null;
  heightObsAt: string | null;
  dischargeM3s: number | null;
  dischargeObsAt: string | null;
  /** Évolution sur les dernières 24 h (m). */
  heightTrend24h: number | null;
  /** Dernier relevé connu. */
  lastObsAt: string | null;
  /** Qualité de la donnée (bonne / douteuse), telle que fournie par la source. */
  quality: string | null;
}

export interface HydrologyData {
  available: boolean;
  unavailableReason?: string;
  stations: HydroStation[];
  sourceLabel: string;
  sourceUrl: string;
  /** Fréquence réelle de mise à jour de la source. */
  updateFrequency: string;
  updatedAt: string | null;
  fetchedAt: string;
}

// ---------------------------------------------------------------------------
// Frais de déplacement
// ---------------------------------------------------------------------------

export interface CostSettings {
  consumptionL100: number;
  fuelPricePerL: number;
  tolls: number;
  lodging: number;
  other: number;
  /** Mode de calcul : distance × consommation / 100 × prix. */
  useDrivingDistance: boolean;
}

export interface CostBreakdown {
  distanceKm: number;
  fuel: number | null;
  tolls: number | null;
  lodging: number | null;
  other: number | null;
  total: number | null;
}

// ---------------------------------------------------------------------------
// Fraîcheur des données
// ---------------------------------------------------------------------------

export type FreshnessLevel = 'realtime' | 'delayed' | 'unavailable';

export interface SourceLink {
  label: string;
  url: string;
  /** Description courte du rôle de la source. */
  role: string;
  freshness: FreshnessLevel;
  /** Libellé lisible de la fraîcheur, ex. « temps réel », « différé 10 min ». */
  freshnessLabel: string;
  updatedAt: string | null;
  note?: string;
}

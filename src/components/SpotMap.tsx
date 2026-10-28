/**
 * Carte du spot (§14) — Leaflet + tuiles OpenStreetMap, solution gratuite et
 * open source. Affiche le spot, la position de départ, les stations
 * hydrologiques et un rappel de la zone maritime lorsque c'est pertinent.
 */

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { haversineKm } from '@/core/geo';
import { formatNumber } from '@/core/format';
import type { HydroStation, LatLng } from '@/types';

interface SpotMapProps {
  spot: LatLng & { name: string };
  origin?: LatLng | null;
  stations?: HydroStation[];
  /** Affiche un liseré « zone maritime » (rayon du seuil de 5 km). */
  showMaritimeZone?: boolean;
  maritimeRadiusKm?: number;
  height?: 'short' | 'md' | 'tall';
  onStationClick?: (station: HydroStation) => void;
}

export function SpotMap({
  spot,
  origin,
  stations = [],
  showMaritimeZone = false,
  maritimeRadiusKm = 5,
  height = 'md',
  onStationClick,
}: SpotMapProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.LayerGroup | null>(null);

  // Initialisation unique.
  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: false,
    }).setView([spot.lat, spot.lon], 13);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> · © les contributeurs d’OpenStreetMap',
    }).addTo(map);

    layersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    // Corrige le rendu lorsque le conteneur change de taille.
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(ref.current);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      layersRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mise à jour des marqueurs.
  useEffect(() => {
    const map = mapRef.current;
    const group = layersRef.current;
    if (!map || !group) return;

    group.clearLayers();
    const bounds: L.LatLngExpression[] = [];

    // Spot
    const spotIcon = L.divIcon({
      className: '',
      html: `<div class="spot-marker"><span>📍</span></div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 30],
    });
    L.marker([spot.lat, spot.lon], { icon: spotIcon, zIndexOffset: 1000 })
      .addTo(group)
      .bindTooltip(escapeHtml(spot.name), { direction: 'top', offset: [0, -28], className: 'gg-tip' });
    bounds.push([spot.lat, spot.lon]);

    // Zone maritime (seuil AUTO)
    if (showMaritimeZone) {
      L.circle([spot.lat, spot.lon], {
        radius: maritimeRadiusKm * 1000,
        color: 'var(--water-600)',
        weight: 1.4,
        dashArray: '5 5',
        fillColor: 'var(--water-500)',
        fillOpacity: 0.07,
      })
        .addTo(group)
        .bindTooltip(`Rayon de détection maritime : ${maritimeRadiusKm} km`, {
          direction: 'center',
          className: 'gg-tip',
        });
    }

    // Position de départ
    if (origin) {
      const originIcon = L.divIcon({
        className: '',
        html: '<div class="origin-marker"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      L.marker([origin.lat, origin.lon], { icon: originIcon, zIndexOffset: 900 })
        .addTo(group)
        .bindTooltip('Position de départ', { direction: 'top', offset: [0, -10], className: 'gg-tip' });
      bounds.push([origin.lat, origin.lon]);

      const d = haversineKm({ lat: origin.lat, lon: origin.lon }, { lat: spot.lat, lon: spot.lon });
      L.polyline(
        [
          [origin.lat, origin.lon],
          [spot.lat, spot.lon],
        ],
        { color: 'var(--clay-500)', weight: 2, dashArray: '6 6', opacity: 0.85 },
      )
        .addTo(group)
        .bindTooltip(`${d.toFixed(1)} km à vol d’oiseau`, {
          direction: 'center',
          className: 'gg-tip',
        });
    }

    // Stations hydrologiques
    for (const s of stations) {
      const icon = L.divIcon({
        className: '',
        html: `<div class="hydro-marker">H</div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      L.marker([s.lat, s.lon], { icon })
        .addTo(group)
        .bindTooltip(
          `<b>${escapeHtml(s.label)}</b><br>${formatNumber(s.distanceKm, 1)} km${
            s.heightM != null ? `<br>${formatNumber(s.heightM, 2)} m` : ''
          }`,
          { direction: 'top', offset: [0, -12], className: 'gg-tip' },
        )
        .on('click', () => onStationClick?.(s));
      bounds.push([s.lat, s.lon]);
    }

    if (bounds.length > 1) {
      map.fitBounds(L.latLngBounds(bounds as L.LatLngExpression[]), { padding: [40, 40], maxZoom: 14 });
    } else {
      map.setView([spot.lat, spot.lon], 13);
    }
  }, [spot, origin, stations, showMaritimeZone, maritimeRadiusKm, onStationClick]);

  const cls = ['map', height === 'tall' ? 'map--tall' : height === 'short' ? 'map--short' : '']
    .filter(Boolean)
    .join(' ');

  return <div ref={ref} className={cls} role="application" aria-label={`Carte du spot ${spot.name}`} />;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

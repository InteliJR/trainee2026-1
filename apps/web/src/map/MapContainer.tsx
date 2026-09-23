import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { Point, Collector } from '@ecorota/shared';
import { MOCK_POINTS, MOCK_COLLECTORS } from './mockData';

const CLEAN_OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    'osm-tiles': {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'osm-tiles-layer',
      type: 'raster',
      source: 'osm-tiles',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

interface MapContainerProps {
  points?: Point[];
  collectors?: Collector[];
  center?: [number, number];
  zoom?: number;
}

export const MapContainer: React.FC<MapContainerProps> = ({
  points = MOCK_POINTS,
  collectors = MOCK_COLLECTORS,
  center = [-46.6600, -23.5700],
  zoom = 12,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [useGoogleMaps, setUseGoogleMaps] = useState<boolean>(false);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  // Google Maps state
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const googleMarkersRef = useRef<(google.maps.Marker | google.maps.InfoWindow)[]>([]);

  // MapLibre state
  const mapLibreRef = useRef<maplibregl.Map | null>(null);
  const mapLibreMarkersRef = useRef<maplibregl.Marker[]>([]);
  const [mapLibreLoaded, setMapLibreLoaded] = useState(false);

  useEffect(() => {
    if (apiKey) {
      setUseGoogleMaps(true);
    }
  }, [apiKey]);

  // Google Maps setup
  useEffect(() => {
    if (!useGoogleMaps || !mapContainerRef.current || !apiKey) return;

    let isMounted = true;

    setOptions({
      key: apiKey,
      v: 'weekly',
    });

    Promise.all([importLibrary('maps'), importLibrary('marker')])
      .then(([mapsLib]) => {
        if (!isMounted || !mapContainerRef.current) return;

        const map = new mapsLib.Map(mapContainerRef.current, {
          center: { lat: center[1], lng: center[0] },
          zoom,
          disableDefaultUI: false,
        });
        googleMapRef.current = map;

        renderGoogleMarkers(map, points, collectors, googleMarkersRef);
      })
      .catch((err: unknown) => {
        console.error('Falha ao carregar Google Maps, alternando para MapLibre', err);
        if (isMounted) setUseGoogleMaps(false);
      });

    return () => {
      isMounted = false;
    };
  }, [useGoogleMaps, apiKey]);

  // Google Maps Markers update
  useEffect(() => {
    if (!useGoogleMaps || !googleMapRef.current) return;
    renderGoogleMarkers(googleMapRef.current, points, collectors, googleMarkersRef);
  }, [useGoogleMaps, points, collectors]);

  // MapLibre setup (fallback)
  useEffect(() => {
    if (useGoogleMaps || !mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: CLEAN_OSM_STYLE,
      center: center,
      zoom: zoom,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    mapLibreRef.current = map;

    map.on('load', () => {
      map.resize();
      setMapLibreLoaded(true);
    });

    const handleResize = () => map.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      map.remove();
      mapLibreRef.current = null;
      setMapLibreLoaded(false);
    };
  }, [useGoogleMaps]);

  // MapLibre Markers update
  useEffect(() => {
    if (useGoogleMaps) return;
    const map = mapLibreRef.current;
    if (!map) return;

    mapLibreMarkersRef.current.forEach((m) => m.remove());
    mapLibreMarkersRef.current = [];

    points.forEach((point) => {
      const el = document.createElement('div');
      el.className = 'point-marker';
      el.style.width = '24px';
      el.style.height = '24px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = point.kind === 'habitual' ? '#10B981' : '#F59E0B';
      el.style.border = '2px solid #FFFFFF';
      el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
      el.style.cursor = 'pointer';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.color = '#FFFFFF';
      el.style.fontSize = '11px';
      el.style.fontWeight = 'bold';
      el.innerText = point.id.split('-')[1] || 'P';

      const popup = new maplibregl.Popup({ offset: 25 }).setHTML(`
        <div style="font-family: sans-serif; padding: 4px;">
          <h4 style="margin: 0 0 4px 0; color: #111827;">${point.name}</h4>
          <p style="margin: 0 0 2px 0; font-size: 12px; color: #4B5563;">Tipo: <strong>${point.kind}</strong></p>
          <p style="margin: 0 0 2px 0; font-size: 12px; color: #4B5563;">Circuito: <strong>${point.circuit}</strong></p>
          <p style="margin: 0; font-size: 12px; color: #4B5563;">Pendentes: <strong>${point.demand.pending}</strong></p>
        </div>
      `);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(point.coordinates)
        .setPopup(popup)
        .addTo(map);

      mapLibreMarkersRef.current.push(marker);
    });

    collectors.forEach((collector) => {
      if (!collector.position) return;

      const el = document.createElement('div');
      el.className = 'collector-marker';
      el.style.width = '30px';
      el.style.height = '30px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = collector.origin === 'system' ? '#3B82F6' : '#8B5CF6';
      el.style.border = '3px solid #FFFFFF';
      el.style.boxShadow = '0 3px 6px rgba(0,0,0,0.4)';
      el.style.cursor = 'pointer';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.color = '#FFFFFF';
      el.style.fontSize = '14px';
      el.innerText = '🚚';

      const popup = new maplibregl.Popup({ offset: 25 }).setHTML(`
        <div style="font-family: sans-serif; padding: 4px;">
          <h4 style="margin: 0 0 4px 0; color: #111827;">${collector.name}</h4>
          <p style="margin: 0 0 2px 0; font-size: 12px; color: #4B5563;">Origem: <strong>${collector.origin}</strong></p>
          <p style="margin: 0 0 2px 0; font-size: 12px; color: #4B5563;">Status: <strong>${collector.status}</strong></p>
          <p style="margin: 0; font-size: 12px; color: #4B5563;">Circuito: <strong>${collector.circuit}</strong></p>
        </div>
      `);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(collector.position.coordinates)
        .setPopup(popup)
        .addTo(map);

      mapLibreMarkersRef.current.push(marker);
    });
  }, [useGoogleMaps, mapLibreLoaded, points, collectors]);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '500px', position: 'relative' }}>
      <div
        ref={mapContainerRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
          filter: useGoogleMaps ? 'none' : 'contrast(92%) brightness(104%) saturate(80%)',
        }}
      />
    </div>
  );
};

function renderGoogleMarkers(
  map: google.maps.Map,
  points: Point[],
  collectors: Collector[],
  ref: React.MutableRefObject<(google.maps.Marker | google.maps.InfoWindow)[]>
) {
  if (typeof google === 'undefined' || !google.maps) return;

  ref.current.forEach((item) => {
    if ('setMap' in item) item.setMap(null);
    if ('close' in item) item.close();
  });
  ref.current = [];

  points.forEach((point) => {
    const marker = new google.maps.Marker({
      position: { lat: point.coordinates[1], lng: point.coordinates[0] },
      map,
      title: point.name,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: point.kind === 'habitual' ? '#10B981' : '#F59E0B',
        fillOpacity: 1,
        strokeColor: '#FFFFFF',
        strokeWeight: 2,
      },
    });

    const infoWindow = new google.maps.InfoWindow({
      content: `
        <div style="font-family: sans-serif; padding: 4px;">
          <h4 style="margin: 0 0 4px 0; color: #111827;">${point.name}</h4>
          <p style="margin: 0 0 2px 0; font-size: 12px; color: #4B5563;">Tipo: <strong>${point.kind}</strong></p>
          <p style="margin: 0 0 2px 0; font-size: 12px; color: #4B5563;">Circuito: <strong>${point.circuit}</strong></p>
          <p style="margin: 0; font-size: 12px; color: #4B5563;">Pendentes: <strong>${point.demand.pending}</strong></p>
        </div>
      `,
    });

    marker.addListener('click', () => {
      infoWindow.open(map, marker);
    });

    ref.current.push(marker);
  });

  collectors.forEach((collector) => {
    if (!collector.position) return;
    const marker = new google.maps.Marker({
      position: { lat: collector.position.coordinates[1], lng: collector.position.coordinates[0] },
      map,
      title: collector.name,
      label: {
        text: '🚚',
        fontSize: '14px',
      },
    });

    const infoWindow = new google.maps.InfoWindow({
      content: `
        <div style="font-family: sans-serif; padding: 4px;">
          <h4 style="margin: 0 0 4px 0; color: #111827;">${collector.name}</h4>
          <p style="margin: 0 0 2px 0; font-size: 12px; color: #4B5563;">Origem: <strong>${collector.origin}</strong></p>
          <p style="margin: 0 0 2px 0; font-size: 12px; color: #4B5563;">Status: <strong>${collector.status}</strong></p>
          <p style="margin: 0; font-size: 12px; color: #4B5563;">Circuito: <strong>${collector.circuit}</strong></p>
        </div>
      `,
    });

    marker.addListener('click', () => {
      infoWindow.open(map, marker);
    });

    ref.current.push(marker);
  });
}

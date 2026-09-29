import { useEffect, useRef, useState } from 'react';
import { buttonClasses } from '../../../components/Button';
import { Icon } from '../../../components/Icon';
import { CLEAN_OSM_STYLE, maplibregl } from '../../../map/maplibre';
import { distanceMeters, formatDistance } from '../../../map/mapUtils';
import { colors } from '../../../styles/design-tokens';
import type { CollectorDestination } from '../api/types';
import { directionsUrl } from '../lib/route';

const LINE_SOURCE = 'rota-coletor';
const EMPTY_LINE = { type: 'FeatureCollection' as const, features: [] };

type Position = [number, number];

// Rota da coleta atual: destino e posição do coletor (GPS do aparelho) no mapa, com a distância em linha reta
// e o botão para navegar pelas ruas no app de mapas.
export function RouteMap({ destination }: { destination: CollectorDestination }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const meRef = useRef<maplibregl.Marker | null>(null);
  const fittedRef = useRef(false);
  const [position, setPosition] = useState<Position | null>(null);
  const [gpsError, setGpsError] = useState('');

  // Cria o mapa com o destino marcado e uma camada vazia para a linha até o coletor.
  useEffect(() => {
    if (!containerRef.current) return undefined;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: CLEAN_OSM_STYLE,
      center: destination.coordinates,
      zoom: 15,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    new maplibregl.Marker({ color: colors.brand[600] }).setLngLat(destination.coordinates).addTo(map);
    map.on('load', () => {
      map.addSource(LINE_SOURCE, { type: 'geojson', data: EMPTY_LINE });
      map.addLayer({
        id: `${LINE_SOURCE}-linha`,
        type: 'line',
        source: LINE_SOURCE,
        paint: { 'line-color': colors.operational[600], 'line-width': 4, 'line-dasharray': [2, 1.5] },
      });
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      meRef.current = null;
      fittedRef.current = false;
    };
  }, [destination.coordinates]);

  // Acompanha a posição do aparelho enquanto a tela está aberta.
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGpsError('Este aparelho não informa a localização. Use o botão abaixo para navegar.');
      return undefined;
    }
    const watch = navigator.geolocation.watchPosition(
      (event) => {
        setGpsError('');
        setPosition([event.coords.longitude, event.coords.latitude]);
      },
      () => setGpsError('Sem acesso à sua localização. Permita o acesso para ver onde você está.'),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, []);

  // Move o marcador do coletor, redesenha a linha e enquadra os dois pontos na primeira posição.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !position) return;
    if (!meRef.current) {
      const element = document.createElement('div');
      Object.assign(element.style, {
        width: '18px',
        height: '18px',
        borderRadius: '50%',
        backgroundColor: colors.operational[600],
        border: `3px solid ${colors.neutral[0]}`,
        boxShadow: '0 0 0 2px rgba(0,0,0,0.25)',
      });
      element.setAttribute('aria-label', 'Você');
      meRef.current = new maplibregl.Marker({ element }).setLngLat(position).addTo(map);
    } else {
      meRef.current.setLngLat(position);
    }
    const draw = () => {
      const source = map.getSource(LINE_SOURCE) as maplibregl.GeoJSONSource | undefined;
      source?.setData({
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [position, destination.coordinates] } }],
      });
    };
    if (map.isStyleLoaded()) draw();
    else map.once('load', draw);
    if (!fittedRef.current) {
      fittedRef.current = true;
      map.fitBounds(new maplibregl.LngLatBounds(position, position).extend(destination.coordinates), { padding: 50, maxZoom: 16, duration: 0 });
    }
  }, [position, destination.coordinates]);

  const distance = position ? formatDistance(distanceMeters(position, destination.coordinates)) : null;

  return (
    <section className="space-y-3" aria-labelledby="rota-titulo">
      <h2 id="rota-titulo" className="text-xl font-bold text-neutral-900">Rota até o ponto</h2>
      <p className="text-lg text-neutral-800">
        <strong>{destination.name}</strong>
        {distance ? <span className="block text-base text-neutral-700">Você está a {distance} em linha reta.</span> : null}
      </p>
      <div className="h-72 overflow-hidden rounded-lg border-2 border-neutral-300" aria-label="Mapa com o ponto de coleta e a sua posição">
        <div ref={containerRef} className="h-full w-full" />
      </div>
      <p className="text-base text-neutral-700">
        Ponto verde: destino. Ponto azul: você. A linha é reta; para ir pelas ruas, use o botão.
      </p>
      {gpsError ? <p role="status" className="text-base font-semibold text-reward-800">{gpsError}</p> : null}
      <a
        href={directionsUrl(destination.coordinates, position)}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClasses('secondary', true, 'lg')}
      >
        <Icon name="pin" />
        Abrir rota no Google Maps
      </a>
    </section>
  );
}

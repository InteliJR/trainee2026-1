/**
 * Mapa de seleção de ponto (RF07): um marcador por ponto compatível, tocar seleciona — mesma ação
 * do card da lista. Mapa próprio (como LocationPicker), não o MapContainer operacional do dashboard.
 */
import { useEffect, useRef } from 'react';
import { CLEAN_OSM_STYLE, maplibregl } from '../../../map/maplibre';
import { colors } from '../../../styles/design-tokens';
import type { CollectionPoint } from '../types';

interface PointsMapProps {
  points: CollectionPoint[];
  selectedPointId: string | null;
  onSelect: (pointId: string) => void;
}

const INITIAL_CENTER: [number, number] = [-46.7345, -23.5545];

export function PointsMap({ points, selectedPointId, onSelect }: PointsMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef(new Map<string, maplibregl.Marker>());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Cria o mapa uma vez; os efeitos abaixo cuidam de marcadores e destaque sem recriá-lo.
  useEffect(() => {
    if (!containerRef.current) return undefined;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: CLEAN_OSM_STYLE,
      center: points[0]?.coordinates ?? INITIAL_CENTER,
      zoom: 12,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    mapRef.current = map;
    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Recria os marcadores quando a lista de pontos compatíveis muda (troca de material ou de filtro).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();

    points.forEach((point) => {
      const element = document.createElement('button');
      element.type = 'button';
      element.setAttribute('aria-label', `Selecionar ${point.name}`);
      Object.assign(element.style, markerStyle(point.id === selectedPointId, point.kind));
      element.addEventListener('click', () => onSelectRef.current(point.id));
      const marker = new maplibregl.Marker({ element }).setLngLat(point.coordinates).addTo(map);
      markersRef.current.set(point.id, marker);
    });

    if (points.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      points.forEach((point) => bounds.extend(point.coordinates));
      map.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points]);

  // Restila o marcador selecionado sem recriar todos (evita perder o destaque animado à toa).
  useEffect(() => {
    markersRef.current.forEach((marker, id) => {
      const point = points.find((p) => p.id === id);
      if (!point) return;
      Object.assign(marker.getElement().style, markerStyle(id === selectedPointId, point.kind));
    });
  }, [selectedPointId, points]);

  return (
    <div className="h-72 overflow-hidden rounded-lg border border-neutral-200" aria-label="Mapa dos pontos de coleta">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}

function markerStyle(selected: boolean, kind: CollectionPoint['kind']): Partial<CSSStyleDeclaration> {
  const size = selected ? '30px' : '22px';
  return {
    width: size,
    height: size,
    borderRadius: '50%',
    backgroundColor: kind === 'habitual' ? colors.brand[600] : colors.reward[600],
    border: selected ? `3px solid ${colors.neutral[900]}` : `2px solid ${colors.neutral[0]}`,
    boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
    cursor: 'pointer',
    padding: '0',
  };
}

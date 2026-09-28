/**
 * Mapa para marcar onde fica o endereço do morador: um toque coloca (ou move) o marcador,
 * e "Usar minha localização" preenche pelo GPS do aparelho, alternativa para quem não usa o mapa.
 */
import { useEffect, useRef, useState } from 'react';
import { CLEAN_OSM_STYLE, maplibregl } from '../../../map/maplibre';
import { colors } from '../../../styles/design-tokens';
import { Icon } from './Icon';

interface LocationPickerProps {
  // [longitude, latitude] marcado, ou null antes da escolha.
  value: [number, number] | null;
  onChange: (value: [number, number]) => void;
  error?: string;
}

// Centro inicial perto dos pontos de coleta da EcoRota (Butantã, São Paulo).
const INITIAL_CENTER: [number, number] = [-46.7345, -23.5545];

export function LocationPicker({ value, onChange, error }: LocationPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  // Mantém a função atual sem recriar o mapa a cada renderização do formulário.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState('');

  // Cria o mapa uma vez; cada toque avisa o formulário com as novas coordenadas.
  useEffect(() => {
    if (!containerRef.current) return undefined;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: CLEAN_OSM_STYLE,
      center: value ?? INITIAL_CENTER,
      zoom: value ? 16 : 14,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.on('click', (event) => onChangeRef.current([event.lngLat.lng, event.lngLat.lat]));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // O centro inicial só importa na criação; mudanças seguintes movem o marcador.
  }, []);

  // Coloca ou move o marcador sempre que o valor muda (toque no mapa ou localização do aparelho).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !value) return;
    if (!markerRef.current) {
      markerRef.current = new maplibregl.Marker({ color: colors.brand[600] }).setLngLat(value).addTo(map);
    } else {
      markerRef.current.setLngLat(value);
    }
  }, [value]);

  function useMyLocation() {
    if (!('geolocation' in navigator)) {
      setGeoError('Este aparelho não informa a localização. Marque no mapa.');
      return;
    }
    setLocating(true);
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point: [number, number] = [position.coords.longitude, position.coords.latitude];
        onChangeRef.current(point);
        mapRef.current?.flyTo({ center: point, zoom: 16 });
        setLocating(false);
      },
      () => {
        setGeoError('Não foi possível obter sua localização. Permita o acesso ou marque no mapa.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  return (
    <fieldset>
      <legend className="mb-1 block text-sm font-medium text-neutral-800">Local no mapa</legend>
      <p className="mb-2 text-sm text-neutral-600">Toque no mapa onde fica a sua casa. O coletor usa esse ponto para chegar.</p>
      <div
        className={`h-64 overflow-hidden rounded-md border ${error ? 'border-danger-600' : 'border-neutral-300'}`}
        aria-label="Mapa para marcar o endereço"
      >
        <div ref={containerRef} className="h-full w-full" />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="eco-secondary-button inline-flex min-h-touch items-center gap-2 rounded-md border border-neutral-300 px-4 text-sm font-semibold text-neutral-800 hover:border-brand-300 hover:text-brand-700 disabled:opacity-60"
        >
          <Icon name="map-pin" className="h-4 w-4" />
          {locating ? 'Localizando…' : 'Usar minha localização'}
        </button>
        <span className="text-sm text-neutral-600" aria-live="polite">
          {value ? 'Local marcado.' : 'Nenhum local marcado ainda.'}
        </span>
      </div>
      {error || geoError ? (
        <p role="alert" className="mt-1 text-sm text-danger-700">{error || geoError}</p>
      ) : null}
    </fieldset>
  );
}

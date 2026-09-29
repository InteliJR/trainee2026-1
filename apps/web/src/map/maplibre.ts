/**
 * MapLibre configurado para o Vite, compartilhado por todos os mapas do app.
 * O MapLibre 6 procura o worker ao lado do próprio módulo, arquivo que não existe depois do empacotamento do Vite;
 * importar com ?worker&url faz o Vite gerar o worker com suas dependências e devolver a URL final.
 */
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

// Configura a URL do worker uma única vez, antes de qualquer mapa ser criado.
maplibregl.setWorkerUrl(maplibreWorkerUrl);

// Estilo mínimo baseado nos tiles públicos do OpenStreetMap.
export const CLEAN_OSM_STYLE: maplibregl.StyleSpecification = {
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

export { maplibregl };

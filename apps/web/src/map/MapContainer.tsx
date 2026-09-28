/**
 * Mapa operacional MapLibre que desenha pontos, coletores e rotas recebidos pelo Socket.IO.
 * A instância do mapa é criada uma vez; marcadores são guardados por ID e apenas atualizados,
 * para que caminhões deslizem entre posições e popups abertos não se fechem a cada evento.
 */
import type { Collector, Point } from '@ecorota/shared';
import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// O MapLibre 6 procura o worker ao lado do próprio módulo, arquivo que não existe depois do empacotamento do Vite;
// importar com ?worker&url faz o Vite gerar o worker com suas dependências e devolver a URL final.
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type { RealtimeRoute } from '../realtime/socketClient';
import {
  formatAge,
  interpolateLngLat,
  isTelemetryStale,
  routesToFeatureCollection,
} from './mapUtils';

// Configura a URL do worker uma única vez, antes de qualquer mapa ser criado.
maplibregl.setWorkerUrl(maplibreWorkerUrl);

// Mantém a exportação antiga para quem já importava a regra de telemetria deste módulo.
export { isTelemetryStale } from './mapUtils';

// Define um estilo mínimo baseado nos tiles públicos do OpenStreetMap.
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

// Define o tempo padrão após o qual uma posição deixa de ser considerada recente.
const DEFAULT_TELEMETRY_STALE_AFTER_MS = 15_000;
// Define a duração do deslizamento entre duas posições consecutivas de um coletor.
const MARKER_ANIMATION_MS = 900;
// Identifica a fonte e a camada GeoJSON das rotas dentro do estilo do mapa.
const ROUTES_SOURCE_ID = 'collector-routes';
const ROUTES_LAYER_ID = 'collector-routes-line';

// Permite alimentar o mapa com o estado real e ajustar sua visualização inicial.
interface MapContainerProps {
  // Recebe os pontos autorizados pelo snapshot filtrado do backend.
  points?: Point[];
  // Recebe os coletores autorizados e suas posições mais recentes.
  collectors?: Collector[];
  // Recebe as rotas calculadas pela EcoRota para desenhar o trajeto de cada coletor.
  routes?: RealtimeRoute[];
  // Define longitude e latitude usadas somente na criação inicial do mapa.
  center?: [number, number];
  // Define a aproximação usada somente na criação inicial do mapa.
  zoom?: number;
  // Permite alinhar o limite de telemetria com uma futura configuração do backend.
  telemetryStaleAfterMs?: number;
  // Centraliza o mapa em um ponto e abre seu popup; o nonce permite repetir o foco no mesmo ponto.
  focus?: { pointId: string; nonce: number } | null;
  // Altura mínima do contêiner; mapas embutidos em cards usam um valor menor.
  minHeight?: string;
}

// Agrupa o marcador de um ponto com os nós que precisam ser atualizados sem recriá-lo.
interface PointMarkerEntry {
  marker: maplibregl.Marker;
  popup: PopupHandle;
}

// Agrupa o marcador de um coletor com o estado necessário para animar e restilizar.
interface CollectorMarkerEntry {
  marker: maplibregl.Marker;
  element: HTMLDivElement;
  popup: PopupHandle;
  // Guarda o destino atual para que uma nova posição parta de onde o marcador está indo.
  target: [number, number];
  // Guarda o quadro de animação em andamento para cancelá-lo quando outra posição chegar.
  animationFrame: number | null;
}

// Controla o ciclo de vida do mapa, dos marcadores, das rotas e da indicação de telemetria desatualizada.
export function MapContainer({
  points = [],
  collectors = [],
  routes = [],
  center = [-46.66, -23.57],
  zoom = 12,
  telemetryStaleAfterMs = DEFAULT_TELEMETRY_STALE_AFTER_MS,
  focus = null,
  minHeight = '500px',
}: MapContainerProps) {
  // Guarda o elemento DOM em que o MapLibre montará seu canvas.
  const mapContainerRef = useRef<HTMLDivElement>(null);
  // Preserva a instância para que mudanças de dados não recriem o mapa.
  const mapRef = useRef<maplibregl.Map | null>(null);
  // Indexa os marcadores de pontos pelo ID para atualizar somente o que mudou.
  const pointMarkersRef = useRef(new Map<string, PointMarkerEntry>());
  // Indexa os marcadores de coletores pelo ID para mover o mesmo marcador a cada evento.
  const collectorMarkersRef = useRef(new Map<string, CollectorMarkerEntry>());
  // Preserva a primeira configuração recebida, pois centro e zoom são valores de inicialização.
  const initialViewRef = useRef({ center, zoom });
  // Garante que o enquadramento automático nos pontos aconteça só uma vez, sem brigar com o usuário depois.
  const hasFittedRef = useRef(false);
  // Impede o desenho de marcadores antes que o estilo termine de carregar.
  const [mapLoaded, setMapLoaded] = useState(false);
  // Atualiza periodicamente a referência de tempo usada para marcar telemetria antiga.
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  // Cria o mapa uma única vez e libera canvas, controles e listeners ao desmontar o componente.
  useEffect(() => {
    // Aguarda o React disponibilizar o elemento real do contêiner.
    if (!mapContainerRef.current) return undefined;

    // Lê a visualização preservada para não reagir a novas referências de array nas renderizações.
    const initialView = initialViewRef.current;
    // Instancia o único provedor cartográfico adotado pelo projeto.
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: CLEAN_OSM_STYLE,
      center: initialView.center,
      zoom: initialView.zoom,
    });
    // Adiciona botões nativos para zoom, rotação e orientação.
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    // Disponibiliza a instância para os efeitos responsáveis pelos marcadores.
    mapRef.current = map;
    // Copia as referências dos índices para a limpeza usar exatamente os mesmos objetos.
    const pointMarkers = pointMarkersRef.current;
    const collectorMarkers = collectorMarkersRef.current;

    // Prepara a camada de rotas e libera o desenho dos marcadores quando o estilo termina de carregar.
    const handleLoad = (): void => {
      map.resize();
      // Começa com uma coleção vazia; o efeito de rotas preenche os dados assim que existirem.
      map.addSource(ROUTES_SOURCE_ID, { type: 'geojson', data: routesToFeatureCollection([]) });
      map.addLayer({
        id: ROUTES_LAYER_ID,
        type: 'line',
        source: ROUTES_SOURCE_ID,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': ['get', 'color'], 'line-width': 4, 'line-opacity': 0.75 },
      });
      setMapLoaded(true);
    };
    // Mantém o canvas alinhado ao contêiner quando a janela muda de tamanho.
    const handleResize = (): void => {
      // Executa resize pelo efeito colateral e não devolve a instância MapLibre ao listener do navegador.
      map.resize();
    };
    // Registra listeners somente depois que suas funções foram definidas.
    map.on('load', handleLoad);
    window.addEventListener('resize', handleResize);

    // Remove recursos nativos e referências React para impedir vazamentos de memória.
    return () => {
      window.removeEventListener('resize', handleResize);
      map.off('load', handleLoad);
      pointMarkers.forEach((entry) => entry.marker.remove());
      collectorMarkers.forEach((entry) => {
        if (entry.animationFrame !== null) cancelAnimationFrame(entry.animationFrame);
        entry.marker.remove();
      });
      pointMarkers.clear();
      collectorMarkers.clear();
      map.remove();
      mapRef.current = null;
      setMapLoaded(false);
    };
  }, []);

  // Avança o relógio visual sem alterar os dados recebidos do servidor.
  useEffect(() => {
    // Recalcula a aparência dos coletores a cada cinco segundos.
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 5_000);
    // Cancela o temporizador quando o mapa deixa a tela.
    return () => window.clearInterval(timer);
  }, []);

  // Sincroniza os pontos fixos: cria os novos, atualiza os existentes e remove os que saíram do snapshot.
  useEffect(() => {
    // Aguarda a instância e o estilo MapLibre estarem disponíveis.
    const map = mapRef.current;
    if (!mapLoaded || !map) return;
    const entries = pointMarkersRef.current;
    const seen = new Set<string>();

    points.forEach((point) => {
      seen.add(point.id);
      const fields = pointFields(point);
      const existing = entries.get(point.id);
      // Reaproveita o marcador existente, trocando apenas posição e texto do popup.
      if (existing) {
        existing.marker.setLngLat(point.coordinates);
        existing.popup.update(point.name, fields);
        return;
      }
      // Cria o marcador somente na primeira vez em que o ponto aparece.
      const popup = createPopupHandle(point.name, fields);
      const marker = new maplibregl.Marker({ element: createPointElement(point) })
        .setLngLat(point.coordinates)
        .setPopup(new maplibregl.Popup({ offset: 25 }).setDOMContent(popup.container))
        .addTo(map);
      entries.set(point.id, { marker, popup });
    });

    // Remove pontos que deixaram de ser autorizados ou deixaram de existir no snapshot.
    entries.forEach((entry, id) => {
      if (seen.has(id)) return;
      entry.marker.remove();
      entries.delete(id);
    });

    // Na primeira vez em que há pontos, enquadra todos, pois o centro inicial é só uma estimativa.
    if (!hasFittedRef.current && points.length > 0) {
      hasFittedRef.current = true;
      const bounds = new maplibregl.LngLatBounds();
      points.forEach((point) => bounds.extend(point.coordinates));
      map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 0 });
    }
  }, [mapLoaded, points]);

  // Sincroniza os coletores: move o mesmo marcador, atualiza aparência e popup e remove os que sumiram.
  useEffect(() => {
    // Aguarda a instância e o estilo MapLibre estarem disponíveis.
    const map = mapRef.current;
    if (!mapLoaded || !map) return;
    const entries = collectorMarkersRef.current;
    const seen = new Set<string>();

    collectors.forEach((collector) => {
      // Não existe uma posição válida onde colocar o marcador quando position é null.
      if (!collector.position) return;
      seen.add(collector.id);
      const target = collector.position.coordinates;
      // Calcula se a última observação ultrapassou o limite definido pelo componente.
      const stale = isTelemetryStale(collector.observedAt, currentTime, telemetryStaleAfterMs);
      const fields = collectorFields(collector, stale, currentTime);
      const existing = entries.get(collector.id);

      // Cria o marcador somente na primeira vez em que o coletor aparece com posição.
      if (!existing) {
        const element = createCollectorElement(collector);
        applyCollectorStaleStyle(element, stale);
        const popup = createPopupHandle(collector.name, fields);
        const marker = new maplibregl.Marker({ element })
          .setLngLat(target)
          .setPopup(new maplibregl.Popup({ offset: 25 }).setDOMContent(popup.container))
          .addTo(map);
        entries.set(collector.id, { marker, element, popup, target, animationFrame: null });
        return;
      }

      // Atualiza aparência e texto no mesmo elemento, preservando um popup que esteja aberto.
      applyCollectorStaleStyle(existing.element, stale);
      existing.popup.update(collector.name, fields);
      // Só anima quando a posição realmente mudou; o relógio de telemetria não deve mover o marcador.
      if (existing.target[0] !== target[0] || existing.target[1] !== target[1]) {
        animateMarker(existing, target);
      }
    });

    // Remove coletores que perderam a posição ou deixaram de aparecer no snapshot.
    entries.forEach((entry, id) => {
      if (seen.has(id)) return;
      if (entry.animationFrame !== null) cancelAnimationFrame(entry.animationFrame);
      entry.marker.remove();
      entries.delete(id);
    });
  }, [collectors, currentTime, mapLoaded, telemetryStaleAfterMs]);

  // Substitui os dados da camada de rotas sempre que o snapshot ou um evento de rota muda.
  useEffect(() => {
    // Aguarda a camada ter sido criada no carregamento do estilo.
    const map = mapRef.current;
    if (!mapLoaded || !map) return;
    const source = map.getSource(ROUTES_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    source?.setData(routesToFeatureCollection(routes));
  }, [mapLoaded, routes]);

  // Leva a câmera até o ponto escolhido e abre seu popup, depois que o marcador já existe.
  useEffect(() => {
    const map = mapRef.current;
    if (!mapLoaded || !map || !focus) return;
    const entry = pointMarkersRef.current.get(focus.pointId);
    if (!entry) return;
    map.flyTo({ center: entry.marker.getLngLat(), zoom: Math.max(map.getZoom(), 14), essential: true });
    // Abre o popup só se ainda estiver fechado; togglePopup fecharia um popup já aberto.
    if (!entry.marker.getPopup()?.isOpen()) entry.marker.togglePopup();
  }, [focus, mapLoaded]);

  // Mantém o canvas ocupando toda a área entregue pelo componente pai.
  return (
    <div style={{ width: '100%', height: '100%', minHeight, position: 'relative' }}>
      <div
        ref={mapContainerRef}
        aria-label="Mapa operacional com pontos de coleta, coletores e rotas"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          filter: 'contrast(92%) brightness(104%) saturate(80%)',
        }}
      />
    </div>
  );
}

// Desliza o marcador da posição atual até o novo destino, ou salta direto se o usuário reduziu animações.
function animateMarker(entry: CollectorMarkerEntry, target: [number, number]): void {
  // Interrompe uma animação anterior para que a nova parta do ponto em que o marcador está.
  if (entry.animationFrame !== null) cancelAnimationFrame(entry.animationFrame);
  entry.target = target;
  const from = entry.marker.getLngLat().toArray() as [number, number];

  // Respeita a preferência de acessibilidade do sistema operacional.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    entry.marker.setLngLat(target);
    entry.animationFrame = null;
    return;
  }

  const startedAt = performance.now();
  // Avança um quadro por vez até completar a duração configurada.
  const step = (now: number): void => {
    const progress = (now - startedAt) / MARKER_ANIMATION_MS;
    entry.marker.setLngLat(interpolateLngLat(from, target, progress));
    entry.animationFrame = progress < 1 ? requestAnimationFrame(step) : null;
  };
  entry.animationFrame = requestAnimationFrame(step);
}

// Lista as informações exibidas no popup de um ponto de coleta.
function pointFields(point: Point): Array<[string, string]> {
  return [
    ['Tipo', point.kind],
    ['Circuito', String(point.circuit)],
    ['Pendentes', String(point.demand.pending)],
  ];
}

// Lista as informações exibidas no popup de um coletor, incluindo há quanto tempo veio a última posição.
function collectorFields(collector: Collector, stale: boolean, now: number): Array<[string, string]> {
  const age = formatAge(collector.observedAt, now);
  return [
    ['Origem', collector.origin],
    ['Status', collector.status],
    ['Circuito', String(collector.circuit)],
    ['Telemetria', stale ? `sem sinal ${age}` : `atualizada ${age}`],
  ];
}

// Constrói o círculo colorido de um ponto de coleta.
function createPointElement(point: Point): HTMLDivElement {
  // Cria o círculo colorido sem inserir HTML recebido externamente.
  const element = document.createElement('div');
  element.className = 'point-marker';
  Object.assign(element.style, {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: point.kind === 'habitual' ? '#10B981' : '#F59E0B',
    border: '2px solid #FFFFFF',
    boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#FFFFFF',
    fontSize: '11px',
    fontWeight: 'bold',
  });
  // Usa o número do nome ("Ponto 01" → "01"); IDs da EcoRota são UUIDs e não servem como rótulo.
  element.innerText = pointLabel(point);
  return element;
}

// Extrai um rótulo curto para o marcador a partir do nome do ponto.
function pointLabel(point: Point): string {
  const number = point.name.match(/\d+/)?.[0];
  return number ?? 'P';
}

// Constrói o símbolo do veículo; a aparência de telemetria é aplicada separadamente.
function createCollectorElement(collector: Collector): HTMLDivElement {
  const element = document.createElement('div');
  element.className = 'collector-marker';
  Object.assign(element.style, {
    width: '30px',
    height: '30px',
    borderRadius: '50%',
    backgroundColor: collector.origin === 'system' ? '#3B82F6' : '#8B5CF6',
    boxShadow: '0 3px 6px rgba(0,0,0,0.4)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#FFFFFF',
    fontSize: '14px',
    transition: 'opacity 300ms ease',
  });
  // Usa um ícone simples que independe de uma biblioteca adicional.
  element.innerText = '🚚';
  return element;
}

// Reduz a opacidade e usa borda tracejada quando a posição do coletor está antiga.
function applyCollectorStaleStyle(element: HTMLDivElement, stale: boolean): void {
  element.style.border = stale ? '3px dashed #6B7280' : '3px solid #FFFFFF';
  element.style.opacity = stale ? '0.5' : '1';
}

// Mantém o conteúdo de um popup e permite trocar seus textos sem recriar o nó.
interface PopupHandle {
  container: HTMLDivElement;
  update: (title: string, fields: Array<[string, string]>) => void;
}

// Cria o conteúdo textual reutilizado pelos popups sem interpolar HTML não confiável.
function createPopupHandle(title: string, fields: Array<[string, string]>): PopupHandle {
  // Cria o contêiner principal e define apenas estilos controlados pela aplicação.
  const container = document.createElement('div');
  container.style.fontFamily = 'sans-serif';
  container.style.padding = '4px';

  // Reescreve título e linhas via textContent, o que também serve para atualizações posteriores.
  const update = (nextTitle: string, nextFields: Array<[string, string]>): void => {
    const heading = document.createElement('h4');
    heading.style.cssText = 'margin:0 0 4px 0;color:#111827;';
    heading.textContent = nextTitle;

    // Converte cada par de rótulo e valor em uma linha separada do popup.
    const paragraphs = nextFields.map(([label, value]) => {
      const paragraph = document.createElement('p');
      paragraph.style.cssText = 'margin:0 0 2px 0;font-size:12px;color:#4B5563;';
      paragraph.append(document.createTextNode(`${label}: `));
      // Insere o valor externo via textContent para evitar execução de marcação.
      const strong = document.createElement('strong');
      strong.textContent = value;
      paragraph.appendChild(strong);
      return paragraph;
    });

    container.replaceChildren(heading, ...paragraphs);
  };

  update(title, fields);
  return { container, update };
}

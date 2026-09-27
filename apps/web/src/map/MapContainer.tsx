/**
 * Mapa operacional MapLibre que desenha pontos e coletores recebidos pelo Socket.IO.
 * A instância do mapa é criada uma vez; efeitos independentes atualizam somente os marcadores necessários.
 */
import type { Collector, Point } from '@ecorota/shared';
import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

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

// Permite alimentar o mapa com o estado real e ajustar sua visualização inicial.
interface MapContainerProps {
  // Recebe os pontos autorizados pelo snapshot filtrado do backend.
  points?: Point[];
  // Recebe os coletores autorizados e suas posições mais recentes.
  collectors?: Collector[];
  // Define longitude e latitude usadas somente na criação inicial do mapa.
  center?: [number, number];
  // Define a aproximação usada somente na criação inicial do mapa.
  zoom?: number;
  // Permite alinhar o limite de telemetria com uma futura configuração do backend.
  telemetryStaleAfterMs?: number;
}

// Controla o ciclo de vida do mapa, dos marcadores e da indicação de telemetria desatualizada.
export function MapContainer({
  points = [],
  collectors = [],
  center = [-46.66, -23.57],
  zoom = 12,
  telemetryStaleAfterMs = DEFAULT_TELEMETRY_STALE_AFTER_MS,
}: MapContainerProps) {
  // Guarda o elemento DOM em que o MapLibre montará seu canvas.
  const mapContainerRef = useRef<HTMLDivElement>(null);
  // Preserva a instância para que mudanças de dados não recriem o mapa.
  const mapRef = useRef<maplibregl.Map | null>(null);
  // Guarda somente os marcadores fixos de pontos para atualizá-los independentemente.
  const pointMarkersRef = useRef<maplibregl.Marker[]>([]);
  // Guarda somente os marcadores móveis de coletores.
  const collectorMarkersRef = useRef<maplibregl.Marker[]>([]);
  // Preserva a primeira configuração recebida, pois centro e zoom são valores de inicialização.
  const initialViewRef = useRef({ center, zoom });
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

    // Marca o estilo como pronto e corrige o tamanho calculado do canvas.
    const handleLoad = (): void => {
      map.resize();
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
      pointMarkersRef.current.forEach((marker) => marker.remove());
      collectorMarkersRef.current.forEach((marker) => marker.remove());
      pointMarkersRef.current = [];
      collectorMarkersRef.current = [];
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

  // Reconstrói apenas os pontos fixos quando a lista autorizada muda.
  useEffect(() => {
    // Aguarda a instância e o estilo MapLibre estarem disponíveis.
    if (!mapLoaded || !mapRef.current) return;
    // Remove os marcadores anteriores para não duplicar pontos após um novo snapshot.
    pointMarkersRef.current.forEach((marker) => marker.remove());
    // Converte cada ponto do snapshot em um marcador seguro e informativo.
    pointMarkersRef.current = points.map((point) => createPointMarker(point).addTo(mapRef.current!));
  }, [mapLoaded, points]);

  // Reconstrói somente os coletores quando uma posição chega pelo Socket.IO ou envelhece visualmente.
  useEffect(() => {
    // Aguarda a instância e o estilo MapLibre estarem disponíveis.
    if (!mapLoaded || !mapRef.current) return;
    // Remove os marcadores móveis anteriores sem tocar nos pontos nem na instância do mapa.
    collectorMarkersRef.current.forEach((marker) => marker.remove());
    // Descarta coletores sem coordenadas e desenha os demais com o estado de telemetria correto.
    collectorMarkersRef.current = collectors.flatMap((collector) => {
      // Não existe uma posição válida onde colocar o marcador quando position é null.
      if (!collector.position) return [];
      // Calcula se a última observação ultrapassou o limite definido pelo componente.
      const stale = isTelemetryStale(collector.observedAt, currentTime, telemetryStaleAfterMs);
      // Adiciona somente o novo marcador do coletor ao mapa já existente.
      return [createCollectorMarker(collector, stale).addTo(mapRef.current!)];
    });
  }, [collectors, currentTime, mapLoaded, telemetryStaleAfterMs]);

  // Mantém o canvas ocupando toda a área entregue pelo componente pai.
  return (
    <div style={{ width: '100%', height: '100%', minHeight: '500px', position: 'relative' }}>
      <div
        ref={mapContainerRef}
        aria-label="Mapa operacional com pontos de coleta e coletores"
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

// Determina se uma data de telemetria é inválida ou antiga demais para ser tratada como atual.
export function isTelemetryStale(observedAt: string, now: number, staleAfterMs: number): boolean {
  // Converte a data ISO para milissegundos sem alterar o objeto recebido.
  const observedTime = Date.parse(observedAt);
  // Considera inválida como desatualizada para nunca transmitir uma falsa sensação de precisão.
  if (Number.isNaN(observedTime)) return true;
  // Compara a idade da leitura com o limite escolhido para o painel.
  return now - observedTime > staleAfterMs;
}

// Constrói o marcador visual e o popup de um ponto de coleta.
function createPointMarker(point: Point): maplibregl.Marker {
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
  // Usa somente um fragmento curto do ID para diferenciar visualmente os pontos próximos.
  element.innerText = point.id.split('-')[1] || 'P';

  // Monta o popup com textContent para impedir interpretação de nomes externos como HTML.
  const popupContent = createPopupContent(point.name, [
    ['Tipo', point.kind],
    ['Circuito', String(point.circuit)],
    ['Pendentes', String(point.demand.pending)],
  ]);
  // Associa posição e popup ao marcador antes de devolvê-lo ao efeito.
  return new maplibregl.Marker({ element })
    .setLngLat(point.coordinates)
    .setPopup(new maplibregl.Popup({ offset: 25 }).setDOMContent(popupContent));
}

// Constrói o marcador visual e o popup de um coletor com posição conhecida.
function createCollectorMarker(collector: Collector, stale: boolean): maplibregl.Marker {
  // Cria o símbolo do veículo e reduz sua opacidade quando a posição está antiga.
  const element = document.createElement('div');
  element.className = 'collector-marker';
  Object.assign(element.style, {
    width: '30px',
    height: '30px',
    borderRadius: '50%',
    backgroundColor: collector.origin === 'system' ? '#3B82F6' : '#8B5CF6',
    border: stale ? '3px dashed #6B7280' : '3px solid #FFFFFF',
    boxShadow: '0 3px 6px rgba(0,0,0,0.4)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#FFFFFF',
    fontSize: '14px',
    opacity: stale ? '0.5' : '1',
  });
  // Usa um ícone simples que independe de uma biblioteca adicional.
  element.innerText = '🚚';

  // Monta um popup seguro e deixa explícita a qualidade temporal da posição mostrada.
  const popupContent = createPopupContent(collector.name, [
    ['Origem', collector.origin],
    ['Status', collector.status],
    ['Circuito', String(collector.circuit)],
    ['Telemetria', stale ? 'desatualizada' : 'atualizada'],
  ]);
  // position já foi verificada pelo chamador; a guarda protege também usos futuros isolados da função.
  if (!collector.position) throw new Error('Não é possível criar marcador de coletor sem posição.');
  // Associa as coordenadas e o popup ao novo marcador móvel.
  return new maplibregl.Marker({ element })
    .setLngLat(collector.position.coordinates)
    .setPopup(new maplibregl.Popup({ offset: 25 }).setDOMContent(popupContent));
}

// Cria o conteúdo textual reutilizado pelos popups sem interpolar HTML não confiável.
function createPopupContent(title: string, fields: Array<[string, string]>): HTMLDivElement {
  // Cria o contêiner principal e define apenas estilos controlados pela aplicação.
  const container = document.createElement('div');
  container.style.fontFamily = 'sans-serif';
  container.style.padding = '4px';
  // Cria o título e atribui o texto externo de maneira segura.
  const heading = document.createElement('h4');
  heading.style.cssText = 'margin:0 0 4px 0;color:#111827;';
  heading.textContent = title;
  container.appendChild(heading);

  // Converte cada par de rótulo e valor em uma linha separada do popup.
  fields.forEach(([label, value]) => {
    // Cria uma linha de texto com formatação consistente.
    const paragraph = document.createElement('p');
    paragraph.style.cssText = 'margin:0 0 2px 0;font-size:12px;color:#4B5563;';
    // Cria o rótulo fixo antes do valor destacado.
    paragraph.append(document.createTextNode(`${label}: `));
    // Insere o valor externo via textContent para evitar execução de marcação.
    const strong = document.createElement('strong');
    strong.textContent = value;
    paragraph.appendChild(strong);
    container.appendChild(paragraph);
  });

  // Devolve o nó pronto para setDOMContent do MapLibre.
  return container;
}

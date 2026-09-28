/**
 * Funções puras usadas pelo mapa operacional.
 * Ficam fora do componente para que telemetria, animação e rotas sejam testadas sem MapLibre nem DOM.
 */
import type { RealtimeRoute } from '../realtime/socketClient';
import { colors } from '../styles/design-tokens';

// Tipos GeoJSON mínimos da camada de rotas, compatíveis com o setData do MapLibre.
export interface RouteFeature {
  type: 'Feature';
  properties: { collectorId: string; color: string };
  geometry: { type: 'LineString'; coordinates: Array<[number, number]> };
}

export interface RouteFeatureCollection {
  type: 'FeatureCollection';
  features: RouteFeature[];
}

// Paleta usada para diferenciar a rota de cada coletor sem depender da ordem de chegada dos eventos.
// Vem dos tokens do guia; danger fica de fora porque indica erro, não uma rota comum.
export const ROUTE_COLORS = [
  colors.operational[600],
  colors.reward[600],
  colors.brand[700],
  colors.operational[800],
  colors.reward[800],
  colors.neutral[700],
] as const;

// Determina se uma data de telemetria é inválida ou antiga demais para ser tratada como atual.
export function isTelemetryStale(observedAt: string, now: number, staleAfterMs: number): boolean {
  // Converte a data ISO para milissegundos sem alterar o objeto recebido.
  const observedTime = Date.parse(observedAt);
  // Considera inválida como desatualizada para nunca transmitir uma falsa sensação de precisão.
  if (Number.isNaN(observedTime)) return true;
  // Compara a idade da leitura com o limite escolhido para o painel.
  return now - observedTime > staleAfterMs;
}

// Descreve há quanto tempo algo aconteceu (posição, atualização de solicitação) em um texto curto.
export function formatAge(observedAt: string, now: number): string {
  // Converte a data ISO; uma data inválida não permite afirmar idade alguma.
  const observedTime = Date.parse(observedAt);
  if (Number.isNaN(observedTime)) return 'sem registro';
  // Relógios levemente adiantados no servidor não devem gerar idades negativas.
  const seconds = Math.max(0, Math.floor((now - observedTime) / 1_000));
  // Usa segundos enquanto a diferença ainda é pequena o bastante para ser lida de relance.
  if (seconds < 60) return `há ${seconds} s`;
  // Passa para minutos quando a telemetria já está claramente parada.
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `há ${minutes} min`;
  // Agrupa em horas para coletores que ficaram sem sinal por muito tempo.
  return `há ${Math.floor(minutes / 60)} h`;
}

// Calcula uma coordenada intermediária entre duas posições para animar o deslocamento do marcador.
export function interpolateLngLat(
  from: [number, number],
  to: [number, number],
  progress: number,
): [number, number] {
  // Limita o progresso para que quadros atrasados não ultrapassem o destino.
  const t = Math.min(1, Math.max(0, progress));
  // Aplica easing de saída para o veículo desacelerar ao chegar à nova posição.
  const eased = 1 - (1 - t) ** 3;
  // Interpola longitude e latitude de forma independente; as distâncias entre eventos são curtas.
  return [from[0] + (to[0] - from[0]) * eased, from[1] + (to[1] - from[1]) * eased];
}

// Escolhe sempre a mesma cor para o mesmo coletor, mesmo depois de reconexões.
export function routeColorFor(collectorId: string): string {
  // Soma simples dos códigos de caractere basta para espalhar poucos coletores pela paleta.
  let hash = 0;
  for (const char of collectorId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return ROUTE_COLORS[hash % ROUTE_COLORS.length];
}

// Converte as rotas do snapshot na coleção GeoJSON consumida pela camada de linhas do MapLibre.
export function routesToFeatureCollection(routes: RealtimeRoute[]): RouteFeatureCollection {
  return {
    type: 'FeatureCollection',
    // Descarta rotas sem ao menos dois vértices, pois não formam uma linha desenhável.
    features: routes
      .filter((route) => route.geometry.coordinates.length >= 2)
      .map((route) => ({
        type: 'Feature',
        properties: { collectorId: route.collectorId, color: routeColorFor(route.collectorId) },
        geometry: { type: 'LineString', coordinates: route.geometry.coordinates },
      })),
  };
}

// Calcula a distância em metros entre duas coordenadas [longitude, latitude] pela fórmula de haversine.
export function distanceMeters(a: [number, number], b: [number, number]): number {
  const earthRadius = 6_371_000;
  const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
  const deltaLat = toRadians(b[1] - a[1]);
  const deltaLng = toRadians(b[0] - a[0]);
  const h = Math.sin(deltaLat / 2) ** 2
    + Math.cos(toRadians(a[1])) * Math.cos(toRadians(b[1])) * Math.sin(deltaLng / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

// Formata uma distância para leitura rápida: metros até 1 km, depois quilômetros com uma casa.
export function formatDistance(meters: number): string {
  if (meters < 1_000) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`;
}

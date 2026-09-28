/**
 * Liga as solicitações do morador ao estado em tempo real recebido pelo Socket.IO.
 * O backend envia ao morador apenas as próprias solicitações e a posição do coletor que o atende;
 * estas funções localizam a solicitação pela referência externa e aplicam o status ao vivo na tela.
 */
import type { Collector, Point, RequestStatus } from '@ecorota/shared';
import type { RealtimeSnapshot } from '../../../realtime/socketClient';
import type { ResidentCollectionRequest } from '../types';

// Informações ao vivo de uma solicitação, já cruzadas com ponto e coletor do snapshot.
export interface ResidentLiveInfo {
  status: RequestStatus;
  point: Point | null;
  collector: Collector | null;
  updatedAt: string;
}

// Status em que faz sentido mostrar o coletor no mapa.
const TRACKABLE_STATUSES: readonly RequestStatus[] = ['assigned', 'in_service'];

// Chave usada para achar a solicitação no snapshot: a referência externa quando existe, senão o próprio ID.
export function residentRequestKey(request: ResidentCollectionRequest): string {
  return request.externalReference ?? request.id;
}

// Procura a solicitação no snapshot e resolve o ponto e o coletor responsável.
export function resolveResidentLive(snapshot: RealtimeSnapshot | null, key: string): ResidentLiveInfo | null {
  if (!snapshot) return null;
  const request = snapshot.requests.find((item) => item.externalReference === key || item.id === key);
  if (!request) return null;
  return {
    status: request.status,
    point: snapshot.points.find((point) => point.id === request.pointId) ?? null,
    collector: request.collectorId
      ? snapshot.collectors.find((collector) => collector.id === request.collectorId) ?? null
      : null,
    updatedAt: request.updatedAt,
  };
}

// Indica se o mapa ao vivo deve aparecer para a solicitação.
export function isTrackable(live: ResidentLiveInfo | null): live is ResidentLiveInfo & { point: Point } {
  return Boolean(live && live.point && TRACKABLE_STATUSES.includes(live.status));
}

// Aplica o status ao vivo sobre a solicitação exibida, sem sobrescrever um cancelamento feito na própria tela.
export function applyLiveToRequest(
  request: ResidentCollectionRequest,
  live: ResidentLiveInfo | null,
): ResidentCollectionRequest {
  if (!live || request.status === 'cancelled') return request;
  // Registra o horário do novo status na linha do tempo quando ele ainda não tinha acontecido.
  const occurredAt = formatClock(live.updatedAt);
  return {
    ...request,
    status: live.status,
    collectorName: live.collector?.name ?? request.collectorName,
    timeline: request.timeline.map((item) =>
      item.status === live.status && !item.occurredAt ? { ...item, occurredAt } : item,
    ),
  };
}

// Formata a data ISO no mesmo estilo "HH:MM" usado pela linha do tempo.
function formatClock(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Valida mensagens JSON recebidas pelo WebSocket antes que dados externos entrem no cache.
 * Diferencia snapshot de evento e rejeita tipos/campos desconhecidos com erro explícito.
 */
import type { EcoRotaEventMessage, EcoRotaEventType, EcoRotaRequest, EcoRotaSnapshot } from '../ecorotaClient.js';

// União validada retornada pelo parser ao consumidor WebSocket.
export type EcoRotaStreamMessage =
  | { type: 'snapshot'; data: EcoRotaSnapshot }
  | EcoRotaEventMessage;

// Lista eventos incrementais aceitos; qualquer tipo novo exige decisão explícita no backend.
const EVENT_TYPES = new Set<EcoRotaEventType>([
  'collector.created', 'collector.updated', 'collector.deleted', 'collector.position_updated',
  'route.updated', 'request.created', 'request.assigned', 'request.started', 'request.completed',
  'request.cancelled', 'request.requeued', 'simulation.incident', 'simulation.updated', 'simulation.reset',
]);

// Elimina null, arrays e primitivos antes de acessar propriedades desconhecidas.
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

// Confirma os campos mínimos usados para identificar e atualizar uma solicitação.
function isRequest(value: unknown): value is EcoRotaRequest {
  // Solicitação precisa ser um objeto antes das verificações de campos.
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && typeof value.pointId === 'string'
    && typeof value.externalReference === 'string'
    && ['pending', 'assigned', 'in_service', 'completed', 'cancelled'].includes(String(value.status));
}

// Confirma metadados e coleções essenciais antes de substituir todo o cache.
function isSnapshot(value: unknown): value is EcoRotaSnapshot {
  // Snapshot precisa ser objeto e não lista/primitivo.
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && Number.isInteger(value.generation)
    && Number.isInteger(value.revision)
    && typeof value.simulationTime === 'number'
    && typeof value.paused === 'boolean'
    && typeof value.observedAt === 'string'
    && Array.isArray(value.points)
    && Array.isArray(value.collectors)
    && Array.isArray(value.routes)
    && Array.isArray(value.requests)
    && value.requests.every(isRequest)
    && typeof value.eventCursor === 'string';
}

// Confirma ID, ordenação, tipo permitido e dados compatíveis com a categoria do evento.
function isEvent(value: unknown): value is EcoRotaEventMessage {
  // Evento precisa ser objeto antes de validar metadados e tipo.
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && Number.isInteger(value.revision)
    && Number.isInteger(value.generation)
    && typeof value.simulationTime === 'number'
    && typeof value.occurredAt === 'string'
    && typeof value.type === 'string'
    && EVENT_TYPES.has(value.type as EcoRotaEventType)
    && 'data' in value;
}

// Faz parse do JSON e rejeita mensagens que não correspondem a snapshot nem evento válido.
export function parseEcoRotaStreamMessage(raw: string): EcoRotaStreamMessage {
  let value: unknown;
  // Converte texto externo em valor desconhecido sem confiar que seja JSON válido.
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('A EcoRota enviou uma mensagem WebSocket que não é JSON válido.');
  }

  // Reconhece envelope snapshot somente quando seu data também passa pela validação.
  if (isRecord(value) && value.type === 'snapshot' && isSnapshot(value.data)) {
    return { type: 'snapshot', data: value.data };
  }
  // Retorna evento somente depois de validar tipo e estrutura correspondente.
  if (isEvent(value)) return value;
  throw new Error('A EcoRota enviou uma mensagem WebSocket fora do contrato esperado.');
}

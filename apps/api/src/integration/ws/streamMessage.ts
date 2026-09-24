import type { EcoRotaEventMessage, EcoRotaEventType, EcoRotaRequest, EcoRotaSnapshot } from '../ecorotaClient.js';

export type EcoRotaStreamMessage =
  | { type: 'snapshot'; data: EcoRotaSnapshot }
  | EcoRotaEventMessage;

const EVENT_TYPES = new Set<EcoRotaEventType>([
  'collector.created', 'collector.updated', 'collector.deleted', 'collector.position_updated',
  'route.updated', 'request.created', 'request.assigned', 'request.started', 'request.completed',
  'request.cancelled', 'request.requeued', 'simulation.incident', 'simulation.updated', 'simulation.reset',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isRequest(value: unknown): value is EcoRotaRequest {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && typeof value.pointId === 'string'
    && typeof value.externalReference === 'string'
    && ['pending', 'assigned', 'in_service', 'completed', 'cancelled'].includes(String(value.status));
}

function isSnapshot(value: unknown): value is EcoRotaSnapshot {
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

function isEvent(value: unknown): value is EcoRotaEventMessage {
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

export function parseEcoRotaStreamMessage(raw: string): EcoRotaStreamMessage {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('A EcoRota enviou uma mensagem WebSocket que não é JSON válido.');
  }

  if (isRecord(value) && value.type === 'snapshot' && isSnapshot(value.data)) {
    return { type: 'snapshot', data: value.data };
  }
  if (isEvent(value)) return value;
  throw new Error('A EcoRota enviou uma mensagem WebSocket fora do contrato esperado.');
}

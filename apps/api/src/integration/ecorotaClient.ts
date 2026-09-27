/**
 * Contrato independente de transporte para toda comunicação com a EcoRota.
 * Serviços dependem desta interface; produção usa HTTP e testes usam o adaptador fake.
 */
import type { Collector, Point } from '@ecorota/shared';
import type { EventMessage } from '@ecorota/shared';

// Enumera os estados de solicitação aceitos diretamente no protocolo externo.
export type EcoRotaRequestStatus = 'pending' | 'assigned' | 'in_service' | 'completed' | 'cancelled';

// Enumera todos os tipos incrementais conhecidos pelo cache e sincronizador.
export type EcoRotaEventType =
  | 'collector.created'
  | 'collector.updated'
  | 'collector.deleted'
  | 'collector.position_updated'
  | 'route.updated'
  | 'request.created'
  | 'request.assigned'
  | 'request.started'
  | 'request.completed'
  | 'request.cancelled'
  | 'request.requeued'
  | 'simulation.incident'
  | 'simulation.updated'
  | 'simulation.reset';

// Restringe o tipo genérico de evento compartilhado ao vocabulário EcoRota conhecido.
export type EcoRotaEventMessage = Omit<EventMessage<unknown>, 'type'> & { type: EcoRotaEventType };

// Representa uma solicitação conforme devolvida pela EcoRota.
export interface EcoRotaRequest {
  id: string;
  pointId: string;
  externalReference: string;
  status: EcoRotaRequestStatus;
  collectorId: string | null;
  createdAt: string;
  createdSimulationTime: number;
  updatedAt: string;
}

// Representa geometria, paradas e tempos calculados para a rota de um coletor.
export interface EcoRotaRoute {
  collectorId: string;
  revision: number;
  reason: string;
  destinationId: string | null;
  habitualPointIds: string[];
  nextHabitualPointId: string;
  geometry: { type: 'LineString'; coordinates: Array<[number, number]> };
  distanceMeters: number;
  durationMs: number;
  remainingMs: number;
  stops: string[];
}

// Representa o estado integral usado para inicializar ou substituir o cache operacional.
export interface EcoRotaSnapshot {
  id: string;
  name: string;
  generation: number;
  revision: number;
  simulationTime: number;
  paused: boolean;
  observedAt: string;
  maxCollectors: number;
  occupiedSlots: number;
  tickMs: number;
  pollIntervalMs: number;
  points: Point[];
  collectors: Collector[];
  routes: EcoRotaRoute[];
  requests: EcoRotaRequest[];
  eventCursor: string;
}

// Padroniza dados e metadados retornados pelos endpoints HTTP externos.
export interface EcoRotaEnvelope<T> {
  data: T;
  revision: number;
  generation: number;
  simulationTime: number;
  observedAt: string;
}

// Define os campos enviados ao criar uma solicitação externa.
export interface CreateEcoRotaRequestInput {
  pointId: string;
  externalReference: string;
}

// Define os campos opcionais aceitos na atualização externa de um coletor.
export interface UpdateEcoRotaCollectorInput {
  name?: string;
  available?: boolean;
}

// Abstrai as operações HTTP para permitir adaptadores real e fake intercambiáveis.
export interface EcoRotaClient {
  createRequest(input: CreateEcoRotaRequestInput): Promise<EcoRotaEnvelope<EcoRotaRequest>>;
  cancelRequest(requestId: string): Promise<EcoRotaEnvelope<EcoRotaRequest>>;
  completeRequest(requestId: string): Promise<EcoRotaEnvelope<EcoRotaRequest>>;
  getSnapshot(): Promise<EcoRotaEnvelope<EcoRotaSnapshot>>;
  listPoints(): Promise<EcoRotaEnvelope<Point[]>>;
  listCollectors(): Promise<EcoRotaEnvelope<Collector[]>>;
  updateCollector(id: string, input: UpdateEcoRotaCollectorInput): Promise<EcoRotaEnvelope<Collector>>;
}

// Preserva status/código externos e informa se a falha admite nova tentativa.
export class EcoRotaIntegrationError extends Error {
  // Preserva metadados suficientes para decidir resposta HTTP e estratégia de retry.
  constructor(
    message: string,
    readonly statusCode: number | null,
    readonly externalCode: string | null,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'EcoRotaIntegrationError';
  }
}

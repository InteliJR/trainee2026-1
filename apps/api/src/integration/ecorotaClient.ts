import type { Collector, Point } from '@ecorota/shared';
import type { EventMessage } from '@ecorota/shared';

export type EcoRotaRequestStatus = 'pending' | 'assigned' | 'in_service' | 'completed' | 'cancelled';

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

export type EcoRotaEventMessage = Omit<EventMessage<unknown>, 'type'> & { type: EcoRotaEventType };

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

export interface EcoRotaEnvelope<T> {
  data: T;
  revision: number;
  generation: number;
  simulationTime: number;
  observedAt: string;
}

export interface CreateEcoRotaRequestInput {
  pointId: string;
  externalReference: string;
}

export interface UpdateEcoRotaCollectorInput {
  name?: string;
  available?: boolean;
}

export interface EcoRotaClient {
  createRequest(input: CreateEcoRotaRequestInput): Promise<EcoRotaEnvelope<EcoRotaRequest>>;
  cancelRequest(requestId: string): Promise<EcoRotaEnvelope<EcoRotaRequest>>;
  completeRequest(requestId: string): Promise<EcoRotaEnvelope<EcoRotaRequest>>;
  getSnapshot(): Promise<EcoRotaEnvelope<EcoRotaSnapshot>>;
  listPoints(): Promise<EcoRotaEnvelope<Point[]>>;
  listCollectors(): Promise<EcoRotaEnvelope<Collector[]>>;
  updateCollector(id: string, input: UpdateEcoRotaCollectorInput): Promise<EcoRotaEnvelope<Collector>>;
}

export class EcoRotaIntegrationError extends Error {
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

import { EventEmitter } from 'node:events';
import type { Collector, Point } from '@ecorota/shared';
import type { EcoRotaEventMessage, EcoRotaRequest, EcoRotaRoute, EcoRotaSnapshot } from '../ecorotaClient.js';

export interface OperationStateSnapshot {
  generation: number;
  revision: number;
  simulationTime: number;
  pollIntervalMs: number;
  paused: boolean;
  observedAt: string;
  points: Point[];
  collectors: Collector[];
  routes: EcoRotaRoute[];
  requests: EcoRotaRequest[];
  eventCursor: string;
  updatedAt: string;
}

export type OperationStateEvent =
  | { type: 'operation.snapshot'; payload: OperationStateSnapshot }
  | { type: 'operation.event'; payload: EcoRotaEventMessage };

export type EventApplicationResult =
  | 'applied'
  | 'duplicate'
  | 'old_revision'
  | 'awaiting_snapshot'
  | 'unknown_event';

const REQUEST_EVENT_TYPES = new Set([
  'request.created',
  'request.assigned',
  'request.started',
  'request.completed',
  'request.cancelled',
  'request.requeued',
]);

export class OperationStateStore {
  private readonly emitter = new EventEmitter();
  private generation = -1;
  private revision = -1;
  private simulationTime = 0;
  private pollIntervalMs = 5_000;
  private paused = false;
  private observedAt = new Date(0).toISOString();
  private eventCursor = '';
  private updatedAt = new Date(0).toISOString();
  private readonly points = new Map<string, Point>();
  private readonly collectors = new Map<string, Collector>();
  private readonly routes = new Map<string, EcoRotaRoute>();
  private readonly requests = new Map<string, EcoRotaRequest>();
  private readonly seenIdsAtCurrentRevision = new Set<string>();

  replaceSnapshot(snapshot: EcoRotaSnapshot): void {
    this.generation = snapshot.generation;
    this.revision = snapshot.revision;
    this.simulationTime = snapshot.simulationTime;
    this.pollIntervalMs = snapshot.pollIntervalMs;
    this.paused = snapshot.paused;
    this.observedAt = snapshot.observedAt;
    this.eventCursor = snapshot.eventCursor;
    this.updatedAt = new Date().toISOString();
    this.replaceMap(this.points, snapshot.points, (point) => point.id);
    this.replaceMap(this.collectors, snapshot.collectors, (collector) => collector.id);
    this.replaceMap(this.routes, snapshot.routes, (route) => route.collectorId);
    this.replaceMap(this.requests, snapshot.requests, (request) => request.id);
    this.seenIdsAtCurrentRevision.clear();
    this.emitter.emit('update', { type: 'operation.snapshot', payload: this.getSnapshot() } satisfies OperationStateEvent);
  }

  applyEvent(event: EcoRotaEventMessage): EventApplicationResult {
    if (this.generation < 0 || event.generation > this.generation) return 'awaiting_snapshot';
    if (event.generation < this.generation || event.revision < this.revision) return 'old_revision';
    if (this.seenIdsAtCurrentRevision.has(event.id)) return 'duplicate';

    if (event.revision > this.revision) {
      this.revision = event.revision;
      this.seenIdsAtCurrentRevision.clear();
    }

    const applied = this.applyKnownEvent(event);
    if (!applied) return 'unknown_event';

    this.seenIdsAtCurrentRevision.add(event.id);
    this.simulationTime = event.simulationTime;
    this.observedAt = event.occurredAt;
    this.updatedAt = new Date().toISOString();
    this.emitter.emit('update', { type: 'operation.event', payload: event } satisfies OperationStateEvent);
    return 'applied';
  }

  getSnapshot(): OperationStateSnapshot {
    return {
      generation: this.generation,
      revision: this.revision,
      simulationTime: this.simulationTime,
      pollIntervalMs: this.pollIntervalMs,
      paused: this.paused,
      observedAt: this.observedAt,
      points: [...this.points.values()],
      collectors: [...this.collectors.values()],
      routes: [...this.routes.values()],
      requests: [...this.requests.values()],
      eventCursor: this.eventCursor,
      updatedAt: this.updatedAt,
    };
  }

  onUpdate(listener: (event: OperationStateEvent) => void): () => void {
    this.emitter.on('update', listener);
    return () => this.emitter.off('update', listener);
  }

  private applyKnownEvent(event: EcoRotaEventMessage): boolean {
    if (event.type === 'collector.created' || event.type === 'collector.updated') {
      const collector = event.data as Collector;
      this.collectors.set(collector.id, collector);
      return true;
    }
    if (event.type === 'collector.deleted') {
      this.collectors.delete((event.data as { id: string }).id);
      return true;
    }
    if (event.type === 'collector.position_updated') {
      const patch = event.data as Pick<Collector, 'id' | 'position' | 'observedAt'>;
      const current = this.collectors.get(patch.id);
      if (current) this.collectors.set(patch.id, { ...current, ...patch });
      return Boolean(current);
    }
    if (event.type === 'route.updated') {
      const route = event.data as EcoRotaRoute;
      this.routes.set(route.collectorId, route);
      return true;
    }
    if (REQUEST_EVENT_TYPES.has(event.type)) {
      this.applyRequest(event.data as EcoRotaRequest);
      return true;
    }
    if (event.type === 'simulation.updated') {
      this.paused = (event.data as { paused: boolean }).paused;
      return true;
    }
    if (event.type === 'simulation.incident' || event.type === 'simulation.reset') return true;
    return false;
  }

  private applyRequest(request: EcoRotaRequest): void {
    const previous = this.requests.get(request.id);
    if (previous) this.changeDemand(previous.pointId, previous.status, -1);
    this.requests.set(request.id, request);
    this.changeDemand(request.pointId, request.status, 1);
  }

  private changeDemand(pointId: string, status: EcoRotaRequest['status'], delta: number): void {
    const point = this.points.get(pointId);
    if (!point) return;
    point.demand[status] = Math.max(0, point.demand[status] + delta);
    this.points.set(pointId, { ...point, demand: { ...point.demand } });
  }

  private replaceMap<T>(
    target: Map<string, T>,
    values: T[],
    key: (value: T) => string,
  ): void {
    target.clear();
    for (const value of values) target.set(key(value), value);
  }
}

export const operationState = new OperationStateStore();

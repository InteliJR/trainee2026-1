import { randomUUID } from 'node:crypto';
import type { CollectionPoint } from '../../generated/prisma/client.js';
import type { CollectionPointRepository } from '../operation/collectionPoint.repository.js';

export interface LocalSimulationRoute {
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

export interface LocalSimulationCollector {
  id: string;
  name: string;
  origin: 'custom';
  available: boolean;
  status: string;
  circuit: number;
  position: { type: 'Point'; coordinates: [number, number] };
  observedAt: string;
  destinationId: string | null;
  routeRevision: number;
}

export interface LocalSimulationState {
  runId: string | null;
  sequence: number;
  status: 'PARADA' | 'EM_EXECUCAO';
  collector: LocalSimulationCollector | null;
  route: LocalSimulationRoute | null;
  originPointId: string | null;
  destinationPointId: string | null;
  progress: number;
  direction: 'IDA' | 'VOLTA' | null;
  startedAt: string | null;
  stoppedAt: string | null;
  updatedAt: string;
}

type Listener = (state: LocalSimulationState) => void;

export class LocalCollectorSimulation {
  private timer: NodeJS.Timeout | null = null;
  private listeners = new Set<Listener>();
  private origin: CollectionPoint | null = null;
  private destination: CollectionPoint | null = null;
  private legStartedAt = 0;
  private state: LocalSimulationState = {
    runId: null,
    sequence: 0,
    status: 'PARADA',
    collector: null,
    route: null,
    originPointId: null,
    destinationPointId: null,
    progress: 0,
    direction: null,
    startedAt: null,
    stoppedAt: null,
    updatedAt: new Date().toISOString(),
  };

  constructor(
    private readonly repository: CollectionPointRepository,
    private readonly tickMs = 500,
    private readonly legDurationMs = 20_000,
  ) {}

  getSnapshot(): LocalSimulationState {
    return structuredClone(this.state);
  }

  onUpdate(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async start(originId: string, destinationId: string): Promise<LocalSimulationState> {
    if (originId === destinationId) throw new Error('PONTOS_SIMULACAO_DEVEM_SER_DISTINTOS');
    if (this.state.status === 'EM_EXECUCAO') throw new Error('SIMULACAO_LOCAL_EM_EXECUCAO');
    const [origin, destination] = await Promise.all([
      this.repository.findById(originId),
      this.repository.findById(destinationId),
    ]);
    if (!origin || !destination) throw new Error('PONTO_LOCAL_NAO_ENCONTRADO');
    if (!origin.active || !destination.active) throw new Error('PONTO_LOCAL_INATIVO');
    this.origin = origin;
    this.destination = destination;
    const now = new Date();
    this.legStartedAt = Date.now();
    this.state = {
      runId: randomUUID(),
      sequence: 1,
      status: 'EM_EXECUCAO',
      collector: this.collectorAt(origin, destination, 0, 1, now),
      route: this.routeBetween(origin, destination, 1, this.legDurationMs),
      originPointId: origin.id,
      destinationPointId: destination.id,
      progress: 0,
      direction: 'IDA',
      startedAt: now.toISOString(),
      stoppedAt: null,
      updatedAt: now.toISOString(),
    };
    this.emit();
    this.timer = setInterval(() => this.tick(), this.tickMs);
    return this.getSnapshot();
  }

  stop(): LocalSimulationState {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const now = new Date().toISOString();
    this.state = { ...this.state, sequence: this.state.sequence + 1, status: 'PARADA', collector: null, route: null, stoppedAt: now, updatedAt: now };
    this.emit();
    return this.getSnapshot();
  }

  close(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.listeners.clear();
  }

  private tick(): void {
    if (!this.origin || !this.destination || this.state.status !== 'EM_EXECUCAO') return;
    let progress = (Date.now() - this.legStartedAt) / this.legDurationMs;
    if (progress >= 1) {
      progress = 0;
      this.legStartedAt = Date.now();
      [this.origin, this.destination] = [this.destination, this.origin];
    }
    const now = new Date();
    const sequence = this.state.sequence + 1;
    const direction = this.state.direction === 'IDA' && progress === 0 ? 'VOLTA' : this.state.direction === 'VOLTA' && progress === 0 ? 'IDA' : this.state.direction;
    this.state = {
      ...this.state,
      sequence,
      collector: this.collectorAt(this.origin, this.destination, progress, sequence, now),
      route: this.routeBetween(this.origin, this.destination, sequence, Math.max(0, this.legDurationMs * (1 - progress))),
      originPointId: this.origin.id,
      destinationPointId: this.destination.id,
      progress,
      direction,
      updatedAt: now.toISOString(),
    };
    this.emit();
  }

  private collectorAt(origin: CollectionPoint, destination: CollectionPoint, progress: number, revision: number, now: Date): LocalSimulationCollector {
    const from: [number, number] = [Number(origin.longitude), Number(origin.latitude)];
    const to: [number, number] = [Number(destination.longitude), Number(destination.latitude)];
    return {
      id: 'local-sim:collector',
      name: 'Coletor local simulado',
      origin: 'custom',
      available: false,
      status: 'moving',
      circuit: origin.circuit,
      position: { type: 'Point', coordinates: [from[0] + (to[0] - from[0]) * progress, from[1] + (to[1] - from[1]) * progress] },
      observedAt: now.toISOString(),
      destinationId: `local:${destination.id}`,
      routeRevision: revision,
    };
  }

  private routeBetween(origin: CollectionPoint, destination: CollectionPoint, revision: number, remainingMs: number): LocalSimulationRoute {
    const originId = `local:${origin.id}`;
    const destinationId = `local:${destination.id}`;
    const from: [number, number] = [Number(origin.longitude), Number(origin.latitude)];
    const to: [number, number] = [Number(destination.longitude), Number(destination.latitude)];
    return {
      collectorId: 'local-sim:collector',
      revision,
      reason: 'local-simulation',
      destinationId,
      habitualPointIds: [originId, destinationId],
      nextHabitualPointId: destinationId,
      geometry: { type: 'LineString', coordinates: [from, to] },
      distanceMeters: 0,
      durationMs: this.legDurationMs,
      remainingMs,
      stops: [originId, destinationId],
    };
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}

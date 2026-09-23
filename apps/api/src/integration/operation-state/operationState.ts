import { EventEmitter } from 'node:events';
import type { Point, Collector } from '@ecorota/shared';

export interface OperationStateSnapshot {
  revision: number;
  points: Point[];
  collectors: Collector[];
  updatedAt: string;
}

export type OperationStateEvent =
  | { type: 'collector.position_updated'; collectorId: string; payload: Partial<Collector> }
  | { type: 'point.status_updated'; pointId: string; payload: Partial<Point> }
  | { type: 'operation.snapshot'; payload: OperationStateSnapshot };

const MOCK_POINTS: Point[] = [
  {
    id: 'point-1',
    name: 'Ponto 1 - Praça da Sé',
    kind: 'habitual',
    coordinates: [-46.6333, -23.5505],
    circuit: 1,
    demand: { pending: 2, assigned: 1, in_service: 0, completed: 5, cancelled: 0 },
  },
  {
    id: 'point-2',
    name: 'Ponto 2 - Av. Paulista',
    kind: 'habitual',
    coordinates: [-46.6559, -23.5615],
    circuit: 1,
    demand: { pending: 1, assigned: 0, in_service: 1, completed: 8, cancelled: 0 },
  },
  {
    id: 'point-3',
    name: 'Ponto 3 - Parque Ibirapuera',
    kind: 'habitual',
    coordinates: [-46.6576, -23.5874],
    circuit: 1,
    demand: { pending: 3, assigned: 1, in_service: 0, completed: 12, cancelled: 1 },
  },
  {
    id: 'point-4',
    name: 'Ponto 4 - Vila Madalena',
    kind: 'habitual',
    coordinates: [-46.6908, -23.5552],
    circuit: 1,
    demand: { pending: 0, assigned: 2, in_service: 0, completed: 4, cancelled: 0 },
  },
  {
    id: 'point-5',
    name: 'Ponto 5 - Pinheiros',
    kind: 'habitual',
    coordinates: [-46.6966, -23.5673],
    circuit: 1,
    demand: { pending: 1, assigned: 0, in_service: 0, completed: 7, cancelled: 0 },
  },
  {
    id: 'point-6',
    name: 'Ponto 6 - Faria Lima',
    kind: 'habitual',
    coordinates: [-46.6853, -23.5801],
    circuit: 1,
    demand: { pending: 4, assigned: 1, in_service: 1, completed: 15, cancelled: 2 },
  },
  {
    id: 'point-7',
    name: 'Ponto 7 - Moema',
    kind: 'habitual',
    coordinates: [-46.6644, -23.6027],
    circuit: 2,
    demand: { pending: 0, assigned: 1, in_service: 0, completed: 9, cancelled: 0 },
  },
  {
    id: 'point-8',
    name: 'Ponto 8 - Itaim Bibi',
    kind: 'habitual',
    coordinates: [-46.6781, -23.5847],
    circuit: 2,
    demand: { pending: 2, assigned: 0, in_service: 1, completed: 6, cancelled: 0 },
  },
  {
    id: 'point-9',
    name: 'Ponto 9 - Brooklin',
    kind: 'habitual',
    coordinates: [-46.6912, -23.6121],
    circuit: 2,
    demand: { pending: 1, assigned: 1, in_service: 0, completed: 3, cancelled: 0 },
  },
  {
    id: 'point-10',
    name: 'Ponto 10 - Morumbi',
    kind: 'habitual',
    coordinates: [-46.7135, -23.6001],
    circuit: 2,
    demand: { pending: 0, assigned: 0, in_service: 0, completed: 10, cancelled: 1 },
  },
  {
    id: 'point-11',
    name: 'Ponto 11 - Ponto Adicional A',
    kind: 'additional',
    coordinates: [-46.6412, -23.5651],
    circuit: 2,
    demand: { pending: 5, assigned: 0, in_service: 0, completed: 2, cancelled: 0 },
  },
  {
    id: 'point-12',
    name: 'Ponto 12 - Ponto Adicional B',
    kind: 'additional',
    coordinates: [-46.6715, -23.5489],
    circuit: 2,
    demand: { pending: 2, assigned: 2, in_service: 0, completed: 1, cancelled: 0 },
  },
];

const MOCK_COLLECTORS: Collector[] = [
  {
    id: 'collector-1',
    name: 'Coletor 01 (Sistema)',
    origin: 'system',
    available: true,
    status: 'moving',
    circuit: 1,
    position: { type: 'Point', coordinates: [-46.65, -23.555] },
    observedAt: new Date().toISOString(),
  },
  {
    id: 'collector-2',
    name: 'Coletor 02 (Sistema)',
    origin: 'system',
    available: true,
    status: 'moving',
    circuit: 2,
    position: { type: 'Point', coordinates: [-46.68, -23.595] },
    observedAt: new Date().toISOString(),
  },
  {
    id: 'collector-3',
    name: 'Coletor Autônomo João',
    origin: 'custom',
    available: true,
    status: 'idle',
    circuit: 1,
    position: { type: 'Point', coordinates: [-46.66, -23.57] },
    observedAt: new Date().toISOString(),
  },
];

class OperationStateStore {
  private readonly emitter = new EventEmitter();
  private revision = 0;
  private readonly points = new Map<string, Point>(MOCK_POINTS.map((p) => [p.id, p]));
  private readonly collectors = new Map<string, Collector>(
    MOCK_COLLECTORS.map((c) => [c.id, c]),
  );

  getSnapshot(): OperationStateSnapshot {
    return {
      revision: this.revision,
      points: [...this.points.values()],
      collectors: [...this.collectors.values()],
      updatedAt: new Date().toISOString(),
    };
  }

  getCollector(id: string): Collector | undefined {
    return this.collectors.get(id);
  }

  updateCollector(id: string, patch: Partial<Collector>): void {
    const current = this.collectors.get(id);
    if (!current) return;
    const updated: Collector = { ...current, ...patch };
    this.collectors.set(id, updated);
    this.revision += 1;
    this.emitter.emit('update', {
      type: 'collector.position_updated',
      collectorId: id,
      payload: updated,
    } satisfies OperationStateEvent);
  }

  updatePoint(id: string, patch: Partial<Point>): void {
    const current = this.points.get(id);
    if (!current) return;
    const updated: Point = { ...current, ...patch };
    this.points.set(id, updated);
    this.revision += 1;
    this.emitter.emit('update', {
      type: 'point.status_updated',
      pointId: id,
      payload: updated,
    } satisfies OperationStateEvent);
  }

  onUpdate(listener: (event: OperationStateEvent) => void): void {
    this.emitter.on('update', listener);
  }
}

export const operationState = new OperationStateStore();
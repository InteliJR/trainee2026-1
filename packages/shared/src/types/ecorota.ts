export interface PointDemand {
  pending: number;
  assigned: number;
  in_service: number;
  completed: number;
  cancelled: number;
}

export interface Point {
  id: string;
  name: string;
  kind: 'habitual' | 'additional';
  coordinates: [number, number];
  circuit: number;
  demand: PointDemand;
}

export interface CollectorPosition {
  type: 'Point';
  coordinates: [number, number];
}

export interface Collector {
  id: string;
  name: string;
  origin: 'system' | 'custom';
  available: boolean;
  status: string;
  circuit: number;
  position: CollectorPosition | null;
  observedAt: string;
}

export interface SnapshotMessage<Data = unknown> {
  type: 'snapshot';
  data: Data;
}

export interface EventMessage<Data = unknown> {
  id: string;
  revision: number;
  generation: number;
  simulationTime: number;
  occurredAt: string;
  type: string;
  data: Data;
}

export type StreamMessage<Data = unknown> =
  | SnapshotMessage<Data>
  | EventMessage<Data>;
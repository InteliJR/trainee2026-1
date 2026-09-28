/**
 * Contratos compartilhados entre API e frontend para pontos, coletores e mensagens da EcoRota.
 * Este arquivo não executa lógica: ele garante que as duas aplicações interpretem os mesmos campos.
 */
export interface PointDemand {
  pending: number;
  assigned: number;
  in_service: number;
  completed: number;
  cancelled: number;
}

// Descreve um ponto habitual ou adicional exibido no mapa e usado pelas solicitações.
export interface Point {
  id: string;
  name: string;
  kind: 'habitual' | 'additional';
  coordinates: [number, number];
  circuit: number;
  demand: PointDemand;
}

// Representa uma posição GeoJSON pontual no formato longitude/latitude.
export interface CollectorPosition {
  type: 'Point';
  coordinates: [number, number];
}

// Descreve a situação operacional e a última telemetria conhecida de um coletor.
export interface Collector {
  id: string;
  name: string;
  origin: 'system' | 'custom';
  available: boolean;
  status: string;
  circuit: number;
  position: CollectorPosition | null;
  observedAt: string;
  destinationId?: string | null;
  routeRevision?: number;
}

// Envelope recebido quando a EcoRota envia uma substituição integral do estado.
export interface SnapshotMessage<Data = unknown> {
  type: 'snapshot';
  data: Data;
}

// Envelope incremental ordenado por geração e revisão.
export interface EventMessage<Data = unknown> {
  id: string;
  revision: number;
  generation: number;
  simulationTime: number;
  occurredAt: string;
  type: string;
  data: Data;
}

// União discriminada que permite separar snapshot e evento pelo campo type.
export type StreamMessage<Data = unknown> =
  | SnapshotMessage<Data>
  | EventMessage<Data>;

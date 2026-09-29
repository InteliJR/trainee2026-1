/**
 * Snapshot de exemplo usado pelos testes das telas que leem o estado em tempo real.
 * Dois pontos, dois coletores e três solicitações em estados diferentes cobrem os cenários mais comuns.
 */
import type { RealtimeRequest, RealtimeSnapshot } from './socketClient';

// Cria uma solicitação completa a partir apenas dos campos que cada cenário precisa variar.
export function createRequest(overrides: Partial<RealtimeRequest> & Pick<RealtimeRequest, 'id'>): RealtimeRequest {
  return {
    pointId: 'ponto-1',
    externalReference: `ref-${overrides.id}`,
    status: 'pending',
    collectorId: null,
    createdAt: '2026-09-27T11:00:00.000Z',
    createdSimulationTime: 0,
    updatedAt: '2026-09-27T11:00:00.000Z',
    ...overrides,
  };
}

// Monta o snapshot base; `requests` pode ser substituído por cenário.
export function createSnapshotFixture(requests?: RealtimeRequest[]): RealtimeSnapshot {
  return {
    generation: 1,
    revision: 1,
    simulationTime: 0,
    pollIntervalMs: 5_000,
    paused: false,
    observedAt: '2026-09-27T12:00:00.000Z',
    points: [
      {
        id: 'ponto-1',
        name: 'Ponto Central',
        kind: 'habitual',
        coordinates: [-46.66, -23.57],
        circuit: 1,
        demand: { pending: 1, assigned: 1, in_service: 0, completed: 1, cancelled: 0 },
      },
      {
        id: 'ponto-2',
        name: 'Ponto Norte',
        kind: 'additional',
        coordinates: [-46.64, -23.54],
        circuit: 2,
        demand: { pending: 0, assigned: 0, in_service: 0, completed: 0, cancelled: 0 },
      },
    ],
    collectors: [
      {
        id: 'coletor-1',
        name: 'Coletor Ana',
        origin: 'system',
        available: false,
        status: 'moving',
        circuit: 1,
        position: { type: 'Point', coordinates: [-46.65, -23.56] },
        observedAt: '2026-09-27T12:00:00.000Z',
      },
      {
        id: 'coletor-2',
        name: 'Coletor Bruno',
        origin: 'custom',
        available: true,
        status: 'idle',
        circuit: 2,
        position: null,
        observedAt: '2026-09-27T12:00:00.000Z',
      },
    ],
    routes: [],
    requests: requests ?? [
      createRequest({ id: 's1', status: 'pending', updatedAt: '2026-09-27T11:10:00.000Z' }),
      createRequest({ id: 's2', status: 'assigned', collectorId: 'coletor-1', updatedAt: '2026-09-27T11:30:00.000Z' }),
      createRequest({ id: 's3', status: 'completed', pointId: 'ponto-2', collectorId: 'coletor-1', updatedAt: '2026-09-27T11:20:00.000Z' }),
    ],
    eventCursor: 'cursor-1',
    updatedAt: '2026-09-27T12:00:00.000Z',
  };
}

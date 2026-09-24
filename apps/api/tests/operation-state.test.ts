import { describe, expect, it } from 'vitest';
import type { EcoRotaEventMessage, EcoRotaRequest, EcoRotaSnapshot } from '../src/integration/ecorotaClient.js';
import { OperationStateStore } from '../src/integration/operation-state/operationState.js';

const POINT_ID = '44444444-4444-4444-8444-444444444444';

function request(status: EcoRotaRequest['status'] = 'pending'): EcoRotaRequest {
  return {
    id: 'request-1',
    pointId: POINT_ID,
    externalReference: 'pedido-1',
    status,
    collectorId: null,
    createdAt: '2026-09-24T10:00:00.000Z',
    createdSimulationTime: 1,
    updatedAt: '2026-09-24T10:00:00.000Z',
  };
}

function snapshot(overrides: Partial<EcoRotaSnapshot> = {}): EcoRotaSnapshot {
  return {
    id: 'environment-1',
    name: 'Teste',
    generation: 1,
    revision: 10,
    simulationTime: 100,
    paused: false,
    observedAt: '2026-09-24T10:00:00.000Z',
    maxCollectors: 4,
    occupiedSlots: 0,
    tickMs: 1_000,
    pollIntervalMs: 5_000,
    points: [{
      id: POINT_ID,
      name: 'Ponto',
      kind: 'habitual',
      coordinates: [-46.6, -23.5],
      circuit: 1,
      demand: { pending: 1, assigned: 0, in_service: 0, completed: 0, cancelled: 0 },
    }],
    collectors: [],
    routes: [],
    requests: [request()],
    eventCursor: '10',
    ...overrides,
  };
}

function event(overrides: Partial<EcoRotaEventMessage> = {}): EcoRotaEventMessage {
  return {
    id: '11',
    revision: 11,
    generation: 1,
    simulationTime: 110,
    occurredAt: '2026-09-24T10:01:00.000Z',
    type: 'request.assigned',
    data: request('assigned'),
    ...overrides,
  };
}

describe('OperationStateStore', () => {
  it('substitui integralmente o estado quando recebe snapshot', () => {
    const state = new OperationStateStore();
    state.replaceSnapshot(snapshot());
    state.replaceSnapshot(snapshot({ generation: 2, revision: 1, points: [], requests: [], eventCursor: '1' }));

    expect(state.getSnapshot()).toMatchObject({ generation: 2, revision: 1, points: [], requests: [] });
  });

  it('aplica eventos distintos da mesma revisão e ignora ID repetido', () => {
    const state = new OperationStateStore();
    state.replaceSnapshot(snapshot());

    expect(state.applyEvent(event())).toBe('applied');
    expect(state.applyEvent(event({ id: '12', type: 'simulation.updated', data: { paused: true } }))).toBe('applied');
    expect(state.applyEvent(event({ id: '12', type: 'simulation.updated', data: { paused: false } }))).toBe('duplicate');
    expect(state.getSnapshot().paused).toBe(true);
  });

  it('ignora revisão antiga e espera snapshot de uma geração nova', () => {
    const state = new OperationStateStore();
    state.replaceSnapshot(snapshot());

    expect(state.applyEvent(event({ revision: 9 }))).toBe('old_revision');
    expect(state.applyEvent(event({ generation: 2 }))).toBe('awaiting_snapshot');
  });

  it('atualiza a demanda do ponto quando a solicitação muda de estado', () => {
    const state = new OperationStateStore();
    state.replaceSnapshot(snapshot());

    state.applyEvent(event());

    expect(state.getSnapshot().points[0]?.demand).toEqual({
      pending: 0,
      assigned: 1,
      in_service: 0,
      completed: 0,
      cancelled: 0,
    });
  });
});


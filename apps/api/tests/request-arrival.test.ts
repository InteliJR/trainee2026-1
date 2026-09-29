/**
 * Testes da previsão de chegada do coletor, calculada pela rota que a EcoRota mantém em memória.
 */
import { describe, expect, it } from 'vitest';
import type { EcoRotaRoute } from '../src/integration/ecorotaClient.js';
import { POINTS_PER_COMPLETED_COLLECTION, publicPointsRules } from '../src/modules/gamification/gamification.rules.js';
import type { RequestDetails } from '../src/modules/requests/request.repository.js';
import { estimateArrival } from '../src/modules/requests/request.service.js';

// Monta só os campos que a estimativa lê; o restante da solicitação não importa aqui.
function createRequest(overrides: Partial<RequestDetails> = {}): RequestDetails {
  return {
    status: 'ASSIGNED',
    externalCollectorId: 'coletor-ecorota-1',
    externalPointId: 'ponto-ecorota-1',
    ...overrides,
  } as RequestDetails;
}

// Rota mínima do coletor, indo para o ponto da solicitação com 90 s restantes.
function createRoute(overrides: Partial<EcoRotaRoute> = {}): EcoRotaRoute {
  return {
    collectorId: 'coletor-ecorota-1',
    revision: 1,
    reason: 'assignment',
    destinationId: 'ponto-ecorota-1',
    habitualPointIds: [],
    nextHabitualPointId: 'ponto-ecorota-1',
    geometry: { type: 'LineString', coordinates: [] },
    distanceMeters: 500,
    durationMs: 120_000,
    remainingMs: 90_000,
    stops: [],
    ...overrides,
  };
}

const OBSERVED_AT = '2026-09-28T12:00:00.000Z';

describe('estimateArrival', () => {
  it('soma o tempo restante da rota ao instante observado', () => {
    const snapshot = { routes: [createRoute()], observedAt: OBSERVED_AT };
    expect(estimateArrival(createRequest(), snapshot)).toBe('2026-09-28T12:01:30.000Z');
  });

  it('não estima quando a rota vai para outro ponto', () => {
    const snapshot = { routes: [createRoute({ destinationId: 'outro-ponto' })], observedAt: OBSERVED_AT };
    expect(estimateArrival(createRequest(), snapshot)).toBeNull();
  });

  it('não estima fora do estado atribuída nem sem vínculo com a EcoRota', () => {
    const snapshot = { routes: [createRoute()], observedAt: OBSERVED_AT };
    expect(estimateArrival(createRequest({ status: 'IN_SERVICE' }), snapshot)).toBeNull();
    expect(estimateArrival(createRequest({ externalCollectorId: null }), snapshot)).toBeNull();
    expect(estimateArrival(createRequest({ externalPointId: null }), snapshot)).toBeNull();
  });

  it('não estima sem rota do coletor', () => {
    expect(estimateArrival(createRequest(), { routes: [], observedAt: OBSERVED_AT })).toBeNull();
  });
});

describe('regras de pontuação', () => {
  it('expõe o mesmo valor usado ao creditar os pontos', () => {
    expect(publicPointsRules()).toEqual({ pontosPorColetaConcluida: POINTS_PER_COMPLETED_COLLECTION });
  });
});

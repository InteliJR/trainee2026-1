import { describe, expect, it } from 'vitest';
import { OperationStateStore } from '../src/integration/operation-state/operationState.js';
import { OperationService } from '../src/modules/operation/operation.service.js';

const POINT_ID = '44444444-4444-4444-8444-444444444444';

function populatedState(): OperationStateStore {
  const state = new OperationStateStore();
  state.replaceSnapshot({
    id: 'environment',
    name: 'Teste',
    generation: 1,
    revision: 1,
    simulationTime: 1,
    paused: false,
    observedAt: '2026-09-24T10:00:20.000Z',
    maxCollectors: 4,
    occupiedSlots: 3,
    tickMs: 1_000,
    pollIntervalMs: 5_000,
    points: [
      {
        id: POINT_ID,
        name: 'Ponto Próximo',
        kind: 'habitual',
        coordinates: [-46.6333, -23.5505],
        circuit: 1,
        demand: { pending: 2, assigned: 1, in_service: 0, completed: 3, cancelled: 0 },
      },
      {
        id: '55555555-5555-4555-8555-555555555555',
        name: 'Ponto Distante',
        kind: 'additional',
        coordinates: [-43.1729, -22.9068],
        circuit: 2,
        demand: { pending: 0, assigned: 0, in_service: 0, completed: 0, cancelled: 0 },
      },
    ],
    collectors: [
      {
        id: 'collector-1', name: 'Coletor próximo', origin: 'custom', available: true,
        status: 'idle', circuit: 1, position: { type: 'Point', coordinates: [-46.634, -23.551] },
        observedAt: '2026-09-24T10:00:20.000Z',
      },
      {
        id: 'collector-2', name: 'Coletor indisponível', origin: 'system', available: false,
        status: 'unavailable', circuit: 1, position: { type: 'Point', coordinates: [-46.63, -23.55] },
        observedAt: '2026-09-24T10:00:20.000Z',
      },
      {
        id: 'collector-3', name: 'Coletor sem telemetria', origin: 'system', available: true,
        status: 'moving', circuit: 2, position: null,
        observedAt: '2026-09-24T09:59:00.000Z',
      },
    ],
    routes: [],
    requests: [],
    eventCursor: '1',
  });
  return state;
}

describe('estado da integração operacional', () => {
  it('informa quando a EcoRota ainda não foi configurada', () => {
    const service = new OperationService(new OperationStateStore());

    expect(service.getIntegrationStatus({ id: 'operator', role: 'OPERADOR' })).toMatchObject({
      configurada: false,
      conexao: 'NAO_CONFIGURADA',
      generation: null,
      ultimaRevision: null,
    });
  });

  it('restringe a consulta ao operador', () => {
    const service = new OperationService(new OperationStateStore());

    expect(() => service.getIntegrationStatus({ id: 'resident', role: 'MORADOR' })).toThrowError(
      expect.objectContaining({ code: 'PAPEL_NAO_AUTORIZADO' }),
    );
  });

  it('rejeita consultas antes do primeiro snapshot', () => {
    const service = new OperationService(new OperationStateStore());

    expect(() => service.listPoints({ id: 'resident', role: 'MORADOR' }, {})).toThrowError(
      expect.objectContaining({ code: 'DADOS_OPERACIONAIS_INDISPONIVEIS' }),
    );
  });

  it('filtra pontos por raio e calcula a distância', () => {
    const service = new OperationService(
      populatedState(),
      undefined,
      () => new Date('2026-09-24T10:00:30.000Z'),
    );

    const result = service.listPoints(
      { id: 'resident', role: 'MORADOR' },
      { latitude: -23.5505, longitude: -46.6333, raioKm: 10 },
    );

    expect(result.total).toBe(1);
    expect(result.dados[0]).toMatchObject({ id: POINT_ID, distanciaKm: 0, dadosDesatualizados: false });
  });

  it('lista somente coletores disponíveis e sinaliza telemetria antiga', () => {
    const service = new OperationService(
      populatedState(),
      undefined,
      () => new Date('2026-09-24T10:00:30.000Z'),
    );

    const result = service.listAvailableCollectors({ id: 'resident', role: 'MORADOR' }, {});

    expect(result.total).toBe(2);
    expect(result.dados.find((collector) => collector.id === 'collector-3')).toMatchObject({
      telemetriaDesatualizada: true,
      coordenadas: null,
    });
  });

  it('exige latitude e longitude em conjunto', () => {
    const service = new OperationService(populatedState());

    expect(() => service.listPoints(
      { id: 'resident', role: 'MORADOR' },
      { latitude: -23.55 },
    )).toThrowError(expect.objectContaining({ code: 'COORDENADAS_INCOMPLETAS' }));
  });

  it('retorna 404 para ponto inexistente', () => {
    const service = new OperationService(populatedState());

    expect(() => service.getPoint(
      { id: 'resident', role: 'MORADOR' },
      '66666666-6666-4666-8666-666666666666',
    )).toThrowError(expect.objectContaining({ code: 'PONTO_COLETA_NAO_ENCONTRADO' }));
  });
});

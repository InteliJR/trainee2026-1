/** Testa distância, filtros, serialização e indicadores de atualização produzidos pelo OperationService. */
import { describe, expect, it } from 'vitest';
import { OperationStateStore } from '../src/integration/operation-state/operationState.js';
import { OperationService } from '../src/modules/operation/operation.service.js';
import type { OperationIndicatorsRepository } from '../src/modules/operation/operationIndicators.repository.js';

// Mantém um UUID estável para consultas de ponto e distância.
const POINT_ID = '44444444-4444-4444-8444-444444444444';

// Prepara um cache representativo com ponto, coletor e telemetria conhecidos.
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
    requests: [
      {
        id: 'request-1', pointId: POINT_ID, externalReference: 'reference-1', status: 'pending',
        collectorId: null, createdAt: '2026-09-24T09:00:00.000Z', createdSimulationTime: 1,
        updatedAt: '2026-09-24T09:00:00.000Z',
      },
      {
        id: 'request-2', pointId: POINT_ID, externalReference: 'reference-2', status: 'completed',
        collectorId: 'collector-1', createdAt: '2026-09-24T08:00:00.000Z', createdSimulationTime: 1,
        updatedAt: '2026-09-24T09:30:00.000Z',
      },
      {
        id: 'request-3', pointId: POINT_ID, externalReference: 'reference-3', status: 'cancelled',
        collectorId: null, createdAt: '2026-09-24T07:00:00.000Z', createdSimulationTime: 1,
        updatedAt: '2026-09-24T09:20:00.000Z',
      },
    ],
    eventCursor: '1',
  });
  return state;
}

// Devolve contagens históricas determinísticas e permite inspecionar os períodos recebidos pelo serviço.
function indicatorsRepository(): OperationIndicatorsRepository {
  // Implementa somente o contrato necessário sem carregar Prisma durante o teste unitário.
  return {
    summarize: async () => ({
      completedCollections: { day: 2, week: 5, month: 8 },
      newResidents: { day: 1, week: 3, month: 6 },
      cancelledCollectionsInMonth: 2,
    }),
  };
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

  // Valida o contrato completo que alimentará os cards administrativos do frontend.
  it('combina histórico do banco com demanda e capacidade do cache', async () => {
    // Congela o relógio para validar períodos e telemetria sem depender da execução do teste.
    const service = new OperationService(
      populatedState(),
      undefined,
      () => new Date('2026-09-24T10:00:30.000Z'),
      indicatorsRepository(),
    );

    // Consulta como operador, único papel autorizado a visualizar dados consolidados.
    const result = await service.getIndicators({ id: 'operator', role: 'OPERADOR' });

    // Confirma os dados persistidos, a taxa terminal e a projeção da revisão atual.
    expect(result.coletasRealizadas).toEqual({ hoje: 2, semanaAtual: 5, mesAtual: 8 });
    expect(result.tracao).toMatchObject({
      novosMoradores: { hoje: 1, semanaAtual: 3, mesAtual: 6 },
      concluidasNoMes: 8,
      canceladasNoMes: 2,
      taxaConclusaoPercentual: 80,
    });
    expect(result.solicitacoesAtuais).toMatchObject({ total: 3, pendentes: 1, concluidas: 1, canceladas: 1 });
    expect(result.coletores).toMatchObject({
      total: 3,
      disponiveis: 2,
      indisponiveisOuEmOperacao: 1,
      telemetriaDesatualizada: 1,
    });
    expect(result.demandaPorRegiao[0]).toEqual({
      regiao: 'Circuito 1',
      circuito: 1,
      solicitacoesAtivas: 3,
      capacidadeOfertada: 1,
      saldoCapacidade: -2,
    });
    expect(result.periodos.inicioSemana).toBe('2026-09-21T00:00:00.000Z');
  });

  // Mantém a mesma proteção de papel usada pelo endpoint de integração.
  it('restringe os indicadores ao operador', async () => {
    // Injeta o repositório para isolar o teste exclusivamente na autorização.
    const service = new OperationService(populatedState(), undefined, undefined, indicatorsRepository());

    // Espera o erro público padronizado antes que qualquer consulta histórica seja realizada.
    await expect(service.getIndicators({ id: 'resident', role: 'MORADOR' })).rejects.toMatchObject({
      code: 'PAPEL_NAO_AUTORIZADO',
    });
  });
});

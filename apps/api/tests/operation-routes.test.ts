/** Testa as rotas operacionais em português e a validação dos parâmetros geográficos. */
import Fastify, { type FastifyInstance, type preHandlerHookHandler } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { errorHandler } from '../src/errors/errorHandler.js';
import { OperationStateStore } from '../src/integration/operation-state/operationState.js';
import { operationRoutes } from '../src/modules/operation/operation.routes.js';
import { OperationService } from '../src/modules/operation/operation.service.js';
import type { OperationIndicatorsRepository } from '../src/modules/operation/operationIndicators.repository.js';

// Identifica o ponto retornado pelos endpoints do cenário.
const POINT_ID = '44444444-4444-4444-8444-444444444444';

// Monta Fastify, cache e identidade fake sem acessar banco nem rede.
function createApp(role: 'MORADOR' | 'OPERADOR' = 'MORADOR'): FastifyInstance {
  const state = new OperationStateStore();
  state.replaceSnapshot({
    id: 'environment', name: 'Teste', generation: 1, revision: 1, simulationTime: 1,
    paused: false, observedAt: new Date().toISOString(), maxCollectors: 4, occupiedSlots: 1,
    tickMs: 1_000, pollIntervalMs: 5_000,
    points: [{
      id: POINT_ID, name: 'Ponto Central', kind: 'habitual', coordinates: [-46.6333, -23.5505],
      circuit: 1, demand: { pending: 1, assigned: 0, in_service: 0, completed: 0, cancelled: 0 },
    }],
    collectors: [{
      id: 'collector-1', name: 'Coletor', origin: 'custom', available: true, status: 'idle',
      circuit: 1, position: { type: 'Point', coordinates: [-46.6334, -23.5506] },
      observedAt: new Date().toISOString(),
    }],
    routes: [], requests: [], eventCursor: '1',
  });
  const app = Fastify({ logger: false });
  app.setErrorHandler(errorHandler);
  const identify: preHandlerHookHandler = async (request) => {
    // Alterna o papel para exercitar endpoints públicos e administrativos com a mesma montagem.
    request.actor = { id: role === 'OPERADOR' ? 'operator' : 'resident', role };
  };
  // Simula as agregações PostgreSQL sem abrir rede durante o teste de rota.
  const indicatorsRepository: OperationIndicatorsRepository = {
    // Retorna valores mínimos porque a serialização detalhada já é coberta no teste do serviço.
    summarize: async () => ({
      completedCollections: { day: 1, week: 2, month: 3 },
      newResidents: { day: 1, week: 1, month: 2 },
      cancelledCollectionsInMonth: 1,
    }),
  };
  app.register(operationRoutes, {
    prefix: '/api/v1',
    identify,
    service: new OperationService(state, undefined, undefined, indicatorsRepository),
  });
  return app;
}

describe('rotas do estado operacional', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('expõe pontos e coletores em endpoints em português', async () => {
    app = createApp();
    const points = await app.inject({
      method: 'GET',
      url: '/api/v1/pontos-coleta?latitude=-23.5505&longitude=-46.6333&raioKm=2',
    });
    const collectors = await app.inject({ method: 'GET', url: '/api/v1/coletores/disponiveis' });
    const detail = await app.inject({ method: 'GET', url: `/api/v1/pontos-coleta/${POINT_ID}` });

    expect(points.statusCode).toBe(200);
    expect(points.json().total).toBe(1);
    expect(collectors.statusCode).toBe(200);
    expect(collectors.json().total).toBe(1);
    expect(detail.statusCode).toBe(200);
    expect(detail.json().id).toBe(POINT_ID);
  });

  it('devolve erro padronizado para coordenadas incompletas', async () => {
    app = createApp();
    const response = await app.inject({ method: 'GET', url: '/api/v1/pontos-coleta?latitude=-23.55' });

    expect(response.statusCode).toBe(400);
    expect(response.json().codigo).toBe('COORDENADAS_INCOMPLETAS');
  });

  // Confirma que a URL prevista no WAD está registrada e protegida pelo papel administrativo.
  it('expõe indicadores em português somente para operador', async () => {
    // Monta uma aplicação com identidade administrativa autorizada.
    app = createApp('OPERADOR');
    // Consulta o endpoint consolidado usado pelos cards do dashboard.
    const response = await app.inject({ method: 'GET', url: '/api/v1/operacao/indicadores' });

    // Verifica status, histórico e capacidade calculada a partir do cache.
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      coletasRealizadas: { hoje: 1, semanaAtual: 2, mesAtual: 3 },
      tracao: { taxaConclusaoPercentual: 75 },
      coletores: { total: 1, disponiveis: 1 },
    });

    // Fecha esta montagem antes de criar outra aplicação no mesmo caso de teste.
    await app.close();
    // Substitui a referência para o afterEach não tentar fechar a instância anterior novamente.
    app = createApp('MORADOR');
    // Tenta acessar a mesma URL com papel sem visão administrativa.
    const forbidden = await app.inject({ method: 'GET', url: '/api/v1/operacao/indicadores' });
    // Confirma o contrato de autorização padronizado.
    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.json().codigo).toBe('PAPEL_NAO_AUTORIZADO');
  });
});

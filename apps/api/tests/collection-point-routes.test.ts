import Fastify, { type FastifyInstance, type preHandlerHookHandler } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import type { CollectionPoint, CollectionPointKind } from '../src/generated/prisma/client.js';
import { errorHandler } from '../src/errors/errorHandler.js';
import type { CollectionPointRepository, CreateCollectionPointData, UpdateCollectionPointData } from '../src/modules/operation/collectionPoint.repository.js';
import { collectionPointRoutes } from '../src/modules/operation/collectionPoint.routes.js';
import { CollectionPointService } from '../src/modules/operation/collectionPoint.service.js';

const POINT_ID = '44444444-4444-4444-8444-444444444444';
const OPERATOR_ID = '33333333-3333-4333-8333-333333333333';

function createApp(role: 'OPERADOR' | 'MORADOR' = 'OPERADOR'): FastifyInstance {
  const data: CollectionPoint[] = [];
  const repository: CollectionPointRepository = {
    async create(input: CreateCollectionPointData) {
      const now = new Date('2026-09-28T12:00:00.000Z');
      const created: CollectionPoint = {
        id: POINT_ID,
        name: input.name,
        kind: input.kind as CollectionPointKind,
        latitude: input.latitude as unknown as CollectionPoint['latitude'],
        longitude: input.longitude as unknown as CollectionPoint['longitude'],
        circuit: input.circuit,
        description: input.description,
        active: input.active,
        createdByUserId: input.createdByUserId,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      data.push(created);
      return created;
    },
    async list() { return data; },
    async findById(id: string) { return data.find((point) => point.id === id) ?? null; },
    async update(id: string, input: UpdateCollectionPointData) {
      const found = data.find((point) => point.id === id);
      return found ? Object.assign(found, input) : null;
    },
    async archive(id: string) {
      const found = data.find((point) => point.id === id);
      if (!found) return false;
      found.active = false;
      return true;
    },
  };
  const app = Fastify({ logger: false });
  app.setErrorHandler(errorHandler);
  const identify: preHandlerHookHandler = async (request) => {
    request.actor = { id: role === 'OPERADOR' ? OPERATOR_ID : '11111111-1111-4111-8111-111111111111', role };
  };
  app.register(collectionPointRoutes, {
    prefix: '/api/v1',
    identify,
    service: new CollectionPointService(repository),
  });
  return app;
}

const validBody = {
  nome: 'Ponto Centro',
  tipo: 'ADICIONAL',
  latitude: -23.55052,
  longitude: -46.633308,
  circuito: 1,
};

describe('rotas administrativas de pontos de coleta', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('cria, lista, atualiza e exclui um ponto', async () => {
    app = createApp();
    const created = await app.inject({ method: 'POST', url: '/api/v1/operacao/pontos-coleta', payload: validBody });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ id: POINT_ID, nome: 'Ponto Centro', tipo: 'ADICIONAL' });

    const listed = await app.inject({ method: 'GET', url: '/api/v1/operacao/pontos-coleta' });
    expect(listed.json().total).toBe(1);

    const updated = await app.inject({ method: 'PATCH', url: `/api/v1/operacao/pontos-coleta/${POINT_ID}`, payload: { nome: 'Ponto Atualizado' } });
    expect(updated.json().nome).toBe('Ponto Atualizado');

    const removed = await app.inject({ method: 'DELETE', url: `/api/v1/operacao/pontos-coleta/${POINT_ID}` });
    expect(removed.statusCode).toBe(204);
  });

  it('rejeita papel sem permissão', async () => {
    app = createApp('MORADOR');
    const response = await app.inject({ method: 'POST', url: '/api/v1/operacao/pontos-coleta', payload: validBody });
    expect(response.statusCode).toBe(403);
    expect(response.json().codigo).toBe('PAPEL_NAO_AUTORIZADO');
  });

  it('rejeita entrada inválida e patch vazio', async () => {
    app = createApp();
    const invalid = await app.inject({ method: 'POST', url: '/api/v1/operacao/pontos-coleta', payload: { ...validBody, latitude: 100 } });
    const emptyPatch = await app.inject({ method: 'PATCH', url: `/api/v1/operacao/pontos-coleta/${POINT_ID}`, payload: {} });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json().codigo).toBe('DADOS_INVALIDOS');
    expect(emptyPatch.statusCode).toBe(400);
  });
});

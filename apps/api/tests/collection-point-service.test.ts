import type { CollectionPoint, CollectionPointKind } from '../src/generated/prisma/client.js';
import type { CollectionPointRepository, CollectionPointFilters, CreateCollectionPointData, UpdateCollectionPointData } from '../src/modules/operation/collectionPoint.repository.js';
import { CollectionPointService } from '../src/modules/operation/collectionPoint.service.js';
import { describe, expect, it } from 'vitest';

const OPERATOR = { id: '33333333-3333-4333-8333-333333333333', role: 'OPERADOR' as const };
const POINT_ID = '44444444-4444-4444-8444-444444444444';

function point(overrides: Partial<CollectionPoint> = {}): CollectionPoint {
  return {
    id: POINT_ID,
    name: 'Ponto Centro',
    kind: 'ADDITIONAL' as CollectionPointKind,
    latitude: -23.55052 as unknown as CollectionPoint['latitude'],
    longitude: -46.633308 as unknown as CollectionPoint['longitude'],
    circuit: 1,
    description: null,
    active: true,
    createdByUserId: OPERATOR.id,
    createdAt: new Date('2026-09-28T12:00:00.000Z'),
    updatedAt: new Date('2026-09-28T12:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  };
}

function repository(initial: CollectionPoint[] = []) {
  const data = [...initial];
  const repo: CollectionPointRepository = {
    async create(input: CreateCollectionPointData) {
      const created = point({
        name: input.name,
        kind: input.kind,
        circuit: input.circuit,
        description: input.description,
        active: input.active,
        createdByUserId: input.createdByUserId,
      });
      data.push(created);
      return created;
    },
    async list(_filters: CollectionPointFilters) { return data; },
    async findById(id: string) { return data.find((item) => item.id === id) ?? null; },
    async update(id: string, input: UpdateCollectionPointData) {
      const found = data.find((item) => item.id === id);
      return found ? Object.assign(found, input) : null;
    },
    async archive(id: string) { return data.some((item) => item.id === id); },
  };
  return repo;
}

describe('CollectionPointService', () => {
  it('cria e serializa um ponto administrado pelo operador', async () => {
    const service = new CollectionPointService(repository());
    const result = await service.create(OPERATOR, {
      nome: '  Ponto Centro  ',
      tipo: 'ADICIONAL',
      latitude: -23.55052,
      longitude: -46.633308,
      circuito: 1,
      descricao: '  Próximo à praça  ',
    });
    expect(result).toMatchObject({ nome: 'Ponto Centro', tipo: 'ADICIONAL', descricao: 'Próximo à praça', ativo: true });
  });

  it('restringe a gestão de pontos ao operador', async () => {
    const service = new CollectionPointService(repository());
    await expect(service.list({ id: 'resident', role: 'MORADOR' }, {})).rejects.toMatchObject({
      statusCode: 403,
      code: 'PAPEL_NAO_AUTORIZADO',
    });
  });

  it('responde não encontrado ao consultar um ponto ausente', async () => {
    const service = new CollectionPointService(repository());
    await expect(service.detail(OPERATOR, POINT_ID)).rejects.toMatchObject({
      statusCode: 404,
      code: 'PONTO_COLETA_NAO_ENCONTRADO',
    });
  });
});

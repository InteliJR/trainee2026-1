import type { Actor } from '../../auth/actor.js';
import { AppError } from '../../errors/appError.js';
import type { CollectionPoint, CollectionPointKind } from '../../generated/prisma/client.js';
import type { CollectionPointRepository } from './collectionPoint.repository.js';
import type { CreateCollectionPointInput, ListCollectionPointsQuery, UpdateCollectionPointInput } from './collectionPoint.schemas.js';

function ensureOperator(actor: Actor): void {
  if (actor.role !== 'OPERADOR') {
    throw new AppError({
      statusCode: 403,
      code: 'PAPEL_NAO_AUTORIZADO',
      message: 'Apenas operadores podem gerenciar pontos de coleta.',
    });
  }
}

function notFound(): AppError {
  return new AppError({
    statusCode: 404,
    code: 'PONTO_COLETA_NAO_ENCONTRADO',
    message: 'O ponto de coleta não foi encontrado.',
  });
}

function toKind(kind: 'HABITUAL' | 'ADICIONAL'): CollectionPointKind {
  return kind === 'ADICIONAL' ? 'ADDITIONAL' : 'HABITUAL';
}

export function serializeCollectionPoint(point: CollectionPoint) {
  return {
    id: point.id,
    nome: point.name,
    tipo: point.kind === 'ADDITIONAL' ? 'ADICIONAL' : 'HABITUAL',
    coordenadas: {
      latitude: Number(point.latitude),
      longitude: Number(point.longitude),
    },
    circuito: point.circuit,
    descricao: point.description,
    ativo: point.active,
    criadoPorUsuarioId: point.createdByUserId,
    criadoEm: point.createdAt.toISOString(),
    atualizadoEm: point.updatedAt.toISOString(),
  };
}

export class CollectionPointService {
  constructor(private readonly repository: CollectionPointRepository) {}

  async create(actor: Actor, input: CreateCollectionPointInput) {
    ensureOperator(actor);
    const point = await this.repository.create({
      name: input.nome.trim(),
      kind: toKind(input.tipo),
      latitude: input.latitude,
      longitude: input.longitude,
      circuit: input.circuito,
      description: input.descricao?.trim() || null,
      active: input.ativo ?? true,
      createdByUserId: actor.id,
    });
    return serializeCollectionPoint(point);
  }

  async list(actor: Actor, query: ListCollectionPointsQuery) {
    ensureOperator(actor);
    const points = await this.repository.list({
      kind: query.tipo ? toKind(query.tipo) : undefined,
      circuit: query.circuito === undefined ? undefined : Number(query.circuito),
      active: query.ativo === undefined ? undefined : query.ativo === 'true',
    });
    return { dados: points.map(serializeCollectionPoint), total: points.length };
  }

  async detail(actor: Actor, id: string) {
    ensureOperator(actor);
    const point = await this.repository.findById(id);
    if (!point) throw notFound();
    return serializeCollectionPoint(point);
  }

  async update(actor: Actor, id: string, input: UpdateCollectionPointInput) {
    ensureOperator(actor);
    const point = await this.repository.update(id, {
      ...(input.nome === undefined ? {} : { name: input.nome.trim() }),
      ...(input.tipo === undefined ? {} : { kind: toKind(input.tipo) }),
      ...(input.latitude === undefined ? {} : { latitude: input.latitude }),
      ...(input.longitude === undefined ? {} : { longitude: input.longitude }),
      ...(input.circuito === undefined ? {} : { circuit: input.circuito }),
      ...(input.descricao === undefined ? {} : { description: input.descricao?.trim() || null }),
      ...(input.ativo === undefined ? {} : { active: input.ativo }),
    });
    if (!point) throw notFound();
    return serializeCollectionPoint(point);
  }

  async remove(actor: Actor, id: string): Promise<void> {
    ensureOperator(actor);
    if (!(await this.repository.archive(id))) throw notFound();
  }
}

import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import type { Actor } from '../../auth/actor.js';
import type { RequestStatus } from '../../generated/prisma/enums.js';
import type { CreateCollectionRequestInput } from './request.schemas.js';
import { API_TO_MATERIAL } from './request.schemas.js';

export const requestInclude = {
  address: true,
  materials: true,
  statusHistory: { orderBy: { occurredAt: 'asc' as const } },
  collectorProfile: { include: { user: { select: { id: true, name: true } } } },
  pointsLogs: true,
} as const;

export type RequestDetails = Prisma.CollectionRequestGetPayload<{ include: typeof requestInclude }>;

export interface RequestListFilters {
  status?: RequestStatus;
  start?: Date;
  end?: Date;
  page: number;
  limit: number;
}

export interface RequestListResult {
  items: RequestDetails[];
  total: number;
}

export interface RequestRepository {
  create(residentId: string, input: CreateCollectionRequestInput): Promise<RequestDetails>;
  list(actor: Actor, filters: RequestListFilters): Promise<RequestListResult>;
  findById(id: string): Promise<RequestDetails | null>;
  cancel(id: string, actorId: string, reason: string): Promise<RequestDetails>;
  assign(id: string, actorId: string, collectorUserId: string): Promise<RequestDetails>;
  start(id: string, collectorUserId: string): Promise<RequestDetails>;
  complete(id: string, collectorUserId: string, photoUrl: string): Promise<RequestDetails>;
  markSynchronized(id: string, external: { requestId: string; pointId: string; collectorId: string | null }): Promise<RequestDetails>;
  markSyncError(id: string): Promise<RequestDetails>;
}

export class PrismaRequestRepository implements RequestRepository {
  constructor(private readonly database: PrismaClient) {}

  async create(residentId: string, input: CreateCollectionRequestInput): Promise<RequestDetails> {
    const desiredAt = new Date(input.dataDesejada);
    const dayStart = new Date(desiredAt);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    return this.database.$transaction(async (transaction) => {
      const address = await transaction.address.findFirst({
        where: { id: input.enderecoId, userId: residentId },
        select: { id: true },
      });
      if (!address) return Promise.reject(new RepositoryRuleError('ENDERECO_NAO_ENCONTRADO'));

      // Serializa criações para o mesmo endereço/dia, evitando que duas
      // requisições concorrentes ultrapassem juntas a verificação da RN06.
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${input.enderecoId}:${dayStart.toISOString()}`}))`;

      const duplicate = await transaction.collectionRequest.findFirst({
        where: {
          addressId: input.enderecoId,
          desiredAt: { gte: dayStart, lt: dayEnd },
          status: { in: ['SCHEDULED', 'PENDING', 'ASSIGNED', 'IN_SERVICE'] },
        },
        select: { id: true },
      });
      if (duplicate) return Promise.reject(new RepositoryRuleError('SOLICITACAO_DUPLICADA'));

      return transaction.collectionRequest.create({
        data: {
          residentId,
          addressId: input.enderecoId,
          externalPointId: input.pontoColetaExternoId,
          desiredAt,
          externalReference: `pedido-${randomUUID()}`,
          status: 'PENDING',
          syncStatus: 'PENDING',
          materials: {
            create: input.materiais.map((material) => ({
              materialType: API_TO_MATERIAL[material.tipo],
              estimatedQuantity: material.quantidadeEstimada,
              unit: material.unidade?.trim() || null,
            })),
          },
          statusHistory: {
            create: {
              changedByUserId: residentId,
              source: 'LOCAL',
              toStatus: 'PENDING',
              occurredAt: new Date(),
              reason: 'Solicitação criada pelo morador.',
            },
          },
        },
        include: requestInclude,
      });
    });
  }

  async list(actor: Actor, filters: RequestListFilters): Promise<RequestListResult> {
    const where: Prisma.CollectionRequestWhereInput = {};
    if (actor.role === 'MORADOR') where.residentId = actor.id;
    if (actor.role === 'COLETOR') where.collectorProfile = { userId: actor.id };
    if (filters.status) where.status = filters.status;
    if (filters.start || filters.end) {
      where.desiredAt = { gte: filters.start, lte: filters.end };
    }

    const [items, total] = await this.database.$transaction([
      this.database.collectionRequest.findMany({
        where,
        include: requestInclude,
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      this.database.collectionRequest.count({ where }),
    ]);
    return { items, total };
  }

  findById(id: string): Promise<RequestDetails | null> {
    return this.database.collectionRequest.findUnique({ where: { id }, include: requestInclude });
  }

  async markSynchronized(
    id: string,
    external: { requestId: string; pointId: string; collectorId: string | null },
  ): Promise<RequestDetails> {
    return this.database.collectionRequest.update({
      where: { id },
      data: {
        ecoRotaRequestId: external.requestId,
        externalPointId: external.pointId,
        externalCollectorId: external.collectorId,
        syncStatus: 'SYNCED',
      },
      include: requestInclude,
    });
  }

  async markSyncError(id: string): Promise<RequestDetails> {
    return this.database.collectionRequest.update({
      where: { id },
      data: { syncStatus: 'ERROR' },
      include: requestInclude,
    });
  }

  async cancel(id: string, actorId: string, reason: string): Promise<RequestDetails> {
    return this.database.$transaction(async (transaction) => {
      const current = await transaction.collectionRequest.findUniqueOrThrow({ where: { id } });
      if (!['SCHEDULED', 'PENDING', 'ASSIGNED', 'IN_SERVICE'].includes(current.status)) {
        throw new RepositoryRuleError('TRANSICAO_INVALIDA');
      }
      await transaction.collectionRequest.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancellationReason: reason,
          statusHistory: {
            create: {
              changedByUserId: actorId,
              source: 'LOCAL',
              fromStatus: current.status,
              toStatus: 'CANCELLED',
              reason,
              occurredAt: new Date(),
            },
          },
        },
      });
      return transaction.collectionRequest.findUniqueOrThrow({ where: { id }, include: requestInclude });
    });
  }

  async assign(id: string, actorId: string, collectorUserId: string): Promise<RequestDetails> {
    return this.database.$transaction(async (transaction) => {
      const current = await transaction.collectionRequest.findUniqueOrThrow({ where: { id } });
      if (!['SCHEDULED', 'PENDING'].includes(current.status)) {
        throw new RepositoryRuleError('TRANSICAO_INVALIDA');
      }
      const collector = await transaction.collectorProfile.findFirst({
        where: { userId: collectorUserId, available: true },
      });
      if (!collector) return Promise.reject(new RepositoryRuleError('COLETOR_INDISPONIVEL'));

      await transaction.collectionRequest.update({
        where: { id },
        data: {
          collectorProfileId: collector.id,
          status: 'ASSIGNED',
          statusHistory: {
            create: {
              changedByUserId: actorId,
              source: 'LOCAL',
              fromStatus: current.status,
              toStatus: 'ASSIGNED',
              reason: 'Coletor associado pela operação de desenvolvimento.',
              occurredAt: new Date(),
            },
          },
        },
      });
      return transaction.collectionRequest.findUniqueOrThrow({ where: { id }, include: requestInclude });
    });
  }

  async start(id: string, collectorUserId: string): Promise<RequestDetails> {
    return this.transition(id, collectorUserId, 'ASSIGNED', 'IN_SERVICE', 'Atendimento iniciado pelo coletor.');
  }

  async complete(id: string, collectorUserId: string, photoUrl: string): Promise<RequestDetails> {
    return this.database.$transaction(async (transaction) => {
      const current = await transaction.collectionRequest.findUniqueOrThrow({
        where: { id },
        include: { collectorProfile: true },
      });

      if (current.status !== 'COMPLETED') {
        if (current.status !== 'IN_SERVICE') throw new RepositoryRuleError('TRANSICAO_INVALIDA');
        await transaction.collectionRequest.update({
          where: { id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            completionPhotoUrl: photoUrl,
            statusHistory: {
              create: {
                changedByUserId: collectorUserId,
                source: 'LOCAL',
                fromStatus: 'IN_SERVICE',
                toStatus: 'COMPLETED',
                reason: 'Coleta concluída pelo coletor.',
                occurredAt: new Date(),
              },
            },
          },
        });
      }

      const recipientIds = [current.residentId, collectorUserId];
      await transaction.pointsLog.createMany({
        data: recipientIds.map((userId) => ({
          userId,
          requestId: id,
          points: 100,
          reason: 'Coleta concluída',
        })),
        skipDuplicates: true,
      });

      return transaction.collectionRequest.findUniqueOrThrow({ where: { id }, include: requestInclude });
    });
  }

  private async transition(
    id: string,
    actorId: string,
    expected: 'ASSIGNED',
    target: 'IN_SERVICE',
    reason: string,
  ): Promise<RequestDetails> {
    return this.database.$transaction(async (transaction) => {
      const current = await transaction.collectionRequest.findUniqueOrThrow({ where: { id } });
      if (current.status !== expected) throw new RepositoryRuleError('TRANSICAO_INVALIDA');
      await transaction.collectionRequest.update({
        where: { id },
        data: {
          status: target,
          statusHistory: {
            create: {
              changedByUserId: actorId,
              source: 'LOCAL',
              fromStatus: expected,
              toStatus: target,
              reason,
              occurredAt: new Date(),
            },
          },
        },
      });
      return transaction.collectionRequest.findUniqueOrThrow({ where: { id }, include: requestInclude });
    });
  }
}

export class RepositoryRuleError extends Error {
  constructor(readonly rule: 'ENDERECO_NAO_ENCONTRADO' | 'SOLICITACAO_DUPLICADA' | 'COLETOR_INDISPONIVEL' | 'TRANSICAO_INVALIDA') {
    super(rule);
  }
}

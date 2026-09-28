/**
 * Camada transacional das solicitações de coleta.
 * Persiste materiais e histórico, evita duplicidade concorrente, controla transições e concede pontos uma única vez.
 */
import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import type { Actor } from '../../auth/actor.js';
import type { RequestStatus } from '../../generated/prisma/enums.js';
import type { CreateCollectionRequestInput } from './request.schemas.js';
import { API_TO_MATERIAL } from './request.schemas.js';

// Centraliza todas as relações necessárias para devolver uma solicitação completa.
export const requestInclude = {
  address: true,
  collectionPoint: true,
  materials: true,
  statusHistory: { orderBy: { occurredAt: 'asc' as const } },
  collectorProfile: { include: { user: { select: { id: true, name: true } } } },
  pointsLogs: true,
} as const;

// Deriva o tipo completo diretamente da seleção Prisma para evitar divergência manual.
export type RequestDetails = Prisma.CollectionRequestGetPayload<{ include: typeof requestInclude }>;

// Representa filtros já convertidos para tipos internos antes de chegar ao repositório.
export interface RequestListFilters {
  status?: RequestStatus;
  start?: Date;
  end?: Date;
  page: number;
  limit: number;
}

// Combina os itens da página com a contagem usada pelo frontend na paginação.
export interface RequestListResult {
  items: RequestDetails[];
  total: number;
}

// Define todas as operações persistentes do ciclo de vida da solicitação.
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

// Implementa transições com transações para manter solicitação, histórico e pontos consistentes.
export class PrismaRequestRepository implements RequestRepository {
  // Recebe a conexão compartilhada usada em todas as transações.
  constructor(private readonly database: PrismaClient) {}

  // Cria agregado e histórico inicial após verificar endereço e duplicidade com lock transacional.
  async create(residentId: string, input: CreateCollectionRequestInput): Promise<RequestDetails> {
    const desiredAt = new Date(input.dataDesejada);
    const dayStart = new Date(desiredAt);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    return this.database.$transaction(async (transaction) => {
      if (input.enderecoId) {
        const address = await transaction.address.findFirst({
          where: { id: input.enderecoId, userId: residentId }, select: { id: true },
        });
        if (!address) throw new RepositoryRuleError('ENDERECO_NAO_ENCONTRADO');
      }
      if (input.pontoColetaId) {
        const point = await transaction.collectionPoint.findFirst({
          where: { id: input.pontoColetaId, active: true, deletedAt: null }, select: { id: true },
        });
        if (!point) throw new RepositoryRuleError('PONTO_COLETA_NAO_ENCONTRADO');
      }

      // Serializa criações para o mesmo endereço/dia, evitando que duas
      // requisições concorrentes ultrapassem juntas a verificação da RN06.
      const locationKey = input.pontoColetaId ?? input.enderecoId;
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${residentId}:${locationKey}:${dayStart.toISOString()}`}))`;

      const duplicate = await transaction.collectionRequest.findFirst({
        where: {
          residentId,
          ...(input.pontoColetaId ? { collectionPointId: input.pontoColetaId } : { addressId: input.enderecoId }),
          desiredAt: { gte: dayStart, lt: dayEnd },
          status: { in: ['SCHEDULED', 'PENDING', 'ASSIGNED', 'IN_SERVICE'] },
        },
        select: { id: true },
      });
      // Rejeita segunda solicitação ativa para o mesmo endereço e dia.
      if (duplicate) return Promise.reject(new RepositoryRuleError('SOLICITACAO_DUPLICADA'));

      return transaction.collectionRequest.create({
        data: {
          residentId,
          addressId: input.enderecoId ?? null,
          collectionPointId: input.pontoColetaId ?? null,
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

  // Monta o where conforme papel/filtros e consulta itens/total na mesma transação.
  async list(actor: Actor, filters: RequestListFilters): Promise<RequestListResult> {
    const where: Prisma.CollectionRequestWhereInput = {};
    // Restringe morador às próprias solicitações.
    if (actor.role === 'MORADOR') where.residentId = actor.id;
    // Restringe coletor às solicitações atribuídas ao seu perfil.
    if (actor.role === 'COLETOR') where.collectorProfile = { userId: actor.id };
    // Acrescenta status apenas quando o filtro foi fornecido.
    if (filters.status) where.status = filters.status;
    // Acrescenta intervalo de data quando ao menos um limite existe.
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

  // Carrega por UUID com todas as relações padronizadas em requestInclude.
  findById(id: string): Promise<RequestDetails | null> {
    return this.database.collectionRequest.findUnique({ where: { id }, include: requestInclude });
  }

  // Persiste IDs externos e marca sucesso depois da criação na EcoRota.
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

  // Registra que a tentativa externa falhou sem apagar a solicitação local.
  async markSyncError(id: string): Promise<RequestDetails> {
    return this.database.collectionRequest.update({
      where: { id },
      data: { syncStatus: 'ERROR' },
      include: requestInclude,
    });
  }

  // Valida estado atual e grava cancelamento e histórico atomicamente.
  async cancel(id: string, actorId: string, reason: string): Promise<RequestDetails> {
    return this.database.$transaction(async (transaction) => {
      const current = await transaction.collectionRequest.findUniqueOrThrow({ where: { id } });
      // Protege estados finais contra cancelamento posterior.
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

  // Confirma disponibilidade do coletor antes de vinculá-lo e registrar a atribuição.
  async assign(id: string, actorId: string, collectorUserId: string): Promise<RequestDetails> {
    return this.database.$transaction(async (transaction) => {
      const current = await transaction.collectionRequest.findUniqueOrThrow({ where: { id } });
      // Atribuição só é válida antes do início do atendimento.
      if (!['SCHEDULED', 'PENDING'].includes(current.status)) {
        throw new RepositoryRuleError('TRANSICAO_INVALIDA');
      }
      const collector = await transaction.collectorProfile.findFirst({
        where: { userId: collectorUserId, available: true },
      });
      // Exige perfil existente e disponibilidade verdadeira no mesmo momento da transação.
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

  // Reutiliza a transição comum para iniciar uma solicitação atribuída.
  async start(id: string, collectorUserId: string): Promise<RequestDetails> {
    return this.transition(id, collectorUserId, 'ASSIGNED', 'IN_SERVICE', 'Atendimento iniciado pelo coletor.');
  }

  // Conclui, grava evidência/histórico e concede pontos únicos ao morador e coletor.
  async complete(id: string, collectorUserId: string, photoUrl: string): Promise<RequestDetails> {
    return this.database.$transaction(async (transaction) => {
      const current = await transaction.collectionRequest.findUniqueOrThrow({
        where: { id },
        include: { collectorProfile: true },
      });

      // Permite repetir conclusão apenas para recuperar a resposta/pontos sem duplicar transição.
      if (current.status !== 'COMPLETED') {
        // Primeira conclusão exige que o atendimento esteja em andamento.
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

  // Centraliza a transição simples que exige um estado de origem exato.
  private async transition(
    id: string,
    actorId: string,
    expected: 'ASSIGNED',
    target: 'IN_SERVICE',
    reason: string,
  ): Promise<RequestDetails> {
    return this.database.$transaction(async (transaction) => {
      const current = await transaction.collectionRequest.findUniqueOrThrow({ where: { id } });
      // Compara o estado lido dentro da transação para impedir corrida entre ações.
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

// Comunica violações detectadas na camada transacional sem acoplar o repositório a códigos HTTP.
export class RepositoryRuleError extends Error {
  // Armazena a regra violada para o serviço traduzi-la em código HTTP apropriado.
  constructor(readonly rule: 'ENDERECO_NAO_ENCONTRADO' | 'PONTO_COLETA_NAO_ENCONTRADO' | 'SOLICITACAO_DUPLICADA' | 'COLETOR_INDISPONIVEL' | 'TRANSICAO_INVALIDA') {
    super(rule);
  }
}

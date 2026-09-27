/**
 * Sincroniza uma solicitação externa com CollectionRequest dentro de transação Prisma.
 * Deduplica eventos, traduz status, atualiza vínculo do coletor, grava histórico e concede pontos na conclusão.
 */
import type { PrismaClient } from '../../generated/prisma/client.js';
import type { RequestStatus } from '../../generated/prisma/enums.js';
import type { EcoRotaRequest } from '../ecorotaClient.js';

// Traduz cada estado externo para o enum persistido no domínio local.
const EXTERNAL_TO_INTERNAL_STATUS: Record<EcoRotaRequest['status'], RequestStatus> = {
  pending: 'PENDING',
  assigned: 'ASSIGNED',
  in_service: 'IN_SERVICE',
  completed: 'COMPLETED',
  cancelled: 'CANCELLED',
};

// Carrega identidade e ordenação do evento gravadas junto ao histórico.
export interface ExternalEventMetadata {
  eventId: string;
  generation: number;
  revision: number;
  occurredAt: Date;
  recordUnchanged?: boolean;
}

// Informa ao sincronizador o efeito exato da tentativa no banco.
export type RequestSynchronizationResult = 'not_found' | 'duplicate' | 'updated' | 'unchanged';

// Define a operação idempotente de reconciliação de uma solicitação externa.
export interface EcoRotaRequestSyncRepository {
  synchronizeRequest(request: EcoRotaRequest, metadata: ExternalEventMetadata): Promise<RequestSynchronizationResult>;
}

// Implementa toda reconciliação em uma transação para evitar estado parcial.
export class PrismaEcoRotaRequestSyncRepository implements EcoRotaRequestSyncRepository {
  // Recebe o Prisma usado para abrir a transação de cada evento.
  constructor(private readonly database: PrismaClient) {}

  // Deduplica pelo ID externo, localiza a referência e aplica todas as mudanças atomicamente.
  async synchronizeRequest(
    external: EcoRotaRequest,
    metadata: ExternalEventMetadata,
  ): Promise<RequestSynchronizationResult> {
    return this.database.$transaction(async (transaction) => {
      const processed = await transaction.requestStatusHistory.findUnique({
        where: { externalEventId: metadata.eventId },
        select: { id: true },
      });
      // ID externo já registrado prova que esta mensagem foi processada anteriormente.
      if (processed) return 'duplicate';

      const current = await transaction.collectionRequest.findFirst({
        where: {
          OR: [
            { ecoRotaRequestId: external.id },
            { externalReference: external.externalReference },
          ],
        },
        include: { collectorProfile: true },
      });
      // Evento sem referência local não cria solicitação órfã automaticamente.
      if (!current) return 'not_found';

      const targetStatus = EXTERNAL_TO_INTERNAL_STATUS[external.status];
      const matchedCollector = external.collectorId
        ? await transaction.collectorProfile.findUnique({
            where: { ecoRotaCollectorId: external.collectorId },
          })
        : null;
      const collectorProfileId = matchedCollector?.id ?? current.collectorProfileId;
      const statusChanged = current.status !== targetStatus;

      await transaction.collectionRequest.update({
        where: { id: current.id },
        data: {
          ecoRotaRequestId: external.id,
          externalPointId: external.pointId,
          externalCollectorId: external.collectorId,
          collectorProfileId,
          status: targetStatus,
          syncStatus: 'SYNCED',
          ...(targetStatus === 'COMPLETED' && !current.completedAt
            ? { completedAt: metadata.occurredAt }
            : {}),
          ...(statusChanged || metadata.recordUnchanged
            ? {
                statusHistory: {
                  create: {
                    source: 'ECOROTA',
                    fromStatus: current.status,
                    toStatus: targetStatus,
                    reason: 'Status sincronizado por evento da EcoRota.',
                    externalEventId: metadata.eventId,
                    generation: metadata.generation,
                    revision: metadata.revision,
                    occurredAt: metadata.occurredAt,
                  },
                },
              }
            : {}),
        },
      });

      // Conclusão concede créditos idempotentes aos participantes conhecidos.
      if (targetStatus === 'COMPLETED') {
        const collectorUserId = matchedCollector?.userId ?? current.collectorProfile?.userId;
        const recipients = collectorUserId
          ? [current.residentId, collectorUserId]
          : [current.residentId];
        await transaction.pointsLog.createMany({
          data: recipients.map((userId) => ({
            userId,
            requestId: current.id,
            points: 100,
            reason: 'Coleta concluída pela EcoRota',
          })),
          skipDuplicates: true,
        });
      }

      return statusChanged ? 'updated' : 'unchanged';
    });
  }
}

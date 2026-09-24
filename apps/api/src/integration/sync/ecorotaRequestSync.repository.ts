import type { PrismaClient } from '../../generated/prisma/client.js';
import type { RequestStatus } from '../../generated/prisma/enums.js';
import type { EcoRotaRequest } from '../ecorotaClient.js';

const EXTERNAL_TO_INTERNAL_STATUS: Record<EcoRotaRequest['status'], RequestStatus> = {
  pending: 'PENDING',
  assigned: 'ASSIGNED',
  in_service: 'IN_SERVICE',
  completed: 'COMPLETED',
  cancelled: 'CANCELLED',
};

export interface ExternalEventMetadata {
  eventId: string;
  generation: number;
  revision: number;
  occurredAt: Date;
  recordUnchanged?: boolean;
}

export type RequestSynchronizationResult = 'not_found' | 'duplicate' | 'updated' | 'unchanged';

export interface EcoRotaRequestSyncRepository {
  synchronizeRequest(request: EcoRotaRequest, metadata: ExternalEventMetadata): Promise<RequestSynchronizationResult>;
}

export class PrismaEcoRotaRequestSyncRepository implements EcoRotaRequestSyncRepository {
  constructor(private readonly database: PrismaClient) {}

  async synchronizeRequest(
    external: EcoRotaRequest,
    metadata: ExternalEventMetadata,
  ): Promise<RequestSynchronizationResult> {
    return this.database.$transaction(async (transaction) => {
      const processed = await transaction.requestStatusHistory.findUnique({
        where: { externalEventId: metadata.eventId },
        select: { id: true },
      });
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

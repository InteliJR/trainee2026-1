import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import type { SyncStatus } from '../../generated/prisma/enums.js';

const collectorProfileInclude = { user: { select: { id: true, name: true, email: true } } } as const;
export type CollectorProfileDetails = Prisma.CollectorProfileGetPayload<{
  include: typeof collectorProfileInclude;
}>;

export interface CollectorRepository {
  findByUserId(userId: string): Promise<CollectorProfileDetails | null>;
  updateAvailability(
    profileId: string,
    data: { available: boolean; shift: string | null; syncStatus: SyncStatus },
  ): Promise<CollectorProfileDetails>;
  updateSyncStatus(profileId: string, syncStatus: SyncStatus, available?: boolean): Promise<CollectorProfileDetails>;
}

export class PrismaCollectorRepository implements CollectorRepository {
  constructor(private readonly database: PrismaClient) {}

  findByUserId(userId: string): Promise<CollectorProfileDetails | null> {
    return this.database.collectorProfile.findUnique({
      where: { userId },
      include: collectorProfileInclude,
    });
  }

  updateAvailability(
    profileId: string,
    data: { available: boolean; shift: string | null; syncStatus: SyncStatus },
  ): Promise<CollectorProfileDetails> {
    return this.database.collectorProfile.update({
      where: { id: profileId },
      data: {
        available: data.available,
        availabilityShift: data.shift,
        syncStatus: data.syncStatus,
      },
      include: collectorProfileInclude,
    });
  }

  updateSyncStatus(
    profileId: string,
    syncStatus: SyncStatus,
    available?: boolean,
  ): Promise<CollectorProfileDetails> {
    return this.database.collectorProfile.update({
      where: { id: profileId },
      data: { syncStatus, ...(available === undefined ? {} : { available }) },
      include: collectorProfileInclude,
    });
  }
}


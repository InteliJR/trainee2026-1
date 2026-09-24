import type { PrismaClient } from '../generated/prisma/client.js';
import type { UserRole } from '../generated/prisma/enums.js';

export interface RealtimeActor {
  id: string;
  role: UserRole;
  ecoRotaCollectorId: string | null;
}

export interface RequestRecipients {
  residentUserId: string;
  collectorUserId: string | null;
}

export interface RealtimeAccessRepository {
  findActor(userId: string): Promise<RealtimeActor | null>;
  listAllowedExternalReferences(actor: RealtimeActor): Promise<string[]>;
  findRequestRecipients(externalReference: string): Promise<RequestRecipients | null>;
  findCollectorUserId(externalCollectorId: string): Promise<string | null>;
  listResidentUserIds(externalCollectorId: string): Promise<string[]>;
}

export class PrismaRealtimeAccessRepository implements RealtimeAccessRepository {
  constructor(private readonly database: PrismaClient) {}

  async findActor(userId: string): Promise<RealtimeActor | null> {
    const user = await this.database.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        collectorProfile: { select: { ecoRotaCollectorId: true } },
      },
    });
    if (!user) return null;
    return {
      id: user.id,
      role: user.role,
      ecoRotaCollectorId: user.collectorProfile?.ecoRotaCollectorId ?? null,
    };
  }

  async listAllowedExternalReferences(actor: RealtimeActor): Promise<string[]> {
    if (actor.role === 'OPERADOR') return [];
    const requests = await this.database.collectionRequest.findMany({
      where: actor.role === 'MORADOR'
        ? { residentId: actor.id }
        : { collectorProfile: { userId: actor.id } },
      select: { externalReference: true },
    });
    return requests.map((request) => request.externalReference);
  }

  async findRequestRecipients(externalReference: string): Promise<RequestRecipients | null> {
    const request = await this.database.collectionRequest.findUnique({
      where: { externalReference },
      select: {
        residentId: true,
        collectorProfile: { select: { userId: true } },
      },
    });
    if (!request) return null;
    return {
      residentUserId: request.residentId,
      collectorUserId: request.collectorProfile?.userId ?? null,
    };
  }

  async findCollectorUserId(externalCollectorId: string): Promise<string | null> {
    const collector = await this.database.collectorProfile.findUnique({
      where: { ecoRotaCollectorId: externalCollectorId },
      select: { userId: true },
    });
    return collector?.userId ?? null;
  }

  async listResidentUserIds(externalCollectorId: string): Promise<string[]> {
    const requests = await this.database.collectionRequest.findMany({
      where: {
        externalCollectorId,
        status: { in: ['ASSIGNED', 'IN_SERVICE'] },
      },
      select: { residentId: true },
      distinct: ['residentId'],
    });
    return requests.map((request) => request.residentId);
  }
}

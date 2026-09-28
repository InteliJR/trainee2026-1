import type { PrismaClient } from '../../generated/prisma/client.js';
import type { UserRole } from '../../generated/prisma/enums.js';

export interface ListedProfile {
  id: string;
  name: string;
  role: Extract<UserRole, 'MORADOR' | 'COLETOR'>;
  createdAt: Date;
  completedCollections: number;
  available: boolean | null;
  shift: string | null;
}

export interface ProfileRepository {
  list(role: ListedProfile['role'], page: number, limit: number): Promise<{ profiles: ListedProfile[]; total: number }>;
  get(userId: string): Promise<ListedProfile | null>;
}

export class PrismaProfileRepository implements ProfileRepository {
  constructor(private readonly database: PrismaClient) {}

  async get(userId: string): Promise<ListedProfile | null> {
    const user = await this.database.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, role: true, createdAt: true, collectorProfile: { select: { id: true, available: true, availabilityShift: true } } },
    });
    if (!user || (user.role !== 'MORADOR' && user.role !== 'COLETOR')) return null;
    const completedCollections = await this.database.collectionRequest.count({
      where: user.role === 'MORADOR'
        ? { residentId: user.id, status: 'COMPLETED' }
        : { collectorProfileId: user.collectorProfile?.id ?? '', status: 'COMPLETED' },
    });
    return {
      id: user.id, name: user.name, role: user.role, createdAt: user.createdAt, completedCollections,
      available: user.collectorProfile?.available ?? null,
      shift: user.collectorProfile?.availabilityShift ?? null,
    };
  }

  async list(role: ListedProfile['role'], page: number, limit: number) {
    const where = { role };
    const [users, total] = await this.database.$transaction([
      this.database.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          role: true,
          createdAt: true,
          collectorProfile: { select: { id: true, available: true, availabilityShift: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.database.user.count({ where }),
    ]);

    const ids = users.map((user) => user.id);
    const profileIds = users.flatMap((user) => user.collectorProfile ? [user.collectorProfile.id] : []);
    const counts = role === 'MORADOR'
      ? await this.database.collectionRequest.groupBy({
          by: ['residentId'],
          where: { status: 'COMPLETED', residentId: { in: ids } },
          _count: { _all: true },
        })
      : await this.database.collectionRequest.groupBy({
          by: ['collectorProfileId'],
          where: { status: 'COMPLETED', collectorProfileId: { in: profileIds } },
          _count: { _all: true },
        });
    const countById = new Map<string, number>();
    if (role === 'MORADOR') {
      for (const row of counts) {
        if ('residentId' in row) countById.set(row.residentId, row._count._all);
      }
    } else {
      for (const row of counts) {
        if ('collectorProfileId' in row && row.collectorProfileId) countById.set(row.collectorProfileId, row._count._all);
      }
    }

    return {
      total,
      profiles: users.map((user) => ({
        id: user.id,
        name: user.name,
        role,
        createdAt: user.createdAt,
        completedCollections: countById.get(role === 'MORADOR' ? user.id : user.collectorProfile?.id ?? '') ?? 0,
        available: user.collectorProfile?.available ?? null,
        shift: user.collectorProfile?.availabilityShift ?? null,
      })),
    };
  }
}

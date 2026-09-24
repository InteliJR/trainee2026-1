import type { PointsLog, PrismaClient } from '../../generated/prisma/client.js';

export interface GamificationRepository {
  listByUser(userId: string): Promise<PointsLog[]>;
}

export class PrismaGamificationRepository implements GamificationRepository {
  constructor(private readonly database: PrismaClient) {}

  listByUser(userId: string): Promise<PointsLog[]> {
    return this.database.pointsLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}


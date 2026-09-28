/** Soma no banco os lançamentos de pontos pertencentes ao usuário consultado. */
import type { PointsLog, PrismaClient } from '../../generated/prisma/client.js';

// Abstrai saldo e extrato para manter Prisma fora da regra de autorização.
export interface GamificationRepository {
  listByUser(userId: string): Promise<PointsLog[]>;
}

// Implementa soma agregada e listagem cronológica dos créditos do usuário.
export class PrismaGamificationRepository implements GamificationRepository {
  // Guarda o Prisma compartilhado pela aplicação.
  constructor(private readonly database: PrismaClient) {}

  // Devolve o extrato mais recente primeiro e nunca mistura usuários.
  listByUser(userId: string): Promise<PointsLog[]> {
    return this.database.pointsLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

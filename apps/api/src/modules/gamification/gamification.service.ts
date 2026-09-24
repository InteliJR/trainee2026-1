import type { Actor } from '../../auth/actor.js';
import { AppError } from '../../errors/appError.js';
import type { GamificationRepository } from './gamification.repository.js';

export class GamificationService {
  constructor(private readonly repository: GamificationRepository) {}

  async list(actor: Actor) {
    if (actor.role === 'OPERADOR') {
      throw new AppError({
        statusCode: 403,
        code: 'PAPEL_NAO_AUTORIZADO',
        message: 'O operador não possui pontuação pessoal neste fluxo.',
      });
    }

    const entries = await this.repository.listByUser(actor.id);
    return {
      saldo: entries.reduce((total, entry) => total + entry.points, 0),
      dados: entries.map((entry) => ({
        id: entry.id,
        solicitacaoId: entry.requestId,
        pontos: entry.points,
        motivo: entry.reason,
        criadoEm: entry.createdAt.toISOString(),
      })),
    };
  }
}


/** Autoriza morador/coletor e oferece saldo e histórico de pontos sem permitir concessão manual. */
import type { Actor } from '../../auth/actor.js';
import { AppError } from '../../errors/appError.js';
import type { GamificationRepository } from './gamification.repository.js';

// Garante que somente morador/coletor consultem o próprio saldo e extrato.
export class GamificationService {
  // Recebe a leitura de pontos sem depender do Prisma diretamente.
  constructor(private readonly repository: GamificationRepository) {}

  // Valida o papel, soma o saldo e traduz cada lançamento para a resposta pública.
  async list(actor: Actor) {
    // Operador não acumula pontuação e deve usar os futuros endpoints do painel.
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

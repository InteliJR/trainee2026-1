/** Expõe consulta de saldo e lançamentos de pontos do próprio usuário identificado. */
import type { FastifyPluginAsync, preHandlerHookHandler } from 'fastify';
import type { GamificationService } from './gamification.service.js';
import { authorizeRoles } from '../../auth/authentication.js';
import { publicPointsRules } from './gamification.rules.js';

// Declara as dependências obrigatórias do plugin de gamificação.
interface GamificationRoutesOptions {
  service: GamificationService;
  identify: preHandlerHookHandler;
}

// Registra endpoints somente de leitura; pontos são concedidos internamente na conclusão.
export const gamificationRoutes: FastifyPluginAsync<GamificationRoutesOptions> = async (app, options) => {
  // Operadores não acumulam pontos; somente participantes entram nesta consulta.
  const participantOnly = [options.identify, authorizeRoles('MORADOR', 'COLETOR')];
  // Devolve saldo e extrato do próprio ator identificado.
  app.get('/pontuacao/lancamentos', { preHandler: participantOnly }, async (request) => {
    return options.service.list(request.actor);
  });

  // Informa quantos pontos cada coleta concluída rende, para a tela não repetir a regra no código.
  app.get('/pontuacao/regras', { preHandler: participantOnly }, async () => publicPointsRules());
};

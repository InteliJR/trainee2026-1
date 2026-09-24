import type { FastifyPluginAsync, preHandlerHookHandler } from 'fastify';
import type { GamificationService } from './gamification.service.js';

interface GamificationRoutesOptions {
  service: GamificationService;
  identify: preHandlerHookHandler;
}

export const gamificationRoutes: FastifyPluginAsync<GamificationRoutesOptions> = async (app, options) => {
  app.get('/pontuacao/lancamentos', { preHandler: options.identify }, async (request) => {
    return options.service.list(request.actor);
  });
};


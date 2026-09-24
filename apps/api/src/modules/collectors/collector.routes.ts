import type { FastifyPluginAsync, preHandlerHookHandler } from 'fastify';
import type { CollectorService } from './collector.service.js';
import {
  updateCollectorAvailabilityBodySchema,
  type ListCollectorRequestsQuery,
  type UpdateCollectorAvailabilityInput,
} from './collector.schemas.js';

interface CollectorRoutesOptions {
  service: CollectorService;
  identify: preHandlerHookHandler;
}

export const collectorRoutes: FastifyPluginAsync<CollectorRoutesOptions> = async (app, options) => {
  app.get<{ Querystring: ListCollectorRequestsQuery }>(
    '/coletor/solicitacoes',
    { preHandler: options.identify },
    async (request) => options.service.listRequests(request.actor, request.query),
  );

  app.get('/coletor/disponibilidade', { preHandler: options.identify }, async (request) => {
    return options.service.getAvailability(request.actor);
  });

  app.patch<{ Body: UpdateCollectorAvailabilityInput }>(
    '/coletor/disponibilidade',
    { preHandler: options.identify, schema: { body: updateCollectorAvailabilityBodySchema } },
    async (request) => options.service.updateAvailability(request.actor, request.body),
  );
};


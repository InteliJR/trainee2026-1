import type { FastifyPluginAsync, preHandlerHookHandler } from 'fastify';
import type { OperationService } from './operation.service.js';
import { geographicQuerySchema, pointParamsSchema, type GeographicQuery } from './operation.schemas.js';

interface OperationRoutesOptions {
  service: OperationService;
  identify: preHandlerHookHandler;
}

export const operationRoutes: FastifyPluginAsync<OperationRoutesOptions> = async (app, options) => {
  app.get<{ Querystring: GeographicQuery }>(
    '/pontos-coleta',
    { preHandler: options.identify, schema: { querystring: geographicQuerySchema } },
    async (request) => options.service.listPoints(request.actor, request.query),
  );

  app.get<{ Params: { pontoId: string } }>(
    '/pontos-coleta/:pontoId',
    { preHandler: options.identify, schema: { params: pointParamsSchema } },
    async (request) => options.service.getPoint(request.actor, request.params.pontoId),
  );

  app.get<{ Querystring: GeographicQuery }>(
    '/coletores/disponiveis',
    { preHandler: options.identify, schema: { querystring: geographicQuerySchema } },
    async (request) => options.service.listAvailableCollectors(request.actor, request.query),
  );

  app.get('/operacao/integracao', { preHandler: options.identify }, async (request) => {
    return options.service.getIntegrationStatus(request.actor);
  });
};

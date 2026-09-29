import type { FastifyPluginAsync, preHandlerHookHandler } from 'fastify';
import { authorizeRoles } from '../../auth/authentication.js';
import type { CollectionPointService } from './collectionPoint.service.js';
import {
  collectionPointParamsSchema,
  createCollectionPointBodySchema,
  listCollectionPointsQuerySchema,
  updateCollectionPointBodySchema,
  type CollectionPointParams,
  type CreateCollectionPointInput,
  type ListCollectionPointsQuery,
  type UpdateCollectionPointInput,
} from './collectionPoint.schemas.js';

interface CollectionPointRoutesOptions {
  service: CollectionPointService;
  identify: preHandlerHookHandler;
}

export const collectionPointRoutes: FastifyPluginAsync<CollectionPointRoutesOptions> = async (app, options) => {
  const operatorOnly = [options.identify, authorizeRoles('OPERADOR')];

  app.get('/pontos-coleta-locais', { preHandler: [options.identify, authorizeRoles('MORADOR', 'COLETOR', 'OPERADOR')] },
    async () => options.service.listActive());

  app.post<{ Body: CreateCollectionPointInput }>(
    '/operacao/pontos-coleta',
    { preHandler: operatorOnly, schema: { body: createCollectionPointBodySchema } },
    async (request, reply) => reply.code(201).send(await options.service.create(request.actor, request.body)),
  );

  app.get<{ Querystring: ListCollectionPointsQuery }>(
    '/operacao/pontos-coleta',
    { preHandler: operatorOnly, schema: { querystring: listCollectionPointsQuerySchema } },
    async (request) => options.service.list(request.actor, request.query),
  );

  app.get<{ Params: CollectionPointParams }>(
    '/operacao/pontos-coleta/:pontoId',
    { preHandler: operatorOnly, schema: { params: collectionPointParamsSchema } },
    async (request) => options.service.detail(request.actor, request.params.pontoId),
  );

  app.patch<{ Params: CollectionPointParams; Body: UpdateCollectionPointInput }>(
    '/operacao/pontos-coleta/:pontoId',
    {
      preHandler: operatorOnly,
      schema: { params: collectionPointParamsSchema, body: updateCollectionPointBodySchema },
    },
    async (request) => options.service.update(request.actor, request.params.pontoId, request.body),
  );

  app.delete<{ Params: CollectionPointParams }>(
    '/operacao/pontos-coleta/:pontoId',
    { preHandler: operatorOnly, schema: { params: collectionPointParamsSchema } },
    async (request, reply) => {
      await options.service.remove(request.actor, request.params.pontoId);
      return reply.code(204).send();
    },
  );
};

import type { FastifyPluginAsync, preHandlerHookHandler } from 'fastify';
import type { RequestService } from './request.service.js';
import {
  assignmentBodySchema,
  cancellationBodySchema,
  conclusionBodySchema,
  createCollectionRequestBodySchema,
  type CreateCollectionRequestInput,
  type ListCollectionRequestsQuery,
} from './request.schemas.js';

interface RequestRoutesOptions {
  service: RequestService;
  identify: preHandlerHookHandler;
}

interface RequestParams { solicitacaoId: string }

const requestParamsSchema = {
  type: 'object',
  required: ['solicitacaoId'],
  properties: { solicitacaoId: { type: 'string', format: 'uuid' } },
} as const;

export const requestRoutes: FastifyPluginAsync<RequestRoutesOptions> = async (app, options) => {
  app.post<{ Body: CreateCollectionRequestInput }>(
    '/solicitacoes-coleta',
    { preHandler: options.identify, schema: { body: createCollectionRequestBodySchema } },
    async (request, reply) => reply.status(201).send(await options.service.create(request.actor, request.body)),
  );

  app.get<{ Querystring: ListCollectionRequestsQuery }>(
    '/solicitacoes-coleta',
    { preHandler: options.identify },
    async (request) => options.service.list(request.actor, request.query),
  );

  app.get<{ Params: RequestParams }>(
    '/solicitacoes-coleta/:solicitacaoId',
    { preHandler: options.identify, schema: { params: requestParamsSchema } },
    async (request) => options.service.detail(request.actor, request.params.solicitacaoId),
  );

  app.get<{ Params: RequestParams }>(
    '/solicitacoes-coleta/:solicitacaoId/historico-status',
    { preHandler: options.identify, schema: { params: requestParamsSchema } },
    async (request) => options.service.history(request.actor, request.params.solicitacaoId),
  );

  app.post<{ Params: RequestParams; Body: { motivo: string; confirmado: true } }>(
    '/solicitacoes-coleta/:solicitacaoId/cancelamento',
    { preHandler: options.identify, schema: { params: requestParamsSchema, body: cancellationBodySchema } },
    async (request) => options.service.cancel(request.actor, request.params.solicitacaoId, request.body.motivo),
  );

  app.post<{ Params: RequestParams; Body: { coletorId: string } }>(
    '/desenvolvimento/solicitacoes-coleta/:solicitacaoId/atribuicao',
    { preHandler: options.identify, schema: { params: requestParamsSchema, body: assignmentBodySchema } },
    async (request) => options.service.assignDevelopment(request.actor, request.params.solicitacaoId, request.body.coletorId),
  );

  app.post<{ Params: RequestParams }>(
    '/solicitacoes-coleta/:solicitacaoId/inicio',
    { preHandler: options.identify, schema: { params: requestParamsSchema } },
    async (request) => options.service.start(request.actor, request.params.solicitacaoId),
  );

  app.post<{ Params: RequestParams; Body: { fotoUrl: string } }>(
    '/solicitacoes-coleta/:solicitacaoId/conclusao',
    { preHandler: options.identify, schema: { params: requestParamsSchema, body: conclusionBodySchema } },
    async (request) => options.service.complete(request.actor, request.params.solicitacaoId, request.body.fotoUrl),
  );
};


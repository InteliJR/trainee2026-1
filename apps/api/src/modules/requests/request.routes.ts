/**
 * Mapeia endpoints de criar, listar, consultar, cancelar, atribuir, iniciar e concluir solicitações.
 * Cada handler lê o ator confirmado e delega validação de negócio ao RequestService.
 */
import type { FastifyPluginAsync, preHandlerHookHandler } from 'fastify';
import type { RequestService } from './request.service.js';
import { authorizeRoles } from '../../auth/authentication.js';
import {
  assignmentBodySchema,
  cancellationBodySchema,
  conclusionBodySchema,
  createCollectionRequestBodySchema,
  type CreateCollectionRequestInput,
  type ListCollectionRequestsQuery,
} from './request.schemas.js';

// Declara middleware e serviço exigidos pelo plugin de solicitações.
interface RequestRoutesOptions {
  service: RequestService;
  identify: preHandlerHookHandler;
}

// Tipifica o parâmetro UUID presente nas rotas de uma solicitação específica.
interface RequestParams { solicitacaoId: string }

// Faz o Fastify rejeitar IDs que não sejam UUID antes de executar o serviço.
const requestParamsSchema = {
  type: 'object',
  required: ['solicitacaoId'],
  properties: { solicitacaoId: { type: 'string', format: 'uuid' } },
} as const;

// Registra todos os endpoints do ciclo de vida e conecta schemas aos handlers correspondentes.
export const requestRoutes: FastifyPluginAsync<RequestRoutesOptions> = async (app, options) => {
  // Reutiliza combinações de autenticação e papel para deixar a permissão visível em cada rota mutável.
  const residentOnly = [options.identify, authorizeRoles('MORADOR')];
  // Operador pode cancelar administrativamente além do morador proprietário.
  const cancellationRoles = [options.identify, authorizeRoles('MORADOR', 'OPERADOR')];
  // A atribuição manual temporária continua restrita ao operador.
  const operatorOnly = [options.identify, authorizeRoles('OPERADOR')];
  // Início e conclusão pertencem exclusivamente ao coletor responsável.
  const collectorOnly = [options.identify, authorizeRoles('COLETOR')];
  // Cria a solicitação validada e responde 201 após persistência/integração inicial.
  app.post<{ Body: CreateCollectionRequestInput }>(
    '/solicitacoes-coleta',
    { preHandler: residentOnly, schema: { body: createCollectionRequestBodySchema } },
    async (request, reply) => reply.status(201).send(await options.service.create(request.actor, request.body)),
  );

  // Lista somente solicitações visíveis ao ator com filtros de query opcionais.
  app.get<{ Querystring: ListCollectionRequestsQuery }>(
    '/solicitacoes-coleta',
    { preHandler: options.identify },
    async (request) => options.service.list(request.actor, request.query),
  );

  // Retorna o detalhe de uma solicitação identificada por UUID.
  app.get<{ Params: RequestParams }>(
    '/solicitacoes-coleta/:solicitacaoId',
    { preHandler: options.identify, schema: { params: requestParamsSchema } },
    async (request) => options.service.detail(request.actor, request.params.solicitacaoId),
  );

  // Retorna apenas a linha do tempo de transições da solicitação autorizada.
  app.get<{ Params: RequestParams }>(
    '/solicitacoes-coleta/:solicitacaoId/historico-status',
    { preHandler: options.identify, schema: { params: requestParamsSchema } },
    async (request) => options.service.history(request.actor, request.params.solicitacaoId),
  );

  // Cancela mediante motivo e confirmação explícita no corpo.
  app.post<{ Params: RequestParams; Body: { motivo: string; confirmado: true } }>(
    '/solicitacoes-coleta/:solicitacaoId/cancelamento',
    { preHandler: cancellationRoles, schema: { params: requestParamsSchema, body: cancellationBodySchema } },
    async (request) => options.service.cancel(request.actor, request.params.solicitacaoId, request.body.motivo),
  );

  // Atribui um coletor cadastrado a uma solicitação feita num ponto da plataforma (painel do operador).
  app.post<{ Params: RequestParams; Body: { coletorId: string } }>(
    '/operacao/solicitacoes-coleta/:solicitacaoId/atribuicao',
    { preHandler: operatorOnly, schema: { params: requestParamsSchema, body: assignmentBodySchema } },
    async (request) => options.service.assign(request.actor, request.params.solicitacaoId, request.body.coletorId),
  );

  // Caminho antigo, mantido para scripts que ainda o chamam.
  app.post<{ Params: RequestParams; Body: { coletorId: string } }>(
    '/desenvolvimento/solicitacoes-coleta/:solicitacaoId/atribuicao',
    { preHandler: operatorOnly, schema: { params: requestParamsSchema, body: assignmentBodySchema } },
    async (request) => options.service.assign(request.actor, request.params.solicitacaoId, request.body.coletorId),
  );

  // Permite ao coletor responsável iniciar o atendimento.
  app.post<{ Params: RequestParams }>(
    '/solicitacoes-coleta/:solicitacaoId/inicio',
    { preHandler: collectorOnly, schema: { params: requestParamsSchema } },
    async (request) => options.service.start(request.actor, request.params.solicitacaoId),
  );

  // Conclui o atendimento exigindo a URL da foto comprobatória.
  app.post<{ Params: RequestParams; Body: { fotoUrl?: string } | undefined }>(
    '/solicitacoes-coleta/:solicitacaoId/conclusao',
    { preHandler: collectorOnly, schema: { params: requestParamsSchema, body: conclusionBodySchema } },
    async (request) => options.service.complete(request.actor, request.params.solicitacaoId, request.body?.fotoUrl ?? null),
  );
};

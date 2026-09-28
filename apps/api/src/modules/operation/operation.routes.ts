/** Expõe consultas de pontos e coletores baseadas no cache operacional atualizado pelo WebSocket externo. */
import type { FastifyPluginAsync, preHandlerHookHandler } from 'fastify';
import type { OperationService } from './operation.service.js';
import { geographicQuerySchema, pointParamsSchema, type GeographicQuery } from './operation.schemas.js';
import { authorizeRoles } from '../../auth/authentication.js';

// Declara o middleware de identidade e o serviço de leitura do cache.
interface OperationRoutesOptions {
  service: OperationService;
  identify: preHandlerHookHandler;
}

// Registra listagem/detalhe de pontos e coletores disponíveis com validação de entrada.
export const operationRoutes: FastifyPluginAsync<OperationRoutesOptions> = async (app, options) => {
  // Painel e telemetria da integração exigem explicitamente o papel administrativo.
  const operatorOnly = [options.identify, authorizeRoles('OPERADOR')];
  // Lista pontos e aplica raio quando latitude/longitude são informadas.
  app.get<{ Querystring: GeographicQuery }>(
    '/pontos-coleta',
    { preHandler: options.identify, schema: { querystring: geographicQuerySchema } },
    async (request) => options.service.listPoints(request.actor, request.query),
  );

  // Retorna um ponto específico do cache pelo UUID externo.
  app.get<{ Params: { pontoId: string } }>(
    '/pontos-coleta/:pontoId',
    { preHandler: options.identify, schema: { params: pointParamsSchema } },
    async (request) => options.service.getPoint(request.actor, request.params.pontoId),
  );

  // Lista coletores disponíveis com filtro geográfico opcional.
  app.get<{ Querystring: GeographicQuery }>(
    '/coletores/disponiveis',
    { preHandler: options.identify, schema: { querystring: geographicQuerySchema } },
    async (request) => options.service.listAvailableCollectors(request.actor, request.query),
  );

  // Expõe geração, revisão, atualização do cache e estado do WSS.
  app.get('/operacao/integracao', { preHandler: operatorOnly }, async (request) => {
    return options.service.getIntegrationStatus(request.actor);
  });

  // Entrega ao operador KPIs históricos do banco combinados com a operação mantida em memória.
  app.get('/operacao/indicadores', { preHandler: operatorOnly }, async (request) => {
    // Aguarda as agregações PostgreSQL antes de serializar o contrato do dashboard.
    return options.service.getIndicators(request.actor);
  });
};

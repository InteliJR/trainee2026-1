/** Registra endpoints do coletor e exige a identidade antes de delegar ao CollectorService. */
import type { FastifyPluginAsync, preHandlerHookHandler } from 'fastify';
import type { CollectorService } from './collector.service.js';
import { authorizeRoles } from '../../auth/authentication.js';
import {
  updateCollectorAvailabilityBodySchema,
  type ListCollectorRequestsQuery,
  type UpdateCollectorAvailabilityInput,
} from './collector.schemas.js';

// Declara identidade e serviço necessários para registrar o módulo.
interface CollectorRoutesOptions {
  service: CollectorService;
  identify: preHandlerHookHandler;
}

// Registra perfil, solicitações atribuídas e disponibilidade sob /coletor.
export const collectorRoutes: FastifyPluginAsync<CollectorRoutesOptions> = async (app, options) => {
  // Exige o papel COLETOR antes que qualquer handler desta área seja executado.
  const collectorOnly = [options.identify, authorizeRoles('COLETOR')];
  // Lista somente solicitações atribuídas ao coletor identificado.
  app.get<{ Querystring: ListCollectorRequestsQuery }>(
    '/coletor/solicitacoes',
    { preHandler: collectorOnly },
    async (request) => options.service.listRequests(request.actor, request.query),
  );

  // Retorna disponibilidade, turno e estado de sincronização atuais.
  app.get('/coletor/disponibilidade', { preHandler: collectorOnly }, async (request) => {
    return options.service.getAvailability(request.actor);
  });

  // Altera disponibilidade/turno e tenta refletir a mudança na EcoRota.
  app.patch<{ Body: UpdateCollectorAvailabilityInput }>(
    '/coletor/disponibilidade',
    { preHandler: collectorOnly, schema: { body: updateCollectorAvailabilityBodySchema } },
    async (request) => options.service.updateAvailability(request.actor, request.body),
  );
};

/** Registra as rotas de criação e listagem de endereços usando identidade, schema e serviço injetados. */
import type { FastifyPluginAsync, preHandlerHookHandler } from 'fastify';
import type { AddressService } from './address.service.js';
import { createAddressBodySchema, type CreateAddressInput } from './address.schemas.js';
import { authorizeRoles } from '../../auth/authentication.js';

// Agrupa middleware e serviço exigidos para registrar as rotas.
interface AddressRoutesOptions {
  service: AddressService;
  identify: preHandlerHookHandler;
}

// Registra POST e GET /enderecos, sempre executando a identificação antes do handler.
export const addressRoutes: FastifyPluginAsync<AddressRoutesOptions> = async (app, options) => {
  // Declara no transporte que toda a área de endereços pertence exclusivamente ao morador.
  const residentOnly = [options.identify, authorizeRoles('MORADOR')];
  // Cria um endereço pertencente ao morador e responde com status 201.
  app.post<{ Body: CreateAddressInput }>(
    '/enderecos',
    { preHandler: residentOnly, schema: { body: createAddressBodySchema } },
    async (request, reply) => {
      const address = await options.service.create(request.actor, request.body);
      return reply.status(201).send(address);
    },
  );

  // Lista endereços do próprio morador em ordem de preferência.
  app.get('/enderecos', { preHandler: residentOnly }, async (request) => {
    return { dados: await options.service.list(request.actor) };
  });
};

import type { FastifyPluginAsync, preHandlerHookHandler } from 'fastify';
import type { AddressService } from './address.service.js';
import { createAddressBodySchema, type CreateAddressInput } from './address.schemas.js';

interface AddressRoutesOptions {
  service: AddressService;
  identify: preHandlerHookHandler;
}

export const addressRoutes: FastifyPluginAsync<AddressRoutesOptions> = async (app, options) => {
  app.post<{ Body: CreateAddressInput }>(
    '/enderecos',
    { preHandler: options.identify, schema: { body: createAddressBodySchema } },
    async (request, reply) => {
      const address = await options.service.create(request.actor, request.body);
      return reply.status(201).send(address);
    },
  );

  app.get('/enderecos', { preHandler: options.identify }, async (request) => {
    return { dados: await options.service.list(request.actor) };
  });
};


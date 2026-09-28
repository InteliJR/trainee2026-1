import type { FastifyPluginAsync, preHandlerHookHandler } from 'fastify';
import { authorizeRoles } from '../../auth/authentication.js';
import type { ProfileService } from './profile.service.js';

interface ProfileRoutesOptions {
  identify: preHandlerHookHandler;
  service: ProfileService;
}

interface ListQuery { papel: 'MORADOR' | 'COLETOR'; pagina?: string }

const querySchema = {
  type: 'object',
  required: ['papel'],
  additionalProperties: false,
  properties: {
    papel: { type: 'string', enum: ['MORADOR', 'COLETOR'] },
    pagina: { type: 'string', pattern: '^[1-9][0-9]*$' },
  },
} as const;

export const profileRoutes: FastifyPluginAsync<ProfileRoutesOptions> = async (app, options) => {
  app.get('/perfis/me', { preHandler: [options.identify, authorizeRoles('MORADOR', 'COLETOR')] },
    async (request) => options.service.own(request.actor));
  app.get<{ Querystring: ListQuery }>(
    '/operacao/perfis',
    { preHandler: [options.identify, authorizeRoles('OPERADOR')], schema: { querystring: querySchema } },
    async (request) => options.service.list(request.actor, request.query),
  );
};

import type { FastifyPluginAsync, preHandlerHookHandler } from 'fastify';
import { authorizeRoles } from '../../auth/authentication.js';
import { AppError } from '../../errors/appError.js';
import type { ProfileService } from './profile.service.js';
import type { CreateProfileData } from './profile.repository.js';

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

const createBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['nome', 'email', 'senha', 'papel'],
  properties: {
    nome: { type: 'string', minLength: 2, maxLength: 120 },
    email: { type: 'string', format: 'email', maxLength: 254 },
    telefone: { type: 'string', minLength: 8, maxLength: 30 },
    senha: { type: 'string', minLength: 8, maxLength: 72 },
    papel: { type: 'string', enum: ['MORADOR', 'COLETOR'] },
  },
} as const;

const updateBodySchema = {
  type: 'object',
  additionalProperties: false,
  minProperties: 1,
  properties: {
    nome: { type: 'string', minLength: 2, maxLength: 120 },
    email: { type: 'string', format: 'email', maxLength: 254 },
    telefone: { anyOf: [{ type: 'string', minLength: 8, maxLength: 30 }, { type: 'null' }] },
  },
} as const;

const paramsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['perfilId'],
  properties: { perfilId: { type: 'string', format: 'uuid' } },
} as const;

interface CreateBody { nome: string; email: string; telefone?: string; senha: string; papel: 'MORADOR' | 'COLETOR' }
interface UpdateBody { nome?: string; email?: string; telefone?: string | null }

export const profileRoutes: FastifyPluginAsync<ProfileRoutesOptions> = async (app, options) => {
  const operatorOnly = [options.identify, authorizeRoles('OPERADOR')];

  app.get('/perfis/me', { preHandler: [options.identify, authorizeRoles('MORADOR', 'COLETOR')] },
    async (request) => options.service.own(request.actor));

  app.get<{ Querystring: ListQuery }>(
    '/operacao/perfis',
    { preHandler: operatorOnly, schema: { querystring: querySchema } },
    async (request) => options.service.list(request.actor, request.query),
  );

  app.post<{ Body: CreateBody }>(
    '/operacao/perfis',
    { preHandler: operatorOnly, schema: { body: createBodySchema } },
    async (request, reply) => {
      const body = request.body;
      try {
        const { hash } = await import('bcryptjs');
        const profile = await options.service.create(request.actor, {
          name: body.nome.trim(), email: body.email.trim().toLowerCase(), phone: body.telefone?.trim() || null,
          passwordHash: await hash(body.senha, 12), role: body.papel,
        });
        return reply.code(201).send(profile);
      } catch (error) {
        if (error instanceof Error && error.name === 'AuthRepositoryConflictError') {
          throw new AppError({ statusCode: 409, code: 'USUARIO_JA_EXISTE', message: 'Já existe um usuário com este e-mail ou telefone.' });
        }
        throw error;
      }
    },
  );

  app.patch<{ Params: { perfilId: string }; Body: UpdateBody }>(
    '/operacao/perfis/:perfilId',
    { preHandler: operatorOnly, schema: { params: paramsSchema, body: updateBodySchema } },
    async (request) => options.service.update(request.actor, request.params.perfilId, {
      ...(request.body.nome !== undefined && { name: request.body.nome.trim() }),
      ...(request.body.email !== undefined && { email: request.body.email.trim().toLowerCase() }),
      ...(request.body.telefone !== undefined && { phone: request.body.telefone?.trim() || null }),
    }),
  );

  app.delete<{ Params: { perfilId: string } }>(
    '/operacao/perfis/:perfilId',
    { preHandler: operatorOnly, schema: { params: paramsSchema } },
    async (request, reply) => {
      await options.service.remove(request.actor, request.params.perfilId);
      return reply.code(204).send();
    },
  );
};

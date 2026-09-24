import type { preHandlerHookHandler } from 'fastify';
import type { NodeEnvironment } from '../config/validateEnv.js';
import { AppError } from '../errors/appError.js';
import type { DevelopmentIdentityRepository } from './developmentIdentity.repository.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createDevelopmentIdentityMiddleware(
  repository: DevelopmentIdentityRepository,
  nodeEnv: NodeEnvironment,
): preHandlerHookHandler {
  return async (request) => {
    if (nodeEnv === 'production') {
      throw new AppError({
        statusCode: 503,
        code: 'AUTENTICACAO_NAO_IMPLEMENTADA',
        message: 'A autenticação real precisa estar habilitada em produção.',
      });
    }

    const header = request.headers['x-usuario-id'];
    const userId = Array.isArray(header) ? header[0] : header;

    if (!userId || !UUID_PATTERN.test(userId)) {
      throw new AppError({
        statusCode: 401,
        code: 'IDENTIDADE_NAO_INFORMADA',
        message: 'Informe um usuário de desenvolvimento válido no cabeçalho x-usuario-id.',
      });
    }

    const actor = await repository.findActorById(userId);
    if (!actor) {
      throw new AppError({
        statusCode: 401,
        code: 'USUARIO_NAO_ENCONTRADO',
        message: 'O usuário de desenvolvimento informado não existe.',
      });
    }

    request.actor = actor;
  };
}


/**
 * Middleware real de autenticação: lê o JWT do cookie, valida sua assinatura e confirma o ator no PostgreSQL.
 * A confirmação no banco impede que usuário removido ou papel alterado continue usando uma claim antiga.
 */
import type { preHandlerHookHandler } from 'fastify';
import { AppError } from '../errors/appError.js';
import type { UserRole } from '../generated/prisma/enums.js';
import type { Actor } from './actor.js';
import { AuthTokenService, SESSION_COOKIE_NAME } from './authToken.js';

// Abstrai a consulta mínima usada pelo guard REST e pelo handshake Socket.IO.
export interface AuthenticatedActorRepository {
  // Localiza a identidade atual sem carregar senha ou dados pessoais.
  findActorById(id: string): Promise<Actor | null>;
}

// Cria o preHandler reutilizado por todas as rotas protegidas.
export function createAuthenticationMiddleware(
  tokenService: AuthTokenService,
  repository: AuthenticatedActorRepository,
): preHandlerHookHandler {
  // Executa a validação completa antes que o handler da rota seja chamado.
  return async (request) => {
    // Lê somente o cookie padronizado pelo módulo de autenticação.
    const token = request.cookies[SESSION_COOKIE_NAME];
    // Ausência de cookie representa uma requisição não autenticada.
    if (!token) {
      throw new AppError({
        statusCode: 401,
        code: 'SESSAO_NAO_AUTENTICADA',
        message: 'Entre na sua conta para acessar este recurso.',
      });
    }

    // Valida assinatura, expiração, emissor, público e payload do JWT.
    const tokenActor = await tokenService.verify(token);
    // Confirma que o usuário ainda existe e recupera o papel vigente no banco.
    const currentActor = await repository.findActorById(tokenActor.id);
    // Trata exclusão ou alteração de papel como sessão inválida e exige novo login.
    if (!currentActor || currentActor.role !== tokenActor.role) {
      throw new AppError({
        statusCode: 401,
        code: 'SESSAO_DESATUALIZADA',
        message: 'A sessão não corresponde mais ao usuário atual. Entre novamente.',
      });
    }

    // Disponibiliza somente a identidade confirmada aos serviços de negócio.
    request.actor = currentActor;
  };
}

// Produz um segundo preHandler para declarar permissões diretamente nas rotas.
export function authorizeRoles(...allowedRoles: UserRole[]): preHandlerHookHandler {
  // Executa depois do middleware de autenticação, quando request.actor já está preenchido.
  return async (request) => {
    // Bloqueia qualquer papel não incluído explicitamente pela rota.
    if (!allowedRoles.includes(request.actor.role)) {
      throw new AppError({
        statusCode: 403,
        code: 'PAPEL_NAO_AUTORIZADO',
        message: 'Seu perfil não possui permissão para executar esta operação.',
      });
    }
  };
}

/**
 * Endpoints públicos e protegidos da sessão JWT em cookie httpOnly.
 * O corpo nunca recebe/devolve tokens; o navegador administra o cookie automaticamente.
 */
import type { FastifyPluginAsync, preHandlerHookHandler } from 'fastify';
import type { NodeEnvironment } from '../../config/validateEnv.js';
import {
  AuthTokenService,
  SESSION_COOKIE_NAME,
  SESSION_ROLE_HEADER,
  createSessionCookieOptions,
  parseSessionRole,
  sessionCookieNameFor,
} from '../../auth/authToken.js';
import { AppError } from '../../errors/appError.js';
import type { AuthService } from './auth.service.js';
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from './auth.schemas.js';

// Reúne serviço, assinatura e guard já preparados pelo bootstrap.
interface AuthRoutesOptions {
  service: AuthService;
  tokenService: AuthTokenService;
  authenticate: preHandlerHookHandler;
  nodeEnv: NodeEnvironment;
}

// Registra cadastro, entrada, saída e consulta da sessão com URLs em português.
export const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (app, options) => {
  // Cria uma conta pública sem iniciar sessão implicitamente.
  app.post<{ Body: RegisterInput }>(
    '/autenticacao/cadastro',
    { schema: { body: registerSchema } },
    async (request, reply) => {
      // Executa normalização, hash e transação de cadastro.
      const user = await options.service.register(request.body);
      // Usa 201 porque uma nova identidade foi persistida.
      return reply.code(201).send({ usuario: user });
    },
  );

  // Valida credenciais e cria o cookie assinado pelo JWT.
  app.post<{ Body: LoginInput }>(
    '/autenticacao/entrar',
    { schema: { body: loginSchema } },
    async (request, reply) => {
      // O serviço devolve ator mínimo separado do usuário público.
      const result = await options.service.login(request.body);
      // A área que chamou (ex.: tela do morador) só aceita contas do seu papel; recusa antes de criar
      // o cookie para não derrubar a sessão desse outro papel aberta em outra aba.
      const requestedRole = parseSessionRole(request.headers[SESSION_ROLE_HEADER]);
      if (requestedRole && requestedRole !== result.actor.role) {
        throw new AppError({
          statusCode: 403,
          code: 'PAPEL_NAO_AUTORIZADO',
          message: 'Esta conta não pertence a esta área do aplicativo.',
        });
      }
      // Emite um token novo somente depois que o bcrypt confirmou a senha.
      const token = await options.tokenService.issue(result.actor);
      // Grava o token no cookie do papel da conta, sem expô-lo ao JavaScript ou ao corpo da resposta.
      reply.setCookie(sessionCookieNameFor(result.actor.role), token, createSessionCookieOptions(options.nodeEnv));
      // Remove o cookie antigo sem papel: clientes sem área o leem primeiro, e ele poderia ser de outra conta.
      reply.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
      // Devolve somente os dados necessários para a interface escolher a área do usuário.
      return { usuario: result.user };
    },
  );

  // Retorna a identidade atual consultada novamente no banco.
  app.get('/autenticacao/sessao', { preHandler: options.authenticate }, async (request) => {
    // O middleware já validou token, usuário e papel antes desta consulta.
    const user = await options.service.getSession(request.actor);
    // Mantém envelope uniforme com cadastro e login.
    return { usuario: user };
  });

  // Encerra a sessão do navegador removendo o cookie atual.
  app.post('/autenticacao/sair', { preHandler: options.authenticate }, async (request, reply) => {
    // Repete path e flags relevantes para remover exatamente o cookie criado no login.
    const cookieOptions = {
      path: '/',
      httpOnly: true,
      secure: options.nodeEnv === 'production',
      sameSite: 'lax' as const,
    };
    // Apaga só o cookie do papel desta sessão; os outros papéis continuam logados no navegador.
    reply.clearCookie(sessionCookieNameFor(request.actor.role), cookieOptions);
    reply.clearCookie(SESSION_COOKIE_NAME, cookieOptions);
    // Responde sem corpo porque não existe recurso adicional a devolver.
    return reply.code(204).send();
  });
};

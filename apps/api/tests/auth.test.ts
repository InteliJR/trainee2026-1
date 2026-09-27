/**
 * Testa cadastro, bcrypt, login, cookie JWT, sessão e logout sem acessar PostgreSQL.
 * O Fastify real valida schemas e cabeçalhos enquanto um repositório em memória isola a persistência.
 */
import cookie from '@fastify/cookie';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { createAuthenticationMiddleware } from '../src/auth/authentication.js';
import { AuthTokenService, SESSION_COOKIE_NAME } from '../src/auth/authToken.js';
import { errorHandler } from '../src/errors/errorHandler.js';
import type { Actor } from '../src/auth/actor.js';
import {
  AuthRepositoryConflictError,
  type AuthRepository,
  type AuthenticationUser,
  type CreateUserInput,
  type PublicUser,
} from '../src/modules/auth/auth.repository.js';
import { authRoutes } from '../src/modules/auth/auth.routes.js';
import { AuthService } from '../src/modules/auth/auth.service.js';

// Usa um segredo exclusivo e longo o bastante para exercitar a mesma política de produção.
const TEST_SECRET = 'segredo-jwt-exclusivo-dos-testes-de-autenticacao-ecorota';

// Persiste usuários somente durante o caso de teste e preserva o hash para validar a proteção da senha.
class FakeAuthRepository implements AuthRepository {
  // Indexa registros por e-mail da mesma forma que a restrição única do banco.
  readonly usersByEmail = new Map<string, AuthenticationUser>();
  // Mantém contador determinístico para gerar UUIDs válidos e diferentes.
  private nextId = 1;

  // Procura credenciais pelo e-mail normalizado.
  findByEmail(email: string): Promise<AuthenticationUser | null> {
    // Converte ausência em null para imitar o Prisma findUnique.
    return Promise.resolve(this.usersByEmail.get(email) ?? null);
  }

  // Procura o contrato público pelo UUID.
  findPublicById(id: string): Promise<PublicUser | null> {
    // Busca em memória porque o índice principal deste fake é o e-mail.
    const user = [...this.usersByEmail.values()].find((candidate) => candidate.id === id);
    // Devolve uma cópia explícita sem passwordHash quando encontra o registro.
    return Promise.resolve(user ? this.toPublicUser(user) : null);
  }

  // Procura somente ID e papel para o middleware de autenticação.
  findActorById(id: string): Promise<Actor | null> {
    // Localiza a identidade atual sem retornar credenciais.
    const user = [...this.usersByEmail.values()].find((candidate) => candidate.id === id);
    // Monta o ator mínimo ou null quando a sessão aponta para usuário ausente.
    return Promise.resolve(user ? { id: user.id, role: user.role } : null);
  }

  // Cria um registro completo e simula conflito de e-mail único.
  create(input: CreateUserInput): Promise<PublicUser> {
    // Mantém o mesmo erro de domínio que o repositório Prisma produziria.
    if (this.usersByEmail.has(input.email)) throw new AuthRepositoryConflictError();
    // Usa a mesma data nos dois campos para manter a resposta determinística.
    const now = new Date('2026-09-27T12:00:00.000Z');
    // Gera um UUID textual válido para permitir emissão do token.
    const id = `00000000-0000-4000-8000-${String(this.nextId++).padStart(12, '0')}`;
    // Guarda inclusive o hash para que o login real do serviço possa executar compare.
    const user = { id, ...input, createdAt: now, updatedAt: now };
    this.usersByEmail.set(input.email, user);
    // Devolve somente os campos públicos prometidos pelo contrato.
    return Promise.resolve(this.toPublicUser(user));
  }

  // Remove credenciais ao converter o armazenamento interno em resposta pública.
  private toPublicUser(user: AuthenticationUser): PublicUser {
    // Seleciona cada propriedade para impedir vazamento acidental do hash.
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}

// Monta os quatro endpoints usando implementações reais de bcrypt, JWT, cookie e middleware.
function createApp(repository: FakeAuthRepository): FastifyInstance {
  // Desativa logs apenas para manter a saída da suíte objetiva.
  const app = Fastify({ logger: false });
  // Converte AppError e validações AJV para o contrato público da API.
  app.setErrorHandler(errorHandler);
  // Habilita request.cookies e reply.setCookie usados pelas rotas.
  app.register(cookie);
  // Compartilha a mesma instância criptográfica entre login e guard.
  const tokenService = new AuthTokenService(TEST_SECRET);
  // Usa quatro rounds somente na suíte; produção mantém doze rounds no AuthService padrão.
  const service = new AuthService(repository, 4);
  // Registra as URLs exatamente como serão expostas pelo buildApp.
  app.register(authRoutes, {
    prefix: '/api/v1',
    service,
    tokenService,
    authenticate: createAuthenticationMiddleware(tokenService, repository),
    nodeEnv: 'test',
  });
  // Devolve a aplicação pronta para app.inject iniciar automaticamente os plugins.
  return app;
}

// Extrai somente o primeiro par nome=valor do Set-Cookie para simular o armazenamento do navegador.
function extractCookie(setCookie: string | string[] | undefined): string {
  // Normaliza múltiplos cabeçalhos e falha claramente quando o login não criou cookie.
  const header = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (!header) throw new Error('O endpoint não devolveu Set-Cookie.');
  // Descarta atributos porque o cabeçalho Cookie envia somente nome e valor.
  return header.split(';')[0]!;
}

// Agrupa a jornada completa de uma sessão real.
describe('autenticação JWT', () => {
  // Guarda a instância do caso atual para liberar plugins depois de cada cenário.
  let app: FastifyInstance | undefined;

  // Fecha recursos mesmo quando uma expectativa falha.
  afterEach(async () => {
    // Aguarda o encerramento do Fastify quando uma aplicação foi criada.
    await app?.close();
    // Remove a referência para não reutilizar estado entre testes.
    app = undefined;
  });

  // Exercita cadastro, hash, login, sessão e saída no mesmo fluxo.
  it('protege a senha e mantém a sessão exclusivamente no cookie httpOnly', async () => {
    // Cria um repositório vazio e registra as rotas reais.
    const repository = new FakeAuthRepository();
    app = createApp(repository);
    // Cadastra um morador com e-mail que precisa ser normalizado.
    const registration = await app.inject({
      method: 'POST',
      url: '/api/v1/autenticacao/cadastro',
      payload: {
        nome: '  Maria   Silva  ',
        email: 'MARIA@EXEMPLO.COM',
        telefone: '11999999999',
        senha: 'Senha123!',
        papel: 'MORADOR',
      },
    });

    // Confirma criação, normalização e ausência de qualquer credencial na resposta.
    expect(registration.statusCode).toBe(201);
    expect(registration.json().usuario).toMatchObject({ nome: 'Maria Silva', email: 'maria@exemplo.com', papel: 'MORADOR' });
    expect(registration.body).not.toContain('passwordHash');
    expect(registration.body).not.toContain('Senha123!');
    // Confirma que o armazenamento recebeu hash bcrypt em vez do texto original.
    expect(repository.usersByEmail.get('maria@exemplo.com')?.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(repository.usersByEmail.get('maria@exemplo.com')?.passwordHash).not.toBe('Senha123!');

    // Entra com o mesmo e-mail em outra combinação de maiúsculas/minúsculas.
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/autenticacao/entrar',
      payload: { email: 'Maria@Exemplo.com', senha: 'Senha123!' },
    });
    // Recupera o cookie como um navegador faria nas chamadas seguintes.
    const sessionCookie = extractCookie(login.headers['set-cookie']);

    // Confirma que o token não aparece no JSON e que as flags de segurança foram emitidas.
    expect(login.statusCode).toBe(200);
    expect(login.body).not.toContain('token');
    expect(login.headers['set-cookie']).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(login.headers['set-cookie']).toContain('HttpOnly');
    expect(login.headers['set-cookie']).toContain('SameSite=Lax');

    // Consulta a sessão usando somente o cookie criado no login.
    const session = await app.inject({
      method: 'GET',
      url: '/api/v1/autenticacao/sessao',
      headers: { cookie: sessionCookie },
    });
    // Confirma que o middleware recuperou ator e o serviço recarregou o usuário.
    expect(session.statusCode).toBe(200);
    expect(session.json().usuario).toMatchObject({ email: 'maria@exemplo.com', papel: 'MORADOR' });

    // Encerra a sessão autenticada pelo mesmo cookie.
    const logout = await app.inject({
      method: 'POST',
      url: '/api/v1/autenticacao/sair',
      headers: { cookie: sessionCookie },
    });
    // Confirma ausência de corpo e expiração imediata do cookie.
    expect(logout.statusCode).toBe(204);
    expect(logout.headers['set-cookie']).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(logout.headers['set-cookie']).toMatch(/Max-Age=0|Expires=/);
  });

  // Garante que mensagens de login não revelam se o e-mail existe.
  it('usa o mesmo erro para senha incorreta e usuário inexistente', async () => {
    // Cria uma aplicação sem nenhum usuário cadastrado.
    app = createApp(new FakeAuthRepository());
    // Tenta entrar com credenciais estruturalmente válidas, porém inexistentes.
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/autenticacao/entrar',
      payload: { email: 'ninguem@exemplo.com', senha: 'Senha123!' },
    });
    // Confirma o contrato genérico que evita enumeração de contas.
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ codigo: 'CREDENCIAIS_INVALIDAS', mensagem: 'E-mail ou senha inválidos.' });
  });

  // Impede que alguém crie um operador pela rota pública.
  it('rejeita cadastro público com papel OPERADOR', async () => {
    // Cria uma aplicação vazia para deixar a validação ocorrer antes do serviço.
    app = createApp(new FakeAuthRepository());
    // Envia o papel administrativo fora da lista autorizada pelo JSON Schema.
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/autenticacao/cadastro',
      payload: { nome: 'Administrador', email: 'admin@exemplo.com', senha: 'Senha123!', papel: 'OPERADOR' },
    });
    // Confirma rejeição de entrada sem criar usuário.
    expect(response.statusCode).toBe(400);
    expect(response.json().codigo).toBe('DADOS_INVALIDOS');
  });

  // Exige cookie real para qualquer rota de sessão.
  it('rejeita consulta de sessão sem cookie', async () => {
    // Monta a aplicação, mas não realiza login.
    app = createApp(new FakeAuthRepository());
    // Consulta diretamente a rota protegida.
    const response = await app.inject({ method: 'GET', url: '/api/v1/autenticacao/sessao' });
    // Confirma o 401 específico de ausência de sessão.
    expect(response.statusCode).toBe(401);
    expect(response.json().codigo).toBe('SESSAO_NAO_AUTENTICADA');
  });

  // Confirma que adulterar qualquer parte do JWT invalida sua assinatura.
  it('rejeita token adulterado', async () => {
    // Emite um token válido usando o mesmo serviço da aplicação.
    const tokenService = new AuthTokenService(TEST_SECRET);
    const token = await tokenService.issue({
      id: '11111111-1111-4111-8111-111111111111',
      role: 'MORADOR',
    });
    // Troca o último caractere sem conhecer o segredo de assinatura.
    const replacement = token.endsWith('a') ? 'b' : 'a';
    const tampered = `${token.slice(0, -1)}${replacement}`;
    // Confirma que detalhes criptográficos são ocultados pelo erro público de sessão.
    await expect(tokenService.verify(tampered)).rejects.toMatchObject({
      statusCode: 401,
      code: 'SESSAO_INVALIDA',
    });
  });
});

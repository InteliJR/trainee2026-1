/**
 * Verifica cadastro, hash, login, sessão, logout e perfil de coletor contra o PostgreSQL configurado.
 * O usuário artificial recebe e-mail único e é removido no finally para não poluir o Supabase.
 */
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { createPrismaClient } from '../src/infra/database/prisma.js';
import { PrismaHealthRepository } from '../src/modules/health/health.repository.js';

// Cria um identificador improvável de colidir com verificações anteriores.
const suffix = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
// Usa domínio local para deixar claro que a conta não pertence a uma pessoa real.
const testEmail = `auth.verify.${suffix}@ecorota.local`;
// Define uma senha forte conhecida apenas durante esta execução.
const testPassword = 'Verificacao@2026!';
// Conecta ao mesmo Supabase usado pela aplicação.
const database = createPrismaClient(env.databaseUrl);
// Monta todos os plugins reais, incluindo cookie, JWT e repositório Prisma.
const app = buildApp({
  healthRepository: new PrismaHealthRepository(database),
  database,
  nodeEnv: 'test',
  jwtSecret: env.jwtSecret,
  webOrigin: env.webOrigin,
  logger: false,
});

// Extrai o cookie criado pelo login sem expor seu valor no relatório final.
function extractCookie(setCookie: string | string[] | undefined): string {
  // Normaliza a possibilidade de múltiplos cabeçalhos Set-Cookie.
  const header = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  // Falha imediatamente quando a rota deixou de criar a sessão esperada.
  assert.ok(header, 'O login não devolveu cookie de sessão.');
  // Mantém somente nome e valor, formato usado pelo cabeçalho Cookie.
  return header.split(';')[0]!;
}

try {
  // Abre a conexão antes de executar rotas e verificações diretas.
  await database.$connect();
  // Aguarda cookie, CORS e plugins de negócio estarem registrados.
  await app.ready();

  // Cadastra um coletor para validar também a transação que cria CollectorProfile.
  const registration = await app.inject({
    method: 'POST',
    url: '/api/v1/autenticacao/cadastro',
    payload: {
      nome: 'Coletor Verificação Auth',
      email: testEmail,
      telefone: `55${Date.now().toString().slice(-11)}`,
      senha: testPassword,
      papel: 'COLETOR',
    },
  });
  // Exige o status e o papel definidos no contrato público.
  assert.equal(registration.statusCode, 201, registration.body);
  assert.equal(registration.json().usuario.papel, 'COLETOR');

  // Confirma diretamente que a senha persistida é um hash e que o perfil foi criado na mesma transação.
  const persisted = await database.user.findUniqueOrThrow({
    where: { email: testEmail },
    include: { collectorProfile: true },
  });
  // Impede regressão que salvaria a senha original.
  assert.notEqual(persisted.passwordHash, testPassword);
  // Reconhece os prefixos bcrypt aceitos pela biblioteca.
  assert.match(persisted.passwordHash, /^\$2[aby]\$/);
  // Garante que todo coletor público nasce com seu perfil especializado.
  assert.ok(persisted.collectorProfile);

  // Valida a senha persistida e solicita a criação da sessão.
  const login = await app.inject({
    method: 'POST',
    url: '/api/v1/autenticacao/entrar',
    payload: { email: testEmail, senha: testPassword },
  });
  // Exige sucesso antes de usar o cookie nas próximas rotas.
  assert.equal(login.statusCode, 200, login.body);
  const sessionCookie = extractCookie(login.headers['set-cookie']);

  // Consulta a sessão exclusivamente pelo cookie httpOnly simulado.
  const session = await app.inject({
    method: 'GET',
    url: '/api/v1/autenticacao/sessao',
    headers: { cookie: sessionCookie },
  });
  // Confirma que usuário e papel foram recuperados do banco.
  assert.equal(session.statusCode, 200, session.body);
  assert.equal(session.json().usuario.email, testEmail);
  assert.equal(session.json().usuario.papel, 'COLETOR');

  // Remove o cookie pelo endpoint protegido de logout.
  const logout = await app.inject({
    method: 'POST',
    url: '/api/v1/autenticacao/sair',
    headers: { cookie: sessionCookie },
  });
  // Confirma o contrato sem corpo e a emissão do Set-Cookie de remoção.
  assert.equal(logout.statusCode, 204, logout.body);
  assert.ok(logout.headers['set-cookie']);

  // Exibe somente resultados, nunca senha, hash ou JWT.
  console.log(JSON.stringify({
    resultado: 'Autenticação real verificada no Supabase.',
    cadastro: registration.statusCode,
    login: login.statusCode,
    sessao: session.statusCode,
    logout: logout.statusCode,
    hashBcrypt: true,
    perfilColetorTransacional: true,
    usuarioDeTesteRemovidoAoFinal: true,
  }, null, 2));
} finally {
  // Remove somente a conta artificial identificada pelo e-mail único desta execução.
  await database.user.deleteMany({ where: { email: testEmail } });
  // Encerra plugins antes de liberar a conexão PostgreSQL.
  await app.close();
  // Fecha o pool para o processo terminar sem handles pendentes.
  await database.$disconnect();
}

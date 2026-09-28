/** Verifica identidade, consulta de perfil/coletas e alteração de disponibilidade do coletor. */
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { createPrismaClient } from '../src/infra/database/prisma.js';
import { PrismaHealthRepository } from '../src/modules/health/health.repository.js';

// Usa o coletor determinístico criado pelo seed.
const COLLECTOR_ID = '22222222-2222-4222-8222-222222222222';
// Usa a conta e a senha criadas pelo seed para validar o login real.
const COLLECTOR_EMAIL = 'coletor.dev@ecorota.local';
const developmentPassword = process.env.DEVELOPMENT_SEED_PASSWORD?.trim() || 'EcoRota@2026!';
// Conecta o verificador ao banco configurado.
const database = createPrismaClient(env.databaseUrl);
// Monta a API sem EcoRota real para testar somente o fluxo local do coletor.
const app = buildApp({
  healthRepository: new PrismaHealthRepository(database),
  database,
  nodeEnv: 'test',
  jwtSecret: env.jwtSecret,
  webOrigin: env.webOrigin,
  logger: false,
});

try {
  await database.$connect();
  await app.ready();
  // Cria a sessão JWT do coletor antes de acessar qualquer rota protegida.
  const login = await app.inject({
    method: 'POST',
    url: '/api/v1/autenticacao/entrar',
    payload: { email: COLLECTOR_EMAIL, senha: developmentPassword },
  });
  // Exige sucesso para orientar a execução do seed quando necessário.
  assert.equal(login.statusCode, 200, login.body);
  // Extrai somente o par nome=valor usado nas chamadas seguintes.
  const setCookie = login.headers['set-cookie'];
  const cookieHeader = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  assert.ok(cookieHeader, 'O login do coletor não devolveu cookie.');
  const sessionCookie = cookieHeader.split(';')[0]!;
  const original = await database.collectorProfile.findUniqueOrThrow({ where: { userId: COLLECTOR_ID } });

  try {
    const before = await app.inject({
      method: 'GET',
      url: '/api/v1/coletor/disponibilidade',
      headers: { cookie: sessionCookie },
    });
    assert.equal(before.statusCode, 200, before.body);

    const updated = await app.inject({
      method: 'PATCH',
      url: '/api/v1/coletor/disponibilidade',
      headers: { cookie: sessionCookie },
      payload: { disponivel: false },
    });
    assert.equal(updated.statusCode, 200, updated.body);
    assert.equal(updated.json().disponivel, false);
    assert.equal(updated.json().statusSincronizacao, 'PENDING');

    const requests = await app.inject({
      method: 'GET',
      url: '/api/v1/coletor/solicitacoes?pagina=1&limite=10',
      headers: { cookie: sessionCookie },
    });
    assert.equal(requests.statusCode, 200, requests.body);
    assert.ok(Array.isArray(requests.json().dados));

    console.log(JSON.stringify({
      resultado: 'Gestão do coletor verificada no Supabase.',
      consultaDisponibilidade: before.statusCode,
      alteracaoTemporaria: updated.statusCode,
      listagemSolicitacoes: requests.statusCode,
      perfilRestauradoAoFinal: true,
    }, null, 2));
  } finally {
    await database.collectorProfile.update({
      where: { id: original.id },
      data: {
        available: original.available,
        availabilityShift: original.availabilityShift,
        syncStatus: original.syncStatus,
      },
    });
  }
} finally {
  await app.close();
  await database.$disconnect();
}

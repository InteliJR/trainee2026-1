import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { createPrismaClient } from '../src/infra/database/prisma.js';
import { PrismaHealthRepository } from '../src/modules/health/health.repository.js';

const COLLECTOR_ID = '22222222-2222-4222-8222-222222222222';
const database = createPrismaClient(env.databaseUrl);
const app = buildApp({
  healthRepository: new PrismaHealthRepository(database),
  database,
  nodeEnv: 'test',
  logger: false,
});

try {
  await database.$connect();
  await app.ready();
  const original = await database.collectorProfile.findUniqueOrThrow({ where: { userId: COLLECTOR_ID } });

  try {
    const before = await app.inject({
      method: 'GET',
      url: '/api/v1/coletor/disponibilidade',
      headers: { 'x-usuario-id': COLLECTOR_ID },
    });
    assert.equal(before.statusCode, 200, before.body);

    const updated = await app.inject({
      method: 'PATCH',
      url: '/api/v1/coletor/disponibilidade',
      headers: { 'x-usuario-id': COLLECTOR_ID },
      payload: { disponivel: false },
    });
    assert.equal(updated.statusCode, 200, updated.body);
    assert.equal(updated.json().disponivel, false);
    assert.equal(updated.json().statusSincronizacao, 'PENDING');

    const requests = await app.inject({
      method: 'GET',
      url: '/api/v1/coletor/solicitacoes?pagina=1&limite=10',
      headers: { 'x-usuario-id': COLLECTOR_ID },
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


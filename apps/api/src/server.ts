import { buildApp } from './app.js';
import { env } from './config/env.js';
import { createPrismaClient } from './infra/database/prisma.js';
import { HttpEcoRotaClient } from './integration/http/httpEcoRotaClient.js';
import { PrismaHealthRepository } from './modules/health/health.repository.js';

const database = createPrismaClient(env.databaseUrl);
const ecoRotaClient = env.ecorotaUrl && env.ecorotaKey
  ? new HttpEcoRotaClient({ baseUrl: env.ecorotaUrl, apiKey: env.ecorotaKey })
  : undefined;
const app = buildApp({
  healthRepository: new PrismaHealthRepository(database),
  database,
  nodeEnv: env.nodeEnv,
  ecoRotaClient,
});

app.addHook('onClose', async () => {
  await database.$disconnect();
});

async function start(): Promise<void> {
  try {
    await database.$connect();
    await app.listen({ port: env.port, host: '0.0.0.0' });
  } catch (error) {
    app.log.error({ err: error }, 'Não foi possível iniciar a API');
    await app.close();
    process.exitCode = 1;
  }
}

await start();

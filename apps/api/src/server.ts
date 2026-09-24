import { buildApp } from './app.js';
import { env } from './config/env.js';
import { createPrismaClient } from './infra/database/prisma.js';
import { HttpEcoRotaClient } from './integration/http/httpEcoRotaClient.js';
import { operationState } from './integration/operation-state/index.js';
import { EcoRotaWsConsumer } from './integration/ws/ecoRotaWsConsumer.js';
import { PrismaSystemStateRepository } from './integration/ws/systemState.repository.js';
import { EcoRotaDomainSynchronizer } from './integration/sync/ecorotaDomainSynchronizer.js';
import { PrismaEcoRotaRequestSyncRepository } from './integration/sync/ecorotaRequestSync.repository.js';
import { PrismaHealthRepository } from './modules/health/health.repository.js';

const database = createPrismaClient(env.databaseUrl);
const ecoRotaClient = env.ecorotaUrl && env.ecorotaKey
  ? new HttpEcoRotaClient({ baseUrl: env.ecorotaUrl, apiKey: env.ecorotaKey })
  : undefined;
let streamConsumer: EcoRotaWsConsumer | undefined;
const domainSynchronizer = new EcoRotaDomainSynchronizer(
  new PrismaEcoRotaRequestSyncRepository(database),
);
const app = buildApp({
  healthRepository: new PrismaHealthRepository(database),
  database,
  nodeEnv: env.nodeEnv,
  ecoRotaClient,
  streamStatusProvider: env.ecorotaUrl && env.ecorotaKey
    ? () => streamConsumer?.getStatus() ?? {
        connection: 'connecting',
        reconnectAttempt: 0,
        lastMessageAt: null,
        lastError: null,
      }
    : undefined,
});
streamConsumer = env.ecorotaUrl && env.ecorotaKey
  ? new EcoRotaWsConsumer({
      baseUrl: env.ecorotaUrl,
      apiKey: env.ecorotaKey,
      operationState,
      systemStateRepository: new PrismaSystemStateRepository(database),
      logger: app.log,
      onSnapshot: async (snapshot) => {
        const summary = await domainSynchronizer.synchronizeSnapshot(snapshot);
        app.log.info({ summary }, 'Snapshot EcoRota reconciliado com o domínio local.');
      },
      onEvent: async (event) => {
        const result = await domainSynchronizer.synchronizeEvent(event);
        if (result !== 'ignored') {
          app.log.info({ eventId: event.id, type: event.type, result }, 'Evento EcoRota sincronizado com o domínio local.');
        }
      },
    })
  : undefined;

app.addHook('onClose', async () => {
  await streamConsumer?.stop();
  await database.$disconnect();
});

async function start(): Promise<void> {
  try {
    await database.$connect();
    streamConsumer?.start();
    await app.listen({ port: env.port, host: '0.0.0.0' });
  } catch (error) {
    app.log.error({ err: error }, 'Não foi possível iniciar a API');
    await app.close();
    process.exitCode = 1;
  }
}

await start();

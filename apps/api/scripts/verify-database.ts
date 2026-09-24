import { buildApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { createPrismaClient } from '../src/infra/database/prisma.js';
import { PrismaHealthRepository } from '../src/modules/health/health.repository.js';

const EXPECTED_TABLES = [
  'addresses',
  'collection_requests',
  'collector_profiles',
  'points_logs',
  'request_materials',
  'request_status_history',
  'system_state',
  'users',
] as const;

interface TableRow {
  table_name: string;
}

interface RlsRow {
  table_name: string;
}

const database = createPrismaClient(env.databaseUrl);
const app = buildApp({
  healthRepository: new PrismaHealthRepository(database),
  logger: false,
});

try {
  const tables = await database.$queryRaw<TableRow[]>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'addresses',
        'collection_requests',
        'collector_profiles',
        'points_logs',
        'request_materials',
        'request_status_history',
        'system_state',
        'users'
      )
    ORDER BY table_name
  `;

  const tablesWithRls = await database.$queryRaw<RlsRow[]>`
    SELECT c.relname AS table_name
    FROM pg_class c
    INNER JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN (
        'addresses',
        'collection_requests',
        'collector_profiles',
        'points_logs',
        'request_materials',
        'request_status_history',
        'system_state',
        'users'
      )
      AND c.relrowsecurity = true
    ORDER BY c.relname
  `;

  const healthResponse = await app.inject({ method: 'GET', url: '/api/v1/saude' });

  if (tables.length !== EXPECTED_TABLES.length) {
    throw new Error(`Esperadas ${EXPECTED_TABLES.length} tabelas, encontradas ${tables.length}.`);
  }

  if (tablesWithRls.length !== EXPECTED_TABLES.length) {
    throw new Error(
      `RLS esperado em ${EXPECTED_TABLES.length} tabelas, encontrado em ${tablesWithRls.length}.`,
    );
  }

  if (healthResponse.statusCode !== 200) {
    throw new Error(`A rota de saúde respondeu ${healthResponse.statusCode}.`);
  }

  console.log(`Tabelas verificadas: ${tables.length}`);
  console.log(`Tabelas com RLS: ${tablesWithRls.length}`);
  console.log(`GET /api/v1/saude: ${healthResponse.statusCode}`);
} finally {
  await app.close();
  await database.$disconnect();
}

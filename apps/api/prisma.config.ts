import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';
import { fileURLToPath } from 'node:url';

const rootEnvPath = fileURLToPath(new URL('../../.env', import.meta.url));
config({ path: rootEnvPath });

const migrationDatabaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!migrationDatabaseUrl) {
  throw new Error(
    'Configure DIRECT_URL ou DATABASE_URL no .env da raiz para executar comandos do Prisma.',
  );
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: migrationDatabaseUrl,
  },
});

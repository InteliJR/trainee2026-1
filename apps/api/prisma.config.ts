/** Faz o Prisma CLI ler o .env raiz, o schema e a conexão direta usada nas migrations do Supabase. */
import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';
import { fileURLToPath } from 'node:url';

// Localiza o .env do monorepo a partir do arquivo de configuração do Prisma.
const rootEnvPath = fileURLToPath(new URL('../../.env', import.meta.url));
config({ path: rootEnvPath });

// Prefere conexão direta para DDL e usa DATABASE_URL somente como alternativa local.
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

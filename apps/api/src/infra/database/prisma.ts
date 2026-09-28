/** Cria o cliente Prisma 7 usando o adaptador PostgreSQL e a URL validada do Supabase. */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';

// Encapsula a configuração exigida pelo Prisma 7 para que exista um único ponto de criação.
export function createPrismaClient(databaseUrl: string): PrismaClient {
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  return new PrismaClient({ adapter });
}

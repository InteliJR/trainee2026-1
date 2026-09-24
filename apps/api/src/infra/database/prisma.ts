import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';
import { env } from '../../config/env.js';

if (!env.databaseUrl) {
  throw new Error('DATABASE_URL não foi configurada no .env da raiz.');
}

const adapter = new PrismaPg({ connectionString: env.databaseUrl });

export const prisma = new PrismaClient({ adapter });

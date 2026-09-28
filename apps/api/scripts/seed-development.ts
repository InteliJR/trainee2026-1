/**
 * Cria usuários fixos de desenvolvimento com senhas bcrypt para exercitar autenticação e os três papéis.
 * Usa upsert para poder ser executado repetidamente sem duplicar dados.
 */
import { createPrismaClient } from '../src/infra/database/prisma.js';
import { env } from '../src/config/env.js';
import { hash } from 'bcryptjs';

// Mantém UUIDs determinísticos para que exemplos e verificadores usem sempre os mesmos atores.
export const DEVELOPMENT_USERS = {
  resident: '11111111-1111-4111-8111-111111111111',
  collector: '22222222-2222-4222-8222-222222222222',
  operator: '33333333-3333-4333-8333-333333333333',
} as const;

// Abre o cliente apontando para o banco definido no .env raiz.
const database = createPrismaClient(env.databaseUrl);
// Usa valor configurável e recorre a uma senha conhecida somente no seed de desenvolvimento.
const developmentPassword = process.env.DEVELOPMENT_SEED_PASSWORD?.trim() || 'EcoRota@2026!';

// Executa upserts do morador, coletor/perfil e operador sem remover dados existentes.
async function seed(): Promise<void> {
  // Calcula um único hash seguro reutilizado pelos três usuários artificiais desta execução.
  const passwordHash = await hash(developmentPassword, 12);
  await database.user.upsert({
    where: { id: DEVELOPMENT_USERS.resident },
    update: { name: 'Morador Desenvolvimento', passwordHash, role: 'MORADOR' },
    create: {
      id: DEVELOPMENT_USERS.resident,
      name: 'Morador Desenvolvimento',
      email: 'morador.dev@ecorota.local',
      passwordHash,
      role: 'MORADOR',
    },
  });

  await database.user.upsert({
    where: { id: DEVELOPMENT_USERS.collector },
    update: { name: 'Coletor Desenvolvimento', passwordHash, role: 'COLETOR' },
    create: {
      id: DEVELOPMENT_USERS.collector,
      name: 'Coletor Desenvolvimento',
      email: 'coletor.dev@ecorota.local',
      passwordHash,
      role: 'COLETOR',
    },
  });

  await database.user.upsert({
    where: { id: DEVELOPMENT_USERS.operator },
    update: { name: 'Operador Desenvolvimento', passwordHash, role: 'OPERADOR' },
    create: {
      id: DEVELOPMENT_USERS.operator,
      name: 'Operador Desenvolvimento',
      email: 'operador.dev@ecorota.local',
      passwordHash,
      role: 'OPERADOR',
    },
  });

  await database.collectorProfile.upsert({
    where: { userId: DEVELOPMENT_USERS.collector },
    update: { available: true, availabilityShift: 'DESENVOLVIMENTO' },
    create: {
      userId: DEVELOPMENT_USERS.collector,
      available: true,
      availabilityShift: 'DESENVOLVIMENTO',
    },
  });
}

try {
  await database.$connect();
  await seed();
  console.log('Usuários e perfil de desenvolvimento preparados com sucesso.');
} finally {
  await database.$disconnect();
}

import { createPrismaClient } from '../src/infra/database/prisma.js';
import { env } from '../src/config/env.js';

export const DEVELOPMENT_USERS = {
  resident: '11111111-1111-4111-8111-111111111111',
  collector: '22222222-2222-4222-8222-222222222222',
  operator: '33333333-3333-4333-8333-333333333333',
} as const;

const database = createPrismaClient(env.databaseUrl);

async function seed(): Promise<void> {
  await database.user.upsert({
    where: { id: DEVELOPMENT_USERS.resident },
    update: { name: 'Morador Desenvolvimento', role: 'MORADOR' },
    create: {
      id: DEVELOPMENT_USERS.resident,
      name: 'Morador Desenvolvimento',
      email: 'morador.dev@ecorota.local',
      passwordHash: 'AUTENTICACAO_DESABILITADA',
      role: 'MORADOR',
    },
  });

  await database.user.upsert({
    where: { id: DEVELOPMENT_USERS.collector },
    update: { name: 'Coletor Desenvolvimento', role: 'COLETOR' },
    create: {
      id: DEVELOPMENT_USERS.collector,
      name: 'Coletor Desenvolvimento',
      email: 'coletor.dev@ecorota.local',
      passwordHash: 'AUTENTICACAO_DESABILITADA',
      role: 'COLETOR',
    },
  });

  await database.user.upsert({
    where: { id: DEVELOPMENT_USERS.operator },
    update: { name: 'Operador Desenvolvimento', role: 'OPERADOR' },
    create: {
      id: DEVELOPMENT_USERS.operator,
      name: 'Operador Desenvolvimento',
      email: 'operador.dev@ecorota.local',
      passwordHash: 'AUTENTICACAO_DESABILITADA',
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


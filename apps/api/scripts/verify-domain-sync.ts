import assert from 'node:assert/strict';
import { env } from '../src/config/env.js';
import { createPrismaClient } from '../src/infra/database/prisma.js';
import type { EcoRotaEventMessage, EcoRotaRequest } from '../src/integration/ecorotaClient.js';
import { EcoRotaDomainSynchronizer } from '../src/integration/sync/ecorotaDomainSynchronizer.js';
import { PrismaEcoRotaRequestSyncRepository } from '../src/integration/sync/ecorotaRequestSync.repository.js';

const USERS = {
  resident: '11111111-1111-4111-8111-111111111111',
  collector: '22222222-2222-4222-8222-222222222222',
} as const;

const database = createPrismaClient(env.databaseUrl);

function externalRequest(
  base: EcoRotaRequest,
  status: EcoRotaRequest['status'],
  collectorId: string,
): EcoRotaRequest {
  return { ...base, status, collectorId, updatedAt: new Date().toISOString() };
}

function event(
  id: string,
  revision: number,
  type: EcoRotaEventMessage['type'],
  data: EcoRotaRequest,
): EcoRotaEventMessage {
  return {
    id,
    revision,
    generation: 77,
    simulationTime: revision * 1_000,
    occurredAt: new Date().toISOString(),
    type,
    data,
  };
}

try {
  await database.$connect();
  const collectorProfile = await database.collectorProfile.findUniqueOrThrow({
    where: { userId: USERS.collector },
  });
  const suffix = Date.now().toString();
  const address = await database.address.create({
    data: {
      userId: USERS.resident,
      label: `Sincronização ${suffix}`,
      street: 'Rua WebSocket',
      number: suffix.slice(-6),
      district: 'Vila Evento',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01001000',
      latitude: -23.55052,
      longitude: -46.633308,
    },
  });
  const local = await database.collectionRequest.create({
    data: {
      residentId: USERS.resident,
      addressId: address.id,
      collectorProfileId: collectorProfile.id,
      externalReference: `verificacao-sync-${suffix}`,
      externalPointId: '44444444-4444-4444-8444-444444444444',
      desiredAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      status: 'PENDING',
      syncStatus: 'PENDING',
      materials: { create: { materialType: 'PAPER', estimatedQuantity: 2, unit: 'kg' } },
      statusHistory: {
        create: {
          source: 'LOCAL',
          toStatus: 'PENDING',
          occurredAt: new Date(),
          changedByUserId: USERS.resident,
          reason: 'Solicitação criada para verificar sincronização.',
        },
      },
    },
  });

  const externalId = `external-${suffix}`;
  const collectorExternalId = `collector-${suffix}`;
  const base: EcoRotaRequest = {
    id: externalId,
    pointId: '44444444-4444-4444-8444-444444444444',
    externalReference: local.externalReference,
    status: 'pending',
    collectorId: null,
    createdAt: new Date().toISOString(),
    createdSimulationTime: 1,
    updatedAt: new Date().toISOString(),
  };
  const synchronizer = new EcoRotaDomainSynchronizer(
    new PrismaEcoRotaRequestSyncRepository(database),
  );

  assert.equal(await synchronizer.synchronizeEvent(event(
    `assigned-${suffix}`, 100, 'request.assigned', externalRequest(base, 'assigned', collectorExternalId),
  )), 'updated');
  assert.equal(await synchronizer.synchronizeEvent(event(
    `started-${suffix}`, 100, 'request.started', externalRequest(base, 'in_service', collectorExternalId),
  )), 'updated');
  const completedEvent = event(
    `completed-${suffix}`, 101, 'request.completed', externalRequest(base, 'completed', collectorExternalId),
  );
  assert.equal(await synchronizer.synchronizeEvent(completedEvent), 'updated');
  assert.equal(await synchronizer.synchronizeEvent(completedEvent), 'duplicate');

  const synchronized = await database.collectionRequest.findUniqueOrThrow({
    where: { id: local.id },
    include: { statusHistory: true, pointsLogs: true },
  });
  const externalHistory = synchronized.statusHistory.filter((item) => item.source === 'ECOROTA');
  assert.equal(synchronized.status, 'COMPLETED');
  assert.equal(synchronized.syncStatus, 'SYNCED');
  assert.equal(synchronized.ecoRotaRequestId, externalId);
  assert.equal(externalHistory.length, 3);
  assert.deepEqual(externalHistory.map((item) => item.revision).sort(), [100, 100, 101]);
  assert.equal(synchronized.pointsLogs.length, 2);

  console.log(JSON.stringify({
    resultado: 'Sincronização de domínio verificada no Supabase.',
    solicitacaoId: local.id,
    statusFinal: synchronized.status,
    historicosEcoRota: externalHistory.length,
    eventosMesmaRevisionAceitos: externalHistory.filter((item) => item.revision === 100).length,
    creditosGerados: synchronized.pointsLogs.length,
    eventoConcluidoDuplicado: 'ignorado',
  }, null, 2));
} finally {
  await database.$disconnect();
}


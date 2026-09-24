import Fastify, { type FastifyInstance } from 'fastify';
import { io as createSocketClient, type Socket as ClientSocket } from 'socket.io-client';
import { afterEach, describe, expect, it } from 'vitest';
import type { EcoRotaSnapshot } from '../src/integration/ecorotaClient.js';
import { OperationStateStore } from '../src/integration/operation-state/operationState.js';
import type {
  RealtimeAccessRepository,
  RealtimeActor,
  RequestRecipients,
} from '../src/realtime/realtimeAccess.repository.js';
import {
  createRealtimeBroker,
  filterSnapshotForActor,
  type RealtimeBroker,
} from '../src/realtime/socketServer.js';

const RESIDENT_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_RESIDENT_ID = '22222222-2222-4222-8222-222222222222';

class FakeAccessRepository implements RealtimeAccessRepository {
  readonly actors = new Map<string, RealtimeActor>([
    [RESIDENT_ID, { id: RESIDENT_ID, role: 'MORADOR', ecoRotaCollectorId: null }],
    [OTHER_RESIDENT_ID, { id: OTHER_RESIDENT_ID, role: 'MORADOR', ecoRotaCollectorId: null }],
  ]);

  findActor(userId: string): Promise<RealtimeActor | null> {
    return Promise.resolve(this.actors.get(userId) ?? null);
  }

  listAllowedExternalReferences(actor: RealtimeActor): Promise<string[]> {
    return Promise.resolve(actor.id === RESIDENT_ID ? ['pedido-do-morador'] : ['pedido-de-outro']);
  }

  findRequestRecipients(externalReference: string): Promise<RequestRecipients | null> {
    return Promise.resolve(externalReference === 'pedido-do-morador'
      ? { residentUserId: RESIDENT_ID, collectorUserId: null }
      : null);
  }

  findCollectorUserId(): Promise<string | null> {
    return Promise.resolve(null);
  }

  listResidentUserIds(): Promise<string[]> {
    return Promise.resolve([]);
  }
}

function createSnapshot(): EcoRotaSnapshot {
  return {
    id: 'environment',
    name: 'Teste',
    generation: 1,
    revision: 1,
    simulationTime: 1,
    paused: false,
    observedAt: '2026-09-24T10:00:00.000Z',
    maxCollectors: 4,
    occupiedSlots: 0,
    tickMs: 1_000,
    pollIntervalMs: 5_000,
    points: [],
    collectors: [],
    routes: [],
    requests: [
      {
        id: 'request-1', pointId: 'point-1', externalReference: 'pedido-do-morador',
        status: 'pending', collectorId: null, createdAt: '2026-09-24T10:00:00.000Z',
        createdSimulationTime: 1, updatedAt: '2026-09-24T10:00:00.000Z',
      },
      {
        id: 'request-2', pointId: 'point-2', externalReference: 'pedido-de-outro',
        status: 'pending', collectorId: null, createdAt: '2026-09-24T10:00:00.000Z',
        createdSimulationTime: 1, updatedAt: '2026-09-24T10:00:00.000Z',
      },
    ],
    eventCursor: '1',
  };
}

function waitForEvent<T>(socket: ClientSocket, event: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Tempo excedido aguardando ${event}.`)), 2_000);
    socket.once(event, (payload: T) => {
      clearTimeout(timeout);
      resolve(payload);
    });
  });
}

describe('servidor Socket.IO', () => {
  let app: FastifyInstance | undefined;
  let broker: RealtimeBroker | undefined;
  let client: ClientSocket | undefined;

  afterEach(async () => {
    client?.close();
    await broker?.close();
    await app?.close();
  });

  it('filtra solicitações e rotas do snapshot conforme o ator', () => {
    const state = new OperationStateStore();
    state.replaceSnapshot(createSnapshot());
    const filtered = filterSnapshotForActor(
      state.getSnapshot(),
      { id: RESIDENT_ID, role: 'MORADOR', ecoRotaCollectorId: null },
      new Set(['pedido-do-morador']),
    );

    expect(filtered.requests.map((request) => request.externalReference)).toEqual(['pedido-do-morador']);
    expect(filtered.routes).toEqual([]);
  });

  it('abre a conexão autenticada e envia somente o estado permitido ao morador', async () => {
    const state = new OperationStateStore();
    state.replaceSnapshot(createSnapshot());
    app = Fastify({ logger: false });
    broker = createRealtimeBroker(app, {
      nodeEnv: 'test',
      webOrigin: 'http://localhost:5173',
      accessRepository: new FakeAccessRepository(),
      state,
    });
    await app.listen({ host: '127.0.0.1', port: 0 });
    const address = app.server.address();
    if (!address || typeof address === 'string') throw new Error('Porta de teste indisponível.');

    client = createSocketClient(`http://127.0.0.1:${address.port}/tempo-real`, {
      path: '/socket.io',
      auth: { usuarioId: RESIDENT_ID },
      transports: ['websocket'],
      forceNew: true,
    });
    const snapshot = await waitForEvent<{ requests: Array<{ externalReference: string }> }>(
      client,
      'operacao:estado-inicial',
    );

    expect(snapshot.requests.map((request) => request.externalReference)).toEqual(['pedido-do-morador']);

    const assignmentPromise = waitForEvent<{ referenciaExterna: string; status: string }>(
      client,
      'solicitacao:atribuida',
    );
    state.applyEvent({
      id: 'event-2',
      type: 'request.assigned',
      generation: 1,
      revision: 2,
      simulationTime: 2,
      occurredAt: '2026-09-24T10:01:00.000Z',
      data: {
        ...createSnapshot().requests[0],
        status: 'assigned',
        collectorId: 'collector-1',
      },
    });
    await expect(assignmentPromise).resolves.toMatchObject({
      referenciaExterna: 'pedido-do-morador',
      status: 'ATRIBUIDA',
    });
  });

  it('recusa uma identidade que não existe', async () => {
    app = Fastify({ logger: false });
    broker = createRealtimeBroker(app, {
      nodeEnv: 'test',
      webOrigin: 'http://localhost:5173',
      accessRepository: new FakeAccessRepository(),
      state: new OperationStateStore(),
    });
    await app.listen({ host: '127.0.0.1', port: 0 });
    const address = app.server.address();
    if (!address || typeof address === 'string') throw new Error('Porta de teste indisponível.');

    client = createSocketClient(`http://127.0.0.1:${address.port}/tempo-real`, {
      path: '/socket.io',
      auth: { usuarioId: '33333333-3333-4333-8333-333333333333' },
      transports: ['websocket'],
      forceNew: true,
    });
    const error = await waitForEvent<Error>(client, 'connect_error');

    expect(error.message).toBe('USUARIO_NAO_ENCONTRADO');
  });
});

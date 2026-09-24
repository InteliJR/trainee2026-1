import { describe, expect, it, vi } from 'vitest';
import type { EcoRotaEventMessage, EcoRotaRequest, EcoRotaSnapshot } from '../src/integration/ecorotaClient.js';
import { EcoRotaDomainSynchronizer } from '../src/integration/sync/ecorotaDomainSynchronizer.js';
import type { EcoRotaRequestSyncRepository } from '../src/integration/sync/ecorotaRequestSync.repository.js';

function request(id: string): EcoRotaRequest {
  return {
    id,
    pointId: '44444444-4444-4444-8444-444444444444',
    externalReference: `pedido-${id}`,
    status: 'assigned',
    collectorId: null,
    createdAt: '2026-09-24T10:00:00.000Z',
    createdSimulationTime: 10,
    updatedAt: '2026-09-24T10:01:00.000Z',
  };
}

describe('EcoRotaDomainSynchronizer', () => {
  it('ignora eventos que não representam solicitações', async () => {
    const repository: EcoRotaRequestSyncRepository = { synchronizeRequest: vi.fn() };
    const synchronizer = new EcoRotaDomainSynchronizer(repository);
    const event = {
      id: 'event-1', revision: 2, generation: 1, simulationTime: 10,
      occurredAt: '2026-09-24T10:00:00.000Z', type: 'simulation.updated', data: { paused: true },
    } satisfies EcoRotaEventMessage;

    await expect(synchronizer.synchronizeEvent(event)).resolves.toBe('ignored');
    expect(repository.synchronizeRequest).not.toHaveBeenCalled();
  });

  it('encaminha evento de solicitação com metadados de idempotência', async () => {
    const synchronizeRequest = vi.fn().mockResolvedValue('updated');
    const synchronizer = new EcoRotaDomainSynchronizer({ synchronizeRequest });
    const data = request('external-1');
    const event = {
      id: 'event-42', revision: 9, generation: 3, simulationTime: 10,
      occurredAt: '2026-09-24T10:02:00.000Z', type: 'request.assigned', data,
    } satisfies EcoRotaEventMessage;

    await expect(synchronizer.synchronizeEvent(event)).resolves.toBe('updated');
    expect(synchronizeRequest).toHaveBeenCalledWith(data, expect.objectContaining({
      eventId: 'event-42', generation: 3, revision: 9, recordUnchanged: true,
    }));
  });

  it('reconcilia todas as solicitações de um snapshot', async () => {
    const synchronizeRequest = vi.fn()
      .mockResolvedValueOnce('updated')
      .mockResolvedValueOnce('not_found');
    const synchronizer = new EcoRotaDomainSynchronizer({ synchronizeRequest });
    const snapshot = {
      id: 'environment', name: 'Teste', generation: 2, revision: 20, simulationTime: 100,
      paused: false, observedAt: '2026-09-24T10:00:00.000Z', maxCollectors: 4,
      occupiedSlots: 0, tickMs: 1000, pollIntervalMs: 5000, points: [], collectors: [], routes: [],
      requests: [request('external-1'), request('external-2')], eventCursor: '20',
    } satisfies EcoRotaSnapshot;

    await expect(synchronizer.synchronizeSnapshot(snapshot)).resolves.toEqual({
      updated: 1, unchanged: 0, duplicate: 0, notFound: 1,
    });
  });
});


import type { CollectionPoint } from '../src/generated/prisma/client.js';
import type { CollectionPointRepository } from '../src/modules/operation/collectionPoint.repository.js';
import { LocalCollectorSimulation } from '../src/modules/local-simulation/localCollectorSimulation.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

function point(id: string, longitude: number, latitude: number): CollectionPoint {
  const now = new Date();
  return {
    id, name: id, kind: 'ADDITIONAL', longitude: longitude as unknown as CollectionPoint['longitude'],
    latitude: latitude as unknown as CollectionPoint['latitude'], circuit: 1, description: null,
    active: true, createdByUserId: '33333333-3333-4333-8333-333333333333', createdAt: now, updatedAt: now, deletedAt: null,
  };
}

const A = point('11111111-1111-4111-8111-111111111111', -46.64, -23.55);
const B = point('22222222-2222-4222-8222-222222222222', -46.63, -23.54);
const repository = {
  async findById(id: string) { return [A, B].find((item) => item.id === id) ?? null; },
} as CollectionPointRepository;

describe('LocalCollectorSimulation', () => {
  afterEach(() => vi.useRealTimers());

  it('move o coletor entre dois pontos e publica atualizações', async () => {
    vi.useFakeTimers();
    const simulation = new LocalCollectorSimulation(repository, 100, 1_000);
    const updates: number[] = [];
    simulation.onUpdate((state) => updates.push(state.sequence));
    const started = await simulation.start(A.id, B.id);
    expect(started.status).toBe('EM_EXECUCAO');
    expect(started.collector?.position.coordinates).toEqual([-46.64, -23.55]);
    await vi.advanceTimersByTimeAsync(500);
    const current = simulation.getSnapshot();
    expect(current.progress).toBeGreaterThan(0);
    expect(current.collector?.position.coordinates[0]).toBeGreaterThan(-46.64);
    expect(updates.length).toBeGreaterThan(1);
    expect(simulation.stop().status).toBe('PARADA');
    simulation.close();
  });

  it('rejeita pontos iguais', async () => {
    const simulation = new LocalCollectorSimulation(repository);
    await expect(simulation.start(A.id, A.id)).rejects.toThrow('PONTOS_SIMULACAO_DEVEM_SER_DISTINTOS');
    simulation.close();
  });
});

/**
 * Testes das posições dos coletores da plataforma mantidas em memória.
 */
import { describe, expect, it } from 'vitest';
import { CollectorPositionStore, POSITION_MAX_AGE_MS, type CollectorPositionEntry } from '../src/realtime/collectorPositions.js';

const NOW = Date.parse('2026-09-28T12:00:00.000Z');

function entry(overrides: Partial<CollectorPositionEntry> = {}): CollectorPositionEntry {
  return {
    collectorUserId: 'coletor-1',
    name: 'Coletor 1',
    coordinates: [-46.73, -23.56],
    accuracyMeters: 10,
    observedAt: new Date(NOW).toISOString(),
    ...overrides,
  };
}

describe('CollectorPositionStore', () => {
  it('guarda só a posição mais recente de cada coletor e avisa quem acompanha', () => {
    const store = new CollectorPositionStore(() => NOW);
    const received: string[] = [];
    store.onUpdate((item) => received.push(item.collectorUserId));
    store.update(entry());
    store.update(entry({ coordinates: [-46.72, -23.55] }));
    expect(store.list()).toHaveLength(1);
    expect(store.list()[0].coordinates).toEqual([-46.72, -23.55]);
    expect(received).toEqual(['coletor-1', 'coletor-1']);
  });

  it('descarta posições mais antigas que o limite', () => {
    const store = new CollectorPositionStore(() => NOW);
    store.update(entry({ collectorUserId: 'recente' }));
    store.update(entry({ collectorUserId: 'antigo', observedAt: new Date(NOW - POSITION_MAX_AGE_MS - 1).toISOString() }));
    expect(store.list().map((item) => item.collectorUserId)).toEqual(['recente']);
  });

  it('para de avisar depois de cancelar a inscrição', () => {
    const store = new CollectorPositionStore(() => NOW);
    let calls = 0;
    const unsubscribe = store.onUpdate(() => { calls += 1; });
    unsubscribe();
    store.update(entry());
    expect(calls).toBe(0);
  });
});

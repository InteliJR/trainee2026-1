import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CollectorTask } from './types';
import { discardFailedAction, enqueueAction, pendingActions, projectPending, setCollectorOwner, syncPending } from './offlineQueue';

const task = (status: CollectorTask['status']): CollectorTask => ({
  id: 'coleta-1', status, materials: [],
  address: { street: 'Rua A', number: '1', district: 'Centro', city: 'São Paulo' },
  scheduledDate: '2026-09-28', updatedAt: '2026-09-28T12:00:00Z',
});

beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  });
  vi.stubGlobal('window', { dispatchEvent: vi.fn() });
  vi.stubGlobal('Event', class { constructor(public type: string) {} });
  vi.stubGlobal('crypto', { randomUUID: vi.fn().mockReturnValueOnce('acao-1').mockReturnValueOnce('acao-2') });
  setCollectorOwner('coletor-1');
});

describe('fila offline do coletor', () => {
  it('mantém ações pendentes no armazenamento e envia início antes da conclusão', async () => {
    enqueueAction({ taskId: 'coleta-1', type: 'start' });
    enqueueAction({ taskId: 'coleta-1', type: 'complete', photoUrl: 'https://example.com/foto.jpg' });
    expect(projectPending([task('assigned')])[0].status).toBe('completed');

    let status: CollectorTask['status'] = 'assigned';
    const sent: string[] = [];
    await syncPending('coletor-1', async () => [task(status)], async (action) => {
      sent.push(action.type);
      status = action.type === 'start' ? 'in_service' : 'completed';
    });

    expect(sent).toEqual(['start', 'complete']);
    expect(pendingActions()).toEqual([]);
  });

  it('pausa em conflito e permite descartar apenas a ação com erro', async () => {
    const action = enqueueAction({ taskId: 'coleta-1', type: 'start' });
    await syncPending('coletor-1', async () => [task('cancelled')], vi.fn());
    expect(pendingActions()[0].error).toBeTruthy();
    discardFailedAction(action.id);
    expect(pendingActions()).toEqual([]);
  });
});

import type { CollectorTask } from './types';
import { ApiError } from './errors';

export type PendingAction = {
  id: string;
  taskId: string;
  type: 'start' | 'complete';
  photoUrl?: string;
  createdAt: string;
  error?: string;
};

const OWNER_KEY = 'ecorota.collector.owner';
const queueKey = (owner: string) => `ecorota.collector.queue.${owner}`;
const tasksKey = (owner: string) => `ecorota.collector.tasks.${owner}`;
const notify = () => window.dispatchEvent(new Event('collector-queue-change'));

export function collectorOwner(): string | null {
  try { return localStorage.getItem(OWNER_KEY); } catch { return null; }
}

export function setCollectorOwner(id: string | null): void {
  try {
    if (id) localStorage.setItem(OWNER_KEY, id);
    else localStorage.removeItem(OWNER_KEY);
  } catch { /* Offline storage can be disabled by the browser. */ }
  notify();
}

function read<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch { return fallback; }
}

function write<T>(key: string, value: T): void {
  // Propagate quota/security errors: an action must never appear saved when it was not.
  localStorage.setItem(key, JSON.stringify(value));
  notify();
}

export function pendingActions(owner = collectorOwner()): PendingAction[] {
  return owner ? read(queueKey(owner), []) : [];
}

export function cachedTasks(owner = collectorOwner()): CollectorTask[] | null {
  return owner ? read<CollectorTask[] | null>(tasksKey(owner), null) : null;
}

export function saveTasks(tasks: CollectorTask[], owner = collectorOwner()): void {
  if (owner) {
    try { write(tasksKey(owner), tasks); } catch { /* Online data remains usable. */ }
  }
}

export function projectPending(tasks: CollectorTask[], owner = collectorOwner()): CollectorTask[] {
  const actions = pendingActions(owner);
  return tasks.map((task) => {
    const last = actions.filter((action) => action.taskId === task.id && !action.error).at(-1);
    return last ? { ...task, status: last.type === 'complete' ? 'completed' : 'in_service' } : task;
  });
}

export function enqueueAction(action: Omit<PendingAction, 'id' | 'createdAt'>): PendingAction {
  const owner = collectorOwner();
  if (!owner) throw new Error('Entre na conta do coletor com conexão antes de usar a fila offline.');
  const queue = pendingActions(owner);
  const existing = queue.find((item) => item.taskId === action.taskId && item.type === action.type);
  if (existing) {
    if (existing.error) throw new Error(existing.error);
    return existing;
  }
  const pending: PendingAction = { ...action, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  write(queueKey(owner), [...queue, pending]);
  return pending;
}

export function discardFailedAction(id: string, owner = collectorOwner()): void {
  if (!owner) return;
  const queue = pendingActions(owner);
  if (!queue.some((action) => action.id === id && action.error)) return;
  replaceQueue(owner, queue.filter((action) => action.id !== id));
}

function replaceQueue(owner: string, queue: PendingAction[]): void {
  write(queueKey(owner), queue);
}

let syncing: Promise<void> | null = null;

export function syncPending(
  owner: string,
  listTasks: () => Promise<CollectorTask[]>,
  send: (action: PendingAction) => Promise<void>,
): Promise<void> {
  if (syncing) return syncing;
  syncing = (async () => {
    while (collectorOwner() === owner) {
      const queue = pendingActions(owner);
      const action = queue[0];
      if (!action || action.error) break;
      let tasks: CollectorTask[];
      try { tasks = await listTasks(); } catch { break; }
      const current = tasks.find((task) => task.id === action.taskId);
      const alreadyDone = action.type === 'start'
        ? current?.status === 'in_service' || current?.status === 'completed'
        : current?.status === 'completed';
      if (alreadyDone) {
        replaceQueue(owner, queue.slice(1));
        continue;
      }
      if (!current || (action.type === 'start' ? current.status !== 'assigned' : current.status !== 'in_service')) {
        replaceQueue(owner, [{ ...action, error: 'O estado da coleta mudou. Confira antes de reenviar.' }, ...queue.slice(1)]);
        break;
      }
      try {
        await send(action);
        replaceQueue(owner, queue.slice(1));
      } catch (error) {
        if (error instanceof ApiError && error.status !== 0 && error.status < 500) {
          replaceQueue(owner, [{ ...action, error: error.message }, ...queue.slice(1)]);
        }
        break;
      }
    }
  })().finally(() => { syncing = null; });
  return syncing;
}

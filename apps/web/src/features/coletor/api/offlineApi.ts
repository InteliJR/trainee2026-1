import { httpApi } from './http';
import { ApiError } from './errors';
import { cachedTasks, collectorOwner, enqueueAction, pendingActions, projectPending, saveTasks, syncPending, type PendingAction } from './offlineQueue';
import type { CollectorApi } from './types';
import { checkCollectorSession } from '../lib/collectorAuth';

async function send(action: PendingAction): Promise<void> {
  if (action.type === 'start') await httpApi.startTask(action.taskId);
  else await httpApi.completeTask(action.taskId, action.photoUrl!);
}

export async function synchronizeCollectorQueue(): Promise<void> {
  const owner = collectorOwner();
  if (!owner || !pendingActions(owner).length || !navigator.onLine) return;
  const session = await checkCollectorSession();
  if (session.kind !== 'autorizado' || session.user.id !== owner) return;
  await syncPending(owner, httpApi.listTasks, send);
}

async function offlineAction(action: Omit<PendingAction, 'id' | 'createdAt'>): Promise<void> {
  const duplicate = pendingActions().find((pending) => pending.taskId === action.taskId && pending.type === action.type);
  if (duplicate) {
    if (duplicate.error) throw new Error(duplicate.error);
    return;
  }
  if (!navigator.onLine || pendingActions().some((pending) => pending.taskId === action.taskId)) {
    enqueueAction(action);
    void synchronizeCollectorQueue().catch(() => {
      // A ação já está persistida e será tentada novamente ao reconectar.
    });
    return;
  }
  try {
    await send({ ...action, id: '', createdAt: '' });
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 0) throw error;
    enqueueAction(action);
  }
}

export const offlineApi: CollectorApi = {
  async listTasks() {
    try {
      const tasks = await httpApi.listTasks();
      saveTasks(tasks);
      return projectPending(tasks);
    } catch (error) {
      if (error instanceof ApiError && error.status === 0) {
        const tasks = cachedTasks();
        if (tasks) return projectPending(tasks);
      }
      throw error;
    }
  },
  getPoints: () => httpApi.getPoints(),
  startTask: (id) => offlineAction({ taskId: id, type: 'start' }),
  completeTask: (id, photoUrl) => offlineAction({ taskId: id, type: 'complete', photoUrl }),
  getAvailability: () => httpApi.getAvailability(),
  setAvailability: (available) => httpApi.setAvailability(available),
};

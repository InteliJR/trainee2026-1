// Cliente da API real (Fastify). Ainda não usado: entra no lugar do mock quando o Dev 1 entregar as rotas
// (PLANO.md, Task 3.4) — basta VITE_USE_MOCK=false.
import { endpoints } from './endpoints';
import { ApiError } from './errors';
import type { CollectorApi } from './types';

const BASE = '/api';

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      credentials: 'include', // JWT em cookie httpOnly
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Sem conexão');
  }
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new ApiError(res.status, data?.message ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const httpApi: CollectorApi = {
  listTasks: () => request('GET', endpoints.tasks),
  completeTask: (id) => request('POST', endpoints.completeTask(id)),
  cancelTask: (id) => request('POST', endpoints.cancelTask(id)),
  reportIssue: (id, report) => request('POST', endpoints.reportIssue(id), report),
};

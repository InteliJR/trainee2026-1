// Backend simulado para o front do coletor andar sem a API (PLANO.md: "front não espera o back").
// Dados vêm de `../mocks/tasks.json`; o que o coletor faz fica em localStorage.
// Ative a API real com VITE_USE_MOCK=false.
//
// Simula também o que a EcoRota/backend fazem de verdade:
//  - uma coleta `assigned` vira `in_service` sozinha depois de um tempo (o coletor "chegou ao local");
//  - só se conclui uma coleta `in_service` (regra do guia de integração);
//  - só se cancela o que está `assigned` ou `in_service`;
//  - coleta não realizada com reagendamento devolve a coleta para a fila (`pending`) na nova data;
//    sem reagendamento, ela é encerrada como `cancelled`. [CONFIRMAR COM O TIME]
import type { RequestStatus } from '@ecorota/shared';
import { ISSUE_STATUSES, CANCELABLE_STATUSES, COMPLETABLE_STATUSES, type Material } from '../config';
import tasksJson from '../mocks/tasks.json';
import { ApiError } from './errors';
import type { CollectorApi, CollectorTask } from './types';

const STORAGE_KEY = 'ecorota.mock.coletor.v1';
const LATENCY_MS = 250;

interface SeedTask {
  id: string;
  status: string;
  materials: string[];
  pointId: string;
  pointName: string;
  circuit: number;
  notes?: string;
  arrivesInMs?: number;
}
type StoredTask = CollectorTask & { arrivesAt?: number };

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function seed(): StoredTask[] {
  const now = Date.now();
  return (tasksJson as SeedTask[]).map(({ arrivesInMs, ...t }) => ({
    ...t,
    status: t.status as RequestStatus,
    materials: t.materials as Material[],
    scheduledDate: todayISO(),
    updatedAt: new Date(now).toISOString(),
    arrivesAt: arrivesInMs ? now + arrivesInMs : undefined,
  }));
}

let memory: StoredTask[] | null = null;

function load(): StoredTask[] {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return (memory = JSON.parse(raw) as StoredTask[]);
  } catch {
    /* storage indisponível: segue em memória */
  }
  return (memory = seed());
}

function save(tasks: StoredTask[]): void {
  memory = tasks;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    /* idem */
  }
}

const delay = () => new Promise((r) => setTimeout(r, LATENCY_MS));

// "Chegada ao local": assigned → in_service quando o tempo do mock passa.
function advance(tasks: StoredTask[]): void {
  const now = Date.now();
  let changed = false;
  for (const t of tasks) {
    if (t.status === 'assigned' && t.arrivesAt && t.arrivesAt <= now) {
      t.status = 'in_service';
      t.updatedAt = new Date().toISOString();
      t.arrivesAt = undefined;
      changed = true;
    }
  }
  if (changed) save(tasks);
}

function find(tasks: StoredTask[], id: string): StoredTask {
  const task = tasks.find((t) => t.id === id);
  if (!task) throw new ApiError(404, 'Coleta não encontrada');
  return task;
}

export const mockApi: CollectorApi = {
  async listTasks() {
    await delay();
    const tasks = load();
    advance(tasks);
    return tasks.map(({ arrivesAt: _arrivesAt, ...t }) => t);
  },

  async completeTask(id) {
    await delay();
    const tasks = load();
    advance(tasks);
    const task = find(tasks, id);
    if (!COMPLETABLE_STATUSES.includes(task.status)) throw new ApiError(409, 'A coleta ainda não está no local');
    task.status = 'completed';
    task.updatedAt = new Date().toISOString();
    save(tasks);
  },

  async cancelTask(id) {
    await delay();
    const tasks = load();
    advance(tasks);
    const task = find(tasks, id);
    if (!CANCELABLE_STATUSES.includes(task.status)) throw new ApiError(409, 'Esta coleta não pode mais ser cancelada');
    task.status = 'cancelled';
    task.arrivesAt = undefined;
    task.updatedAt = new Date().toISOString();
    save(tasks);
  },

  async reportIssue(id, report) {
    await delay();
    const tasks = load();
    advance(tasks);
    const task = find(tasks, id);
    if (!ISSUE_STATUSES.includes(task.status)) throw new ApiError(409, 'A coleta não está no local');
    if (report.rescheduleDate) {
      task.status = 'pending';
      task.scheduledDate = report.rescheduleDate;
      task.notes = `Não coletado (${report.details?.trim() || report.reason}). Remarcada.`;
    } else {
      task.status = 'cancelled';
      task.notes = `Não coletado (${report.details?.trim() || report.reason}).`;
    }
    task.arrivesAt = undefined;
    task.updatedAt = new Date().toISOString();
    save(tasks);
  },
};

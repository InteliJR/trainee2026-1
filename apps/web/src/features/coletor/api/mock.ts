// Backend simulado para o front do coletor andar sem a API (PLANO.md: "front não espera o back").
// Dados vêm de `../mocks/tasks.json`; o que o coletor faz fica em localStorage.
// Ative a API real com VITE_USE_MOCK=false.
//
// Simula também o que o backend faz de verdade:
//  - uma coleta `assigned` vira `in_service` sozinha depois de um tempo (a API real exige POST .../inicio,
//    mas no mock isso é automático para poder testar sem clicar em nada);
//  - `startTask` também move `assigned` -> `in_service` na hora, para quem quiser testar o botão;
//  - só se conclui uma coleta `in_service`;
//  - só se cancela o que está `assigned` ou `in_service` (a API real só deixa o morador cancelar —
//    aqui no mock isso continua liberado para o coletor testar a tela).
import type { RequestStatus } from '@ecorota/shared';
import { CANCELABLE_STATUSES, COMPLETABLE_STATUSES, STARTABLE_STATUSES, type Material } from '../config';
import tasksJson from '../mocks/tasks.json';
import { ApiError } from './errors';
import type { CollectorAddress, CollectorApi, CollectorAvailability, CollectorPoints, CollectorTask } from './types';

const STORAGE_KEY = 'ecorota.mock.coletor.v2';
const AVAILABILITY_KEY = 'ecorota.mock.coletor.availability.v2';
const LATENCY_MS = 250;

interface SeedTask {
  id: string;
  status: string;
  materials: string[];
  address: CollectorAddress;
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

// Disponibilidade: coletor começa disponível por padrão, com um turno já definido pelo time.
const DEFAULT_SHIFT = 'Manhã';
let availabilityMemory: CollectorAvailability | null = null;

function loadAvailability(): CollectorAvailability {
  if (availabilityMemory) return availabilityMemory;
  try {
    const raw = localStorage.getItem(AVAILABILITY_KEY);
    if (raw) return (availabilityMemory = JSON.parse(raw) as CollectorAvailability);
  } catch {
    /* storage indisponível: segue em memória */
  }
  return (availabilityMemory = {
    available: true,
    shift: DEFAULT_SHIFT,
    syncStatus: 'SYNCED',
    updatedAt: new Date().toISOString(),
  });
}

function saveAvailability(available: boolean): CollectorAvailability {
  const current = loadAvailability();
  const next: CollectorAvailability = { ...current, available, syncStatus: 'SYNCED', updatedAt: new Date().toISOString() };
  availabilityMemory = next;
  try {
    localStorage.setItem(AVAILABILITY_KEY, JSON.stringify(next));
  } catch {
    /* idem */
  }
  return next;
}

const delay = () => new Promise((r) => setTimeout(r, LATENCY_MS));

// "Chegada ao local": assigned → in_service quando o tempo do mock passa (substitui o POST .../inicio real).
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

  async startTask(id) {
    await delay();
    const tasks = load();
    advance(tasks);
    const task = find(tasks, id);
    if (!STARTABLE_STATUSES.includes(task.status)) throw new ApiError(409, 'Esta coleta não está atribuída a você');
    task.status = 'in_service';
    task.arrivesAt = undefined;
    task.updatedAt = new Date().toISOString();
    save(tasks);
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

  async cancelTask(id, reason) {
    await delay();
    const tasks = load();
    advance(tasks);
    const task = find(tasks, id);
    if (!CANCELABLE_STATUSES.includes(task.status)) throw new ApiError(409, 'Esta coleta não pode mais ser cancelada');
    task.status = 'cancelled';
    task.notes = reason;
    task.arrivesAt = undefined;
    task.updatedAt = new Date().toISOString();
    save(tasks);
  },

  async getPoints() {
    await delay();
    const tasks = load();
    advance(tasks);
    // Deriva o extrato das coletas concluídas no mock, com 15 pontos fixos por coleta (a API real não
    // expõe essa regra ao front; é só um valor de demonstração).
    const entries = tasks
      .filter((t) => t.status === 'completed')
      .map((t) => ({
        id: `mock-${t.id}`,
        requestId: t.id,
        points: 15,
        reason: `Coleta concluída (${t.address.street}, ${t.address.number})`,
        createdAt: t.updatedAt,
      }));
    return { balance: entries.reduce((sum, e) => sum + e.points, 0), entries } satisfies CollectorPoints;
  },

  async getAvailability() {
    await delay();
    return loadAvailability();
  },

  async setAvailability(available) {
    await delay();
    return saveAvailability(available);
  },
};

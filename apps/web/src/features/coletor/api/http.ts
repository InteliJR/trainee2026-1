// Cliente da API real (Fastify, prefixo /api/v1). A API fala em português (status, materiais, endereço);
// esta é a única camada que traduz isso para o vocabulário em inglês usado no resto da tela (RNF07).
import type { RequestStatus } from '@ecorota/shared';
import { endpoints } from './endpoints';
import { ApiError } from './errors';
import type { Material } from '../config';
import type { CollectorApi, CollectorAvailability, CollectorTask } from './types';

// Usa VITE_API_URL quando definida (bypassa o proxy do Vite — no Windows ele tenta ::1 e falha contra
// um Fastify escutando só em IPv4). A API já libera CORS com credenciais para WEB_ORIGIN.
const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api/v1`;

export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
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
    throw new ApiError(res.status, data?.mensagem ?? data?.message ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// AGENDADA não existe no vocabulário interno (nunca aparece pro coletor antes de ser atribuída): tratada como pending.
const STATUS_FROM_API: Record<string, RequestStatus> = {
  AGENDADA: 'pending',
  PENDENTE: 'pending',
  ATRIBUIDA: 'assigned',
  EM_ATENDIMENTO: 'in_service',
  CONCLUIDA: 'completed',
  CANCELADA: 'cancelled',
};

const MATERIAL_FROM_API: Record<string, Material> = {
  PAPEL: 'paper',
  PLASTICO: 'plastic',
  VIDRO: 'glass',
  METAL: 'metal',
  ELETRONICOS: 'electronics',
  ORGANICO: 'organic',
  OUTRO: 'other',
};

interface RequestDTO {
  id: string;
  status: string;
  materiais: { tipo: string }[];
  dataDesejada: string;
  motivoCancelamento: string | null;
  concluidaEm: string | null;
  criadoEm: string;
  endereco: { logradouro: string; numero: string; bairro: string; cidade: string };
}

interface RequestListDTO {
  dados: RequestDTO[];
  paginacao: { pagina: number; limite: number; total: number; totalPaginas: number };
}

// A API não devolve um "atualizado em" genérico: aproxima pela conclusão ou pela criação.
function fromDTO(dto: RequestDTO): CollectorTask {
  return {
    id: dto.id,
    status: STATUS_FROM_API[dto.status] ?? 'pending',
    materials: dto.materiais.map((m) => MATERIAL_FROM_API[m.tipo] ?? 'other'),
    address: {
      street: dto.endereco.logradouro,
      number: dto.endereco.numero,
      district: dto.endereco.bairro,
      city: dto.endereco.cidade,
    },
    scheduledDate: dto.dataDesejada.slice(0, 10),
    notes: dto.motivoCancelamento ?? undefined,
    updatedAt: dto.concluidaEm ?? dto.criadoEm,
  };
}

interface AvailabilityDTO {
  disponivel: boolean;
  turno: string | null;
  statusSincronizacao: 'PENDING' | 'SYNCED' | 'ERROR';
  atualizadoEm: string;
}

function fromAvailabilityDTO(dto: AvailabilityDTO): CollectorAvailability {
  return { available: dto.disponivel, shift: dto.turno, syncStatus: dto.statusSincronizacao, updatedAt: dto.atualizadoEm };
}

export const httpApi: CollectorApi = {
  async listTasks() {
    const list = await request<RequestListDTO>('GET', endpoints.tasks);
    return list.dados.map(fromDTO);
  },
  startTask: (id) => request('POST', endpoints.startTask(id)),
  completeTask: (id, photoUrl) => request('POST', endpoints.completeTask(id), { fotoUrl: photoUrl }),
  cancelTask: (id, reason) => request('POST', endpoints.cancelTask(id), { motivo: reason, confirmado: true }),
  async getAvailability() {
    return fromAvailabilityDTO(await request<AvailabilityDTO>('GET', endpoints.availability));
  },
  async setAvailability(available) {
    // Omite `turno`: o serviço mantém o turno já cadastrado quando o campo não é enviado.
    return fromAvailabilityDTO(await request<AvailabilityDTO>('PATCH', endpoints.availability, { disponivel: available }));
  },
};

// Cliente da API real (Fastify, prefixo /api/v1). A API fala em português (status, materiais, endereço);
// esta é a única camada que traduz isso para o vocabulário em inglês usado no resto da tela (RNF07).
import type { RequestStatus } from '@ecorota/shared';
import { endpoints } from './endpoints';
import { API_BASE } from '../../../lib/api';
import { ROLE_HEADER } from '../../../lib/area';
import { ApiError } from './errors';
import type { Material } from '../config';
import type { CollectorApi, CollectorAvailability, CollectorPoints, CollectorTask } from './types';

// Mesma base do restante do app: proxy do Vite em desenvolvimento (funciona pelo IP da rede, no celular)
// e VITE_API_URL em produção. O proxy aponta para 127.0.0.1, evitando o ::1 que falha no Windows.
const BASE = API_BASE;

export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      credentials: 'include', // JWT em cookie httpOnly
      // A API guarda um cookie por papel; este cliente sempre usa a sessão do coletor.
      headers: body === undefined
        ? { [ROLE_HEADER]: 'COLETOR' }
        : { 'Content-Type': 'application/json', [ROLE_HEADER]: 'COLETOR' },
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

export interface RequestDTO {
  id: string;
  status: string;
  materiais: { tipo: string }[];
  dataDesejada: string;
  motivoCancelamento: string | null;
  concluidaEm: string | null;
  criadoEm: string;
  endereco: { logradouro: string; numero: string; bairro: string; cidade: string; latitude?: number; longitude?: number } | null;
  pontoColeta?: { nome: string; circuito: number; coordenadas?: { latitude: number; longitude: number } } | null;
}

interface RequestListDTO {
  dados: RequestDTO[];
  paginacao: { pagina: number; limite: number; total: number; totalPaginas: number };
}

// Destino da coleta: o ponto de coleta quando existe; senão, o endereço do morador (coletas antigas).
function destinationFromDTO(dto: RequestDTO): CollectorTask['destination'] {
  const point = dto.pontoColeta?.coordenadas;
  if (dto.pontoColeta && point) return { name: dto.pontoColeta.nome, coordinates: [point.longitude, point.latitude] };
  const address = dto.endereco;
  if (address && typeof address.latitude === 'number' && typeof address.longitude === 'number') {
    return { name: `${address.logradouro}, ${address.numero}`, coordinates: [address.longitude, address.latitude] };
  }
  return null;
}

// A API não devolve um "atualizado em" genérico: aproxima pela conclusão ou pela criação.
export function fromDTO(dto: RequestDTO): CollectorTask {
  return {
    id: dto.id,
    status: STATUS_FROM_API[dto.status] ?? 'pending',
    materials: dto.materiais.map((m) => MATERIAL_FROM_API[m.tipo] ?? 'other'),
    address: {
      street: dto.pontoColeta?.nome ?? dto.endereco?.logradouro ?? 'Ponto de coleta',
      number: dto.endereco?.numero ?? '',
      district: dto.pontoColeta ? `Circuito ${dto.pontoColeta.circuito}` : dto.endereco?.bairro ?? '',
      city: dto.endereco?.cidade ?? '',
    },
    destination: destinationFromDTO(dto),
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

interface PointsDTO {
  saldo: number;
  dados: Array<{ id: string; solicitacaoId: string | null; pontos: number; motivo: string; criadoEm: string }>;
}

export const httpApi: CollectorApi = {
  async listTasks() {
    const list = await request<RequestListDTO>('GET', endpoints.tasks);
    return list.dados.map(fromDTO);
  },
  async getPoints() {
    const dto = await request<PointsDTO>('GET', endpoints.points);
    return {
      balance: dto.saldo,
      entries: dto.dados.map((e) => ({ id: e.id, requestId: e.solicitacaoId, points: e.pontos, reason: e.motivo, createdAt: e.criadoEm })),
    } satisfies CollectorPoints;
  },
  startTask: (id) => request('POST', endpoints.startTask(id)),
  completeTask: (id) => request('POST', endpoints.completeTask(id), {}),
  async getAvailability() {
    return fromAvailabilityDTO(await request<AvailabilityDTO>('GET', endpoints.availability));
  },
  async setAvailability(available) {
    // Omite `turno`: o serviço mantém o turno já cadastrado quando o campo não é enviado.
    return fromAvailabilityDTO(await request<AvailabilityDTO>('PATCH', endpoints.availability, { disponivel: available }));
  },
};

// Envia a posição do coletor durante a coleta; o painel do operador acompanha em tempo real.
export function sharePosition(coordinates: [number, number], accuracyMeters: number | null): Promise<unknown> {
  const [longitude, latitude] = coordinates;
  return request('POST', '/coletor/posicao', accuracyMeters === null ? { latitude, longitude } : { latitude, longitude, precisao: accuracyMeters });
}

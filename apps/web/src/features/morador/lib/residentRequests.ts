import type { CollectionPoint, ResidentRequestDraft, ResidentCollectionRequest } from '../types';
import { ApiError } from '../../../lib/api';
import { cancelRequestInApi, createRequestInApi, fetchResidentRequests } from './residentApi';

// Última lista recebida da API, para abrir as telas já com dados reais antes da nova consulta.
const API_CACHE_KEY = 'ecorota:resident-requests:api:v1';
// Muda a cada limpeza do cache; uma consulta iniciada antes de sair da conta não pode regravá-lo depois.
let cacheEpoch = 0;

export interface CreateRequestResult {
  request: ResidentCollectionRequest;
}

function readList(key: string): ResidentCollectionRequest[] | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ResidentCollectionRequest[]) : null;
  } catch {
    return null;
  }
}

function writeList(key: string, requests: ResidentCollectionRequest[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(requests));
  } catch {
    // The in-memory UI still works when browser storage is unavailable.
  }
}

// Mostra apenas solicitações reais da conta autenticada.
export function getResidentRequests(): ResidentCollectionRequest[] {
  return readList(API_CACHE_KEY) ?? [];
}

// O resumo pessoal usa apenas solicitações retornadas pela API; null enquanto nada foi carregado.
export function getCachedResidentRequests(): ResidentCollectionRequest[] | null {
  return readList(API_CACHE_KEY);
}

// Atualiza uma solicitação no cache da última lista vinda da API.
export function updateResidentRequest(request: ResidentCollectionRequest) {
  const fromApi = readList(API_CACHE_KEY) ?? [];
  writeList(API_CACHE_KEY, fromApi.map((item) => (item.id === request.id ? request : item)));
}

// Busca as solicitações reais; devolve null quando a API está fora do ar ou o morador não está logado.
export async function refreshResidentRequests(): Promise<ResidentCollectionRequest[] | null> {
  const epoch = cacheEpoch;
  try {
    const requests = await fetchResidentRequests();
    // Descarta a resposta se o morador saiu (ou outra conta entrou) enquanto a consulta estava em andamento.
    if (epoch !== cacheEpoch) return null;
    writeList(API_CACHE_KEY, requests);
    return requests;
  } catch (error) {
    if (!(error instanceof ApiError)) console.error('Falha ao buscar solicitações do morador', error);
    return null;
  }
}

// Cria na API; qualquer erro (validação ou falta de conexão) chega à tela.
export async function createResidentRequest(
  draft: ResidentRequestDraft,
  point: CollectionPoint,
): Promise<CreateRequestResult> {
  const request = await createRequestInApi(draft, point);
  writeList(API_CACHE_KEY, [request, ...(readList(API_CACHE_KEY) ?? [])]);
  return { request };
}

// Cancela na API e só então marca como cancelada no cache.
export async function cancelResidentRequest(request: ResidentCollectionRequest): Promise<ResidentCollectionRequest> {
  await cancelRequestInApi(request.id);
  const cancelled = { ...request, status: 'cancelled' as const };
  updateResidentRequest(cancelled);
  return cancelled;
}

// Apaga a lista da API guardada no aparelho; usada ao sair da conta.
export function clearResidentCache() {
  cacheEpoch += 1;
  try {
    window.localStorage.removeItem(API_CACHE_KEY);
  } catch {
    // Sem acesso ao armazenamento, não há cache a limpar.
  }
}

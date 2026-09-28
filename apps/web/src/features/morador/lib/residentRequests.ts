import type { CollectionPoint, ResidentRequestDraft, ResidentCollectionRequest } from '../types';
import { materialOptions, shiftOptions } from '../data/mockSolicitacao';
import { residentRequests } from '../data/mockAcompanhamento';
import { ApiError } from '../../../lib/api';
import {
  buildTimeline,
  cancelRequestInApi,
  createRequestInApi,
  fetchResidentRequests,
} from './residentApi';

// Solicitações criadas em modo demonstração (API fora do ar) ficam só neste dispositivo.
const STORAGE_KEY = 'ecorota:resident-requests:v1';
// Última lista recebida da API, para abrir as telas já com dados reais antes da nova consulta.
const API_CACHE_KEY = 'ecorota:resident-requests:api:v1';
// Muda a cada limpeza do cache; uma consulta iniciada antes de sair da conta não pode regravá-lo depois.
let cacheEpoch = 0;

export interface CreateRequestResult {
  request: ResidentCollectionRequest;
  source: 'api' | 'demo';
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

// Com dados da API em cache, mostra só eles; sem API, mostra os pedidos de demonstração e os exemplos.
export function getResidentRequests(): ResidentCollectionRequest[] {
  const fromApi = readList(API_CACHE_KEY);
  if (fromApi) return fromApi;
  const stored = readList(STORAGE_KEY) ?? [];
  return [...stored, ...residentRequests.filter((mock) => !stored.some((item) => item.id === mock.id))];
}

// Atualiza uma solicitação na lista de onde ela veio (cache da API ou demonstração).
export function updateResidentRequest(request: ResidentCollectionRequest) {
  const fromApi = readList(API_CACHE_KEY);
  if (fromApi?.some((item) => item.id === request.id)) {
    writeList(API_CACHE_KEY, fromApi.map((item) => (item.id === request.id ? request : item)));
    return;
  }
  const stored = readList(STORAGE_KEY) ?? [];
  writeList(STORAGE_KEY, [request, ...stored.filter((item) => item.id !== request.id)]);
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

// Cria na API; só cai no modo demonstração quando não há conexão. Erros de validação chegam à tela.
export async function createResidentRequest(
  draft: ResidentRequestDraft,
  point: CollectionPoint,
): Promise<CreateRequestResult> {
  try {
    const request = await createRequestInApi(draft, point);
    writeList(API_CACHE_KEY, [request, ...(readList(API_CACHE_KEY) ?? [])]);
    return { request, source: 'api' };
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 0) throw error;
    const request = buildDemoRequest(draft, point);
    updateResidentRequest(request);
    return { request, source: 'demo' };
  }
}

// Cancela na API quando a solicitação veio de lá; pedidos de demonstração são cancelados só localmente.
export async function cancelResidentRequest(request: ResidentCollectionRequest): Promise<ResidentCollectionRequest> {
  const fromApi = readList(API_CACHE_KEY)?.some((item) => item.id === request.id) ?? false;
  if (fromApi) await cancelRequestInApi(request.id);
  const cancelled = { ...request, status: 'cancelled' as const };
  updateResidentRequest(cancelled);
  return cancelled;
}

function buildDemoRequest(draft: ResidentRequestDraft, point: CollectionPoint): ResidentCollectionRequest {
  const material = materialOptions.find((item) => item.id === draft.materialId);
  const shift = shiftOptions.find((item) => item.id === draft.shift);
  if (!material || !shift) throw new Error('Complete os dados da coleta antes de continuar.');
  const id = `pedido-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
  return {
    id,
    externalReference: id,
    protocol: `ECO-${id.slice(-6).toUpperCase()}`,
    materialId: material.id,
    materialName: material.name,
    pointName: point.name,
    pointAddress: point.address,
    neighborhood: point.neighborhood,
    scheduledDate: draft.desiredDate,
    shiftLabel: shift.label,
    shiftWindow: shift.window,
    status: 'pending',
    collectorName: null,
    collectorPhone: null,
    estimatedArrival: null,
    pointsPreview: material.points,
    timeline: buildTimeline(new Date().toISOString()),
  };
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

import type { ResidentRequestDraft, ResidentCollectionRequest } from '../types';
import { collectionPoints, materialOptions, shiftOptions } from '../data/mockSolicitacao';
import { residentRequests } from '../data/mockAcompanhamento';

const STORAGE_KEY = 'ecorota:resident-requests:v1';

export interface CreateRequestResult {
  request: ResidentCollectionRequest;
  source: 'api' | 'demo';
}

interface ApiRequestResponse {
  id?: string;
  externalReference?: string;
  referenciaExterna?: string;
  status?: ResidentCollectionRequest['status'];
  createdAt?: string;
}

function readStoredRequests(): ResidentCollectionRequest[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ResidentCollectionRequest[]) : [];
  } catch {
    return [];
  }
}

function writeStoredRequests(requests: ResidentCollectionRequest[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
  } catch {
    // The in-memory UI still works when browser storage is unavailable.
  }
}

export function getResidentRequests(): ResidentCollectionRequest[] {
  const stored = readStoredRequests();
  return [...stored, ...residentRequests.filter((mock) => !stored.some((item) => item.id === mock.id))];
}

export function updateResidentRequest(request: ResidentCollectionRequest) {
  const stored = readStoredRequests();
  writeStoredRequests([request, ...stored.filter((item) => item.id !== request.id)]);
}

export async function refreshResidentRequests(): Promise<ResidentCollectionRequest[] | null> {
  const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');
  try {
    const response = await fetch(`${baseUrl}/me/requests`, { credentials: 'include' });
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    const apiRequests = Array.isArray(payload)
      ? payload
      : payload && typeof payload === 'object' && 'requests' in payload && Array.isArray(payload.requests)
        ? payload.requests
        : null;
    if (!apiRequests) return null;
    const normalized = apiRequests.filter(isResidentRequest);
    normalized.forEach(updateResidentRequest);
    return getResidentRequests();
  } catch {
    return null;
  }
}

function isResidentRequest(value: unknown): value is ResidentCollectionRequest {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<ResidentCollectionRequest>;
  return typeof item.id === 'string' && typeof item.protocol === 'string' &&
    typeof item.materialName === 'string' && typeof item.pointName === 'string' &&
    typeof item.scheduledDate === 'string' && Array.isArray(item.timeline) &&
    ['pending', 'assigned', 'in_service', 'completed', 'cancelled'].includes(String(item.status));
}

export async function createResidentRequest(draft: ResidentRequestDraft): Promise<CreateRequestResult> {
  const point = collectionPoints.find((item) => item.id === draft.pointId);
  const material = materialOptions.find((item) => item.id === draft.materialId);
  const shift = shiftOptions.find((item) => item.id === draft.shift);
  if (!point || !material || !shift) throw new Error('Complete os dados da coleta antes de continuar.');

  const payload = {
    externalReference: `pedido-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`,
    pointId: point.id,
    material: material.id,
    desiredDate: draft.desiredDate,
    shift: shift.id,
    notes: draft.notes.trim() || undefined,
  };
  const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');

  try {
    const response = await fetch(`${baseUrl}/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const message = await response.text().catch(() => '');
      throw new Error(message || `A API respondeu com status ${response.status}.`);
    }
    const apiRequest = (await response.json().catch(() => ({}))) as ApiRequestResponse;
    const request = buildResidentRequest(draft, {
      id: apiRequest.id ?? apiRequest.externalReference ?? payload.externalReference,
      externalReference: apiRequest.referenciaExterna ?? apiRequest.externalReference ?? payload.externalReference,
      status: apiRequest.status ?? 'pending',
    });
    updateResidentRequest(request);
    return { request, source: 'api' };
  } catch {
    const request = buildResidentRequest(draft, {
      id: payload.externalReference,
      externalReference: payload.externalReference,
      status: 'pending',
    });
    updateResidentRequest(request);
    return { request, source: 'demo' };
  }
}

function buildResidentRequest(
  draft: ResidentRequestDraft,
  result: { id: string; externalReference: string; status: ResidentCollectionRequest['status'] },
): ResidentCollectionRequest {
  const point = collectionPoints.find((item) => item.id === draft.pointId)!;
  const material = materialOptions.find((item) => item.id === draft.materialId)!;
  const shift = shiftOptions.find((item) => item.id === draft.shift)!;
  const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return {
    id: result.id,
    externalReference: result.externalReference,
    protocol: `ECO-${result.id.slice(-6).toUpperCase()}`,
    materialId: material.id,
    materialName: material.name,
    pointName: point.name,
    pointAddress: point.address,
    neighborhood: point.neighborhood,
    scheduledDate: draft.desiredDate,
    shiftLabel: shift.label,
    shiftWindow: shift.window,
    status: result.status,
    collectorName: null,
    collectorPhone: null,
    estimatedArrival: null,
    pointsPreview: material.points,
    timeline: [
      { status: 'pending', label: 'Solicitação recebida', occurredAt: now, description: 'Seu pedido entrou na fila do ponto selecionado.' },
      { status: 'assigned', label: 'Coletor a caminho', occurredAt: null, description: 'Você será avisado quando um coletor assumir.' },
      { status: 'in_service', label: 'Coletor no local', occurredAt: null, description: 'O coletor confirma a chegada antes da retirada.' },
      { status: 'completed', label: 'Coleta concluída', occurredAt: null, description: 'Os pontos serão creditados após a conclusão.' },
    ],
  };
}

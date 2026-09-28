import { apiRequest } from '../../lib/api';

export type CollectionPointKind = 'HABITUAL' | 'ADICIONAL';

export interface LocalCollectionPoint {
  id: string;
  nome: string;
  tipo: CollectionPointKind;
  coordenadas: {
    latitude: number;
    longitude: number;
  };
  circuito: number;
  descricao: string | null;
  ativo: boolean;
  criadoPorUsuarioId: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface CollectionPointInput {
  nome: string;
  tipo: CollectionPointKind;
  latitude: number;
  longitude: number;
  circuito: number;
  descricao?: string;
  ativo?: boolean;
}

export interface CollectionPointFilters {
  tipo?: CollectionPointKind;
  circuito?: number;
  ativo?: boolean;
}

interface CollectionPointListResponse {
  dados: LocalCollectionPoint[];
  total: number;
}

function queryString(filters: CollectionPointFilters): string {
  const query = new URLSearchParams();
  if (filters.tipo) query.set('tipo', filters.tipo);
  if (filters.circuito !== undefined) query.set('circuito', String(filters.circuito));
  if (filters.ativo !== undefined) query.set('ativo', String(filters.ativo));
  const value = query.toString();
  return value ? `?${value}` : '';
}

export function listCollectionPoints(filters: CollectionPointFilters = {}): Promise<CollectionPointListResponse> {
  return apiRequest('GET', `/operacao/pontos-coleta${queryString(filters)}`);
}

export function createCollectionPoint(input: CollectionPointInput): Promise<LocalCollectionPoint> {
  return apiRequest('POST', '/operacao/pontos-coleta', input);
}

export function updateCollectionPoint(id: string, input: Partial<CollectionPointInput>): Promise<LocalCollectionPoint> {
  return apiRequest('PATCH', `/operacao/pontos-coleta/${encodeURIComponent(id)}`, input);
}

export function archiveCollectionPoint(id: string): Promise<void> {
  return apiRequest('DELETE', `/operacao/pontos-coleta/${encodeURIComponent(id)}`);
}

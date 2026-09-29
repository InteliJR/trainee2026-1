/**
 * Seleção das solicitações exibidas na tabela de recentes do painel operacional.
 * Fica fora do componente para que ordenação, filtro e cruzamento com pontos/coletores sejam testados isoladamente.
 */
import type { RealtimeRequestStatus, RealtimeSnapshot } from '../../realtime/socketClient';

// Agrupa os status nos filtros rápidos oferecidos ao operador.
export type RequestFilter = 'todas' | 'ativas' | 'concluidas' | 'canceladas';

// Define quais status pertencem a cada filtro.
const FILTER_STATUSES: Record<RequestFilter, readonly RealtimeRequestStatus[] | null> = {
  todas: null,
  ativas: ['pending', 'assigned', 'in_service'],
  concluidas: ['completed'],
  canceladas: ['cancelled'],
};

// Linha pronta para a tabela, já com os nomes de ponto e coletor resolvidos.
export interface RecentRequestRow {
  id: string;
  externalReference: string;
  status: RealtimeRequestStatus;
  pointId: string;
  pointName: string;
  collectorName: string | null;
  createdAt: string;
  updatedAt: string;
}

// Ordena pela última atualização, aplica o filtro e resolve nomes a partir do próprio snapshot.
export function selectRecentRequests(
  snapshot: RealtimeSnapshot | null,
  { filter = 'todas', limit = 15 }: { filter?: RequestFilter; limit?: number } = {},
): RecentRequestRow[] {
  if (!snapshot) return [];
  // Indexa pontos e coletores uma vez para não percorrer as listas a cada solicitação.
  const pointNames = new Map(snapshot.points.map((point) => [point.id, point.name]));
  const collectorNames = new Map(snapshot.collectors.map((collector) => [collector.id, collector.name]));
  const allowed = FILTER_STATUSES[filter];

  return snapshot.requests
    .filter((request) => !allowed || allowed.includes(request.status))
    // Datas inválidas vão para o fim em vez de quebrar a ordenação.
    .sort((a, b) => timestamp(b.updatedAt) - timestamp(a.updatedAt))
    .slice(0, limit)
    .map((request) => ({
      id: request.id,
      externalReference: request.externalReference,
      status: request.status,
      pointId: request.pointId,
      // Mostra o próprio ID quando o ponto ainda não chegou no snapshot.
      pointName: pointNames.get(request.pointId) ?? request.pointId,
      collectorName: request.collectorId ? collectorNames.get(request.collectorId) ?? request.collectorId : null,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    }));
}

// Conta quantas solicitações existem em cada filtro, para exibir junto aos botões.
export function countByFilter(snapshot: RealtimeSnapshot | null): Record<RequestFilter, number> {
  const counts: Record<RequestFilter, number> = { todas: 0, ativas: 0, concluidas: 0, canceladas: 0 };
  for (const request of snapshot?.requests ?? []) {
    counts.todas += 1;
    if (FILTER_STATUSES.ativas!.includes(request.status)) counts.ativas += 1;
    if (request.status === 'completed') counts.concluidas += 1;
    if (request.status === 'cancelled') counts.canceladas += 1;
  }
  return counts;
}

// Converte datas ISO em milissegundos, tratando valores inválidos como os mais antigos.
function timestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

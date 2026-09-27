/** Decide quais snapshots/eventos EcoRota alteram solicitações locais e resume o resultado da reconciliação. */
import type {
  EcoRotaEventMessage,
  EcoRotaRequest,
  EcoRotaSnapshot,
} from '../ecorotaClient.js';
import type {
  EcoRotaRequestSyncRepository,
  RequestSynchronizationResult,
} from './ecorotaRequestSync.repository.js';

// Restringe sincronização persistente aos eventos que carregam uma solicitação.
const REQUEST_EVENT_TYPES = new Set([
  'request.created',
  'request.assigned',
  'request.started',
  'request.completed',
  'request.cancelled',
  'request.requeued',
]);

// Conta os resultados de uma reconciliação integral para logs e diagnóstico.
export interface SnapshotSynchronizationSummary {
  updated: number;
  unchanged: number;
  duplicate: number;
  notFound: number;
}

// Percorre snapshots e encaminha eventos relevantes ao repositório idempotente.
export class EcoRotaDomainSynchronizer {
  // Recebe a operação idempotente sem acoplar a orquestração ao Prisma.
  constructor(private readonly repository: EcoRotaRequestSyncRepository) {}

  // Reconcilia cada solicitação do snapshot e acumula um resumo para observabilidade.
  async synchronizeSnapshot(snapshot: EcoRotaSnapshot): Promise<SnapshotSynchronizationSummary> {
    const summary: SnapshotSynchronizationSummary = {
      updated: 0,
      unchanged: 0,
      duplicate: 0,
      notFound: 0,
    };

    // Processa separadamente para preservar idempotência e contabilizar cada resultado.
    for (const request of snapshot.requests) {
      const result = await this.repository.synchronizeRequest(request, {
        eventId: `snapshot:${snapshot.generation}:${snapshot.revision}:${request.id}`,
        generation: snapshot.generation,
        revision: snapshot.revision,
        occurredAt: this.parseDate(request.updatedAt, snapshot.observedAt),
      });
      this.increment(summary, result);
    }
    return summary;
  }

  // Ignora eventos não relacionados a pedidos e sincroniza os demais individualmente.
  async synchronizeEvent(event: EcoRotaEventMessage): Promise<RequestSynchronizationResult | 'ignored'> {
    // Eventos de coletor, rota e simulação pertencem ao cache, não ao domínio de solicitações.
    if (!REQUEST_EVENT_TYPES.has(event.type)) return 'ignored';
    const request = event.data as EcoRotaRequest;
    return this.repository.synchronizeRequest(request, {
      eventId: event.id,
      generation: event.generation,
      revision: event.revision,
      occurredAt: this.parseDate(event.occurredAt, request.updatedAt),
      recordUnchanged: true,
    });
  }

  // Atualiza exatamente o contador correspondente ao resultado retornado pelo repositório.
  private increment(summary: SnapshotSynchronizationSummary, result: RequestSynchronizationResult): void {
    // Incrementa um único contador conforme o resultado mutuamente exclusivo.
    if (result === 'not_found') summary.notFound += 1;
    else if (result === 'duplicate') summary.duplicate += 1;
    else if (result === 'updated') summary.updated += 1;
    else summary.unchanged += 1;
  }

  // Usa a data principal quando válida e recorre à alternativa fornecida pela origem.
  private parseDate(primary: string, fallback: string): Date {
    const parsed = new Date(primary);
    return Number.isNaN(parsed.getTime()) ? new Date(fallback) : parsed;
  }
}

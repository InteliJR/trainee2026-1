import type {
  EcoRotaEventMessage,
  EcoRotaRequest,
  EcoRotaSnapshot,
} from '../ecorotaClient.js';
import type {
  EcoRotaRequestSyncRepository,
  RequestSynchronizationResult,
} from './ecorotaRequestSync.repository.js';

const REQUEST_EVENT_TYPES = new Set([
  'request.created',
  'request.assigned',
  'request.started',
  'request.completed',
  'request.cancelled',
  'request.requeued',
]);

export interface SnapshotSynchronizationSummary {
  updated: number;
  unchanged: number;
  duplicate: number;
  notFound: number;
}

export class EcoRotaDomainSynchronizer {
  constructor(private readonly repository: EcoRotaRequestSyncRepository) {}

  async synchronizeSnapshot(snapshot: EcoRotaSnapshot): Promise<SnapshotSynchronizationSummary> {
    const summary: SnapshotSynchronizationSummary = {
      updated: 0,
      unchanged: 0,
      duplicate: 0,
      notFound: 0,
    };

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

  async synchronizeEvent(event: EcoRotaEventMessage): Promise<RequestSynchronizationResult | 'ignored'> {
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

  private increment(summary: SnapshotSynchronizationSummary, result: RequestSynchronizationResult): void {
    if (result === 'not_found') summary.notFound += 1;
    else if (result === 'duplicate') summary.duplicate += 1;
    else if (result === 'updated') summary.updated += 1;
    else summary.unchanged += 1;
  }

  private parseDate(primary: string, fallback: string): Date {
    const parsed = new Date(primary);
    return Number.isNaN(parsed.getTime()) ? new Date(fallback) : parsed;
  }
}

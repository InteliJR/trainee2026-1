import { randomUUID } from 'node:crypto';
import type { Collector, Point } from '@ecorota/shared';
import type {
  CreateEcoRotaRequestInput,
  EcoRotaClient,
  EcoRotaEnvelope,
  EcoRotaRequest,
  EcoRotaSnapshot,
  UpdateEcoRotaCollectorInput,
} from '../ecorotaClient.js';

export class FakeEcoRotaClient implements EcoRotaClient {
  private revision = 0;
  private readonly generation = 1;
  private readonly requests = new Map<string, EcoRotaRequest>();
  private readonly points: Point[] = [];
  private readonly collectors: Collector[] = [];

  async createRequest(input: CreateEcoRotaRequestInput): Promise<EcoRotaEnvelope<EcoRotaRequest>> {
    const existing = [...this.requests.values()].find(
      (request) => request.pointId === input.pointId && request.externalReference === input.externalReference,
    );
    if (existing) return this.envelope(existing);

    const now = new Date().toISOString();
    const request: EcoRotaRequest = {
      id: randomUUID(),
      pointId: input.pointId,
      externalReference: input.externalReference,
      status: 'pending',
      collectorId: null,
      createdAt: now,
      createdSimulationTime: Date.now(),
      updatedAt: now,
    };
    this.requests.set(request.id, request);
    this.revision += 1;
    return this.envelope(request);
  }

  async cancelRequest(requestId: string): Promise<EcoRotaEnvelope<EcoRotaRequest>> {
    return this.changeStatus(requestId, 'cancelled');
  }

  async completeRequest(requestId: string): Promise<EcoRotaEnvelope<EcoRotaRequest>> {
    return this.changeStatus(requestId, 'completed');
  }

  async getSnapshot(): Promise<EcoRotaEnvelope<EcoRotaSnapshot>> {
    return this.envelope({
      id: 'fake-environment',
      name: 'Ambiente falso',
      generation: this.generation,
      revision: this.revision,
      simulationTime: Date.now(),
      paused: false,
      observedAt: new Date().toISOString(),
      maxCollectors: 4,
      occupiedSlots: this.collectors.length,
      tickMs: 1_000,
      pollIntervalMs: 5_000,
      points: [...this.points],
      collectors: [...this.collectors],
      routes: [],
      requests: [...this.requests.values()],
      eventCursor: String(this.revision),
    });
  }

  async listPoints(): Promise<EcoRotaEnvelope<Point[]>> {
    return this.envelope([...this.points]);
  }

  async listCollectors(): Promise<EcoRotaEnvelope<Collector[]>> {
    return this.envelope([...this.collectors]);
  }

  async updateCollector(id: string, input: UpdateEcoRotaCollectorInput): Promise<EcoRotaEnvelope<Collector>> {
    const collector = this.collectors.find((item) => item.id === id);
    if (!collector) throw new Error('Coletor falso não encontrado.');
    Object.assign(collector, input, { observedAt: new Date().toISOString() });
    this.revision += 1;
    return this.envelope(collector);
  }

  private async changeStatus(id: string, status: EcoRotaRequest['status']): Promise<EcoRotaEnvelope<EcoRotaRequest>> {
    const request = this.requests.get(id);
    if (!request) throw new Error('Solicitação falsa não encontrada.');
    request.status = status;
    request.updatedAt = new Date().toISOString();
    this.revision += 1;
    return this.envelope(request);
  }

  private envelope<T>(data: T): EcoRotaEnvelope<T> {
    return {
      data,
      revision: this.revision,
      generation: this.generation,
      simulationTime: Date.now(),
      observedAt: new Date().toISOString(),
    };
  }
}


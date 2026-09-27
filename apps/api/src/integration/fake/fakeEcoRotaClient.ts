/** Adaptador EcoRota em memória usado para testes e verificação local sem rede nem credencial externa. */
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

// Mantém solicitações e coletores em Maps/arrays para reproduzir o contrato sem chamadas de rede.
export class FakeEcoRotaClient implements EcoRotaClient {
  private revision = 0;
  private readonly generation = 1;
  private readonly requests = new Map<string, EcoRotaRequest>();
  private readonly points: Point[] = [];
  private readonly collectors: Collector[] = [];

  // Reutiliza uma solicitação com a mesma referência para simular idempotência externa.
  async createRequest(input: CreateEcoRotaRequestInput): Promise<EcoRotaEnvelope<EcoRotaRequest>> {
    const existing = [...this.requests.values()].find(
      (request) => request.pointId === input.pointId && request.externalReference === input.externalReference,
    );
    // A mesma referência devolve a solicitação anterior sem criar duplicata.
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

  // Delega ao helper comum a mudança para cancelada.
  async cancelRequest(requestId: string): Promise<EcoRotaEnvelope<EcoRotaRequest>> {
    return this.changeStatus(requestId, 'cancelled');
  }

  // Delega ao helper comum a mudança para concluída.
  async completeRequest(requestId: string): Promise<EcoRotaEnvelope<EcoRotaRequest>> {
    return this.changeStatus(requestId, 'completed');
  }

  // Monta um snapshot coerente a partir das coleções atualmente armazenadas em memória.
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

  // Devolve uma cópia dos pontos para evitar mutação acidental do fake.
  async listPoints(): Promise<EcoRotaEnvelope<Point[]>> {
    return this.envelope([...this.points]);
  }

  // Devolve uma cópia dos coletores cadastrados no cenário.
  async listCollectors(): Promise<EcoRotaEnvelope<Collector[]>> {
    return this.envelope([...this.collectors]);
  }

  // Atualiza somente campos presentes e falha quando o ID não existe no cenário.
  async updateCollector(id: string, input: UpdateEcoRotaCollectorInput): Promise<EcoRotaEnvelope<Collector>> {
    const collector = this.collectors.find((item) => item.id === id);
    // Mantém comportamento de recurso inexistente semelhante ao adaptador real.
    if (!collector) throw new Error('Coletor falso não encontrado.');
    Object.assign(collector, input, { observedAt: new Date().toISOString() });
    this.revision += 1;
    return this.envelope(collector);
  }

  // Centraliza transições simples e incremento de revisão das solicitações fake.
  private async changeStatus(id: string, status: EcoRotaRequest['status']): Promise<EcoRotaEnvelope<EcoRotaRequest>> {
    const request = this.requests.get(id);
    // Impede transição de um ID que nunca foi criado no fake.
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

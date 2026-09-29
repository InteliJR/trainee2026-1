/**
 * Cache operacional em memória alimentado pelo WebSocket da EcoRota.
 * Substitui snapshots integralmente, aplica deltas ordenados, rejeita duplicados e avisa REST/Socket.IO sobre mudanças.
 */
import { EventEmitter } from 'node:events';
import type { Collector, Point } from '@ecorota/shared';
import type { EcoRotaEventMessage, EcoRotaRequest, EcoRotaRoute, EcoRotaSnapshot } from '../ecorotaClient.js';

// Define a cópia imutável entregue a REST e Socket.IO ao consultar o cache.
export interface OperationStateSnapshot {
  generation: number;
  revision: number;
  simulationTime: number;
  pollIntervalMs: number;
  paused: boolean;
  observedAt: string;
  points: Point[];
  collectors: Collector[];
  routes: EcoRotaRoute[];
  requests: EcoRotaRequest[];
  eventCursor: string;
  updatedAt: string;
}

// Diferencia atualização integral de evento incremental nas notificações internas.
export type OperationStateEvent =
  | { type: 'operation.snapshot'; payload: OperationStateSnapshot }
  | { type: 'operation.event'; payload: EcoRotaEventMessage };

// Explica ao consumidor por que um evento foi aplicado ou descartado.
export type EventApplicationResult =
  | 'applied'
  | 'duplicate'
  | 'old_revision'
  | 'awaiting_snapshot'
  | 'unknown_event';

// Agrupa eventos que substituem uma solicitação no mapa interno do cache.
const REQUEST_EVENT_TYPES = new Set([
  'request.created',
  'request.assigned',
  'request.started',
  'request.completed',
  'request.cancelled',
  'request.requeued',
]);

// Mantém mapas indexados para atualização eficiente e publica mudanças por EventEmitter.
export class OperationStateStore {
  private readonly emitter = new EventEmitter();
  private generation = -1;
  private revision = -1;
  private simulationTime = 0;
  private pollIntervalMs = 5_000;
  private paused = false;
  private observedAt = new Date(0).toISOString();
  private eventCursor = '';
  private updatedAt = new Date(0).toISOString();
  private readonly points = new Map<string, Point>();
  private readonly collectors = new Map<string, Collector>();
  private readonly routes = new Map<string, EcoRotaRoute>();
  private readonly requests = new Map<string, EcoRotaRequest>();
  private readonly seenIdsAtCurrentRevision = new Set<string>();

  // Substitui todas as coleções e metadados para eliminar resíduos de uma geração anterior.
  replaceSnapshot(snapshot: EcoRotaSnapshot): void {
    this.generation = snapshot.generation;
    this.revision = snapshot.revision;
    this.simulationTime = snapshot.simulationTime;
    this.pollIntervalMs = snapshot.pollIntervalMs;
    this.paused = snapshot.paused;
    this.observedAt = snapshot.observedAt;
    this.eventCursor = snapshot.eventCursor;
    this.updatedAt = new Date().toISOString();
    this.replaceMap(this.points, snapshot.points, (point) => point.id);
    this.replaceMap(this.collectors, snapshot.collectors, (collector) => collector.id);
    this.replaceMap(this.routes, snapshot.routes, (route) => route.collectorId);
    this.replaceMap(this.requests, snapshot.requests, (request) => request.id);
    this.seenIdsAtCurrentRevision.clear();
    this.emitter.emit('update', { type: 'operation.snapshot', payload: this.getSnapshot() } satisfies OperationStateEvent);
  }

  // Valida geração/revisão/duplicidade e aplica apenas eventos que o cache sabe interpretar.
  applyEvent(event: EcoRotaEventMessage): EventApplicationResult {
    // Exige snapshot inicial e não aplica evento de uma geração ainda desconhecida.
    if (this.generation < 0 || event.generation > this.generation) return 'awaiting_snapshot';
    // Rejeita dados pertencentes a geração ou revisão que o cache já ultrapassou.
    if (event.generation < this.generation || event.revision < this.revision) return 'old_revision';
    // Impede aplicar novamente a mesma mensagem recebida na revisão atual.
    if (this.seenIdsAtCurrentRevision.has(event.id)) return 'duplicate';

    // Ao avançar de revisão, reinicia apenas o conjunto local de IDs deduplicados.
    if (event.revision > this.revision) {
      this.revision = event.revision;
      this.seenIdsAtCurrentRevision.clear();
    }

    const applied = this.applyKnownEvent(event);
    // Mantém o cache intacto quando ainda não existe regra para o tipo recebido.
    if (!applied) return 'unknown_event';

    this.seenIdsAtCurrentRevision.add(event.id);
    this.simulationTime = event.simulationTime;
    this.observedAt = event.occurredAt;
    this.updatedAt = new Date().toISOString();
    this.emitter.emit('update', { type: 'operation.event', payload: event } satisfies OperationStateEvent);
    return 'applied';
  }

  // Produz arrays novos para que consumidores não acessem diretamente os Maps internos.
  getSnapshot(): OperationStateSnapshot {
    return {
      generation: this.generation,
      revision: this.revision,
      simulationTime: this.simulationTime,
      pollIntervalMs: this.pollIntervalMs,
      paused: this.paused,
      observedAt: this.observedAt,
      points: [...this.points.values()],
      collectors: [...this.collectors.values()],
      routes: [...this.routes.values()],
      requests: [...this.requests.values()],
      eventCursor: this.eventCursor,
      updatedAt: this.updatedAt,
    };
  }

  // Registra um observador e devolve a função exata necessária para removê-lo no shutdown.
  onUpdate(listener: (event: OperationStateEvent) => void): () => void {
    this.emitter.on('update', listener);
    return () => this.emitter.off('update', listener);
  }

  // Encaminha cada tipo conhecido para a alteração mínima correspondente no estado.
  private applyKnownEvent(event: EcoRotaEventMessage): boolean {
    // Criação e atualização fornecem o objeto completo e podem usar a mesma substituição.
    if (event.type === 'collector.created' || event.type === 'collector.updated') {
      const collector = event.data as Collector;
      this.collectors.set(collector.id, collector);
      return true;
    }
    // Exclusão carrega somente o ID que deve sair do mapa.
    if (event.type === 'collector.deleted') {
      this.collectors.delete((event.data as { id: string }).id);
      return true;
    }
    // Telemetria altera apenas posição e horário, preservando demais dados do coletor.
    if (event.type === 'collector.position_updated') {
      const patch = event.data as Pick<Collector, 'id' | 'position' | 'observedAt'>;
      const current = this.collectors.get(patch.id);
      // Só aplica o patch quando o coletor já foi apresentado por snapshot/criação.
      if (current) this.collectors.set(patch.id, { ...current, ...patch });
      return Boolean(current);
    }
    // Mantém somente a rota mais recente indexada pelo coletor.
    if (event.type === 'route.updated') {
      const route = event.data as EcoRotaRoute;
      this.routes.set(route.collectorId, route);
      return true;
    }
    // Todos os eventos de solicitação fornecem sua nova representação completa.
    if (REQUEST_EVENT_TYPES.has(event.type)) {
      this.applyRequest(event.data as EcoRotaRequest);
      return true;
    }
    // Atualização da simulação altera o sinal global de pausa.
    if (event.type === 'simulation.updated') {
      this.paused = (event.data as { paused: boolean }).paused;
      return true;
    }
    // Incidente/reset são reconhecidos para ordenação, embora não alterem coleções locais.
    if (event.type === 'simulation.incident' || event.type === 'simulation.reset') return true;
    return false;
  }

  // Substitui a solicitação e corrige a demanda do ponto antes/depois da mudança.
  private applyRequest(request: EcoRotaRequest): void {
    const previous = this.requests.get(request.id);
    // Remove a contribuição da versão anterior antes de contabilizar o novo status.
    if (previous) this.changeDemand(previous.pointId, previous.status, -1);
    this.requests.set(request.id, request);
    this.changeDemand(request.pointId, request.status, 1);
  }

  // Incrementa ou decrementa um contador sem permitir valores negativos.
  private changeDemand(pointId: string, status: EcoRotaRequest['status'], delta: number): void {
    const point = this.points.get(pointId);
    // Ignora demanda cujo ponto ainda não apareceu em um snapshot válido.
    if (!point) return;
    point.demand[status] = Math.max(0, point.demand[status] + delta);
    this.points.set(pointId, { ...point, demand: { ...point.demand } });
  }

  // Reconstrói um Map genérico usando a função de chave apropriada a cada coleção.
  private replaceMap<T>(
    target: Map<string, T>,
    values: T[],
    key: (value: T) => string,
  ): void {
    target.clear();
    // Indexa cada item pela chave fornecida sem duplicar IDs.
    for (const value of values) target.set(key(value), value);
  }
}

// Instância única compartilhada pelo servidor real; testes podem criar instâncias isoladas.
export const operationState = new OperationStateStore();

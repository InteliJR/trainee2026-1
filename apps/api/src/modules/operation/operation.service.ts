import type { Actor } from '../../auth/actor.js';
import { AppError } from '../../errors/appError.js';
import type { OperationStateStore } from '../../integration/operation-state/operationState.js';
import type { StreamStatus } from '../../integration/ws/ecoRotaWsConsumer.js';
import type { Collector, Point } from '@ecorota/shared';
import type { GeographicQuery } from './operation.schemas.js';

const CONNECTION_TO_API = {
  stopped: 'PARADA',
  connecting: 'CONECTANDO',
  connected: 'CONECTADA',
  waiting_retry: 'AGUARDANDO_RECONEXAO',
  authentication_error: 'ERRO_DE_CREDENCIAL',
} as const;

const POINT_KIND_TO_API = { habitual: 'HABITUAL', additional: 'ADICIONAL' } as const;
const COLLECTOR_ORIGIN_TO_API = { system: 'SISTEMA', custom: 'PERSONALIZADO' } as const;
const COLLECTOR_STATUS_TO_API: Record<string, string> = {
  idle: 'OCIOSO',
  moving: 'EM_DESLOCAMENTO',
  collecting: 'COLETANDO',
  unavailable: 'INDISPONIVEL',
};

export class OperationService {
  constructor(
    private readonly state: OperationStateStore,
    private readonly statusProvider?: () => StreamStatus,
    private readonly now: () => Date = () => new Date(),
  ) {}

  listPoints(actor: Actor, query: GeographicQuery) {
    this.ensureAuthenticated(actor);
    const snapshot = this.ensureOperationalState();
    const location = this.parseLocation(query);
    const stale = this.isStale(snapshot.observedAt, snapshot.pollIntervalMs);
    const data = snapshot.points
      .map((point) => this.serializePoint(point, stale, location))
      .filter((point) => location.raioKm === undefined || (point.distanciaKm ?? Infinity) <= location.raioKm)
      .sort((left, right) => location.hasCoordinates
        ? (left.distanciaKm ?? Infinity) - (right.distanciaKm ?? Infinity)
        : left.nome.localeCompare(right.nome));

    return {
      dados: data,
      total: data.length,
      observadoEm: snapshot.observedAt,
      dadosDesatualizados: stale,
    };
  }

  getPoint(actor: Actor, pointId: string) {
    this.ensureAuthenticated(actor);
    const snapshot = this.ensureOperationalState();
    const point = snapshot.points.find((item) => item.id === pointId);
    if (!point) {
      throw new AppError({
        statusCode: 404,
        code: 'PONTO_COLETA_NAO_ENCONTRADO',
        message: 'O ponto de coleta não foi encontrado no estado operacional.',
      });
    }
    const stale = this.isStale(snapshot.observedAt, snapshot.pollIntervalMs);
    return {
      ...this.serializePoint(point, stale, { hasCoordinates: false }),
      solicitacoesAtivas: snapshot.requests.filter(
        (request) => request.pointId === pointId && !['completed', 'cancelled'].includes(request.status),
      ).length,
      observadoEm: snapshot.observedAt,
    };
  }

  listAvailableCollectors(actor: Actor, query: GeographicQuery) {
    this.ensureAuthenticated(actor);
    const snapshot = this.ensureOperationalState();
    const location = this.parseLocation(query);
    const data = snapshot.collectors
      .filter((collector) => collector.available)
      .map((collector) => this.serializeCollector(collector, snapshot.pollIntervalMs, location))
      .filter((collector) => location.raioKm === undefined || (collector.distanciaKm ?? Infinity) <= location.raioKm)
      .sort((left, right) => location.hasCoordinates
        ? (left.distanciaKm ?? Infinity) - (right.distanciaKm ?? Infinity)
        : left.nome.localeCompare(right.nome));

    return { dados: data, total: data.length, observadoEm: snapshot.observedAt };
  }

  getIntegrationStatus(actor: Actor) {
    if (actor.role !== 'OPERADOR') {
      throw new AppError({
        statusCode: 403,
        code: 'PAPEL_NAO_AUTORIZADO',
        message: 'Apenas operadores podem consultar o estado da integração.',
      });
    }

    const snapshot = this.state.getSnapshot();
    const stream = this.statusProvider?.();
    return {
      configurada: Boolean(stream),
      conexao: stream ? CONNECTION_TO_API[stream.connection] : 'NAO_CONFIGURADA',
      tentativaReconexao: stream?.reconnectAttempt ?? 0,
      ultimoErro: stream?.lastError ?? null,
      ultimaMensagemEm: stream?.lastMessageAt ?? null,
      generation: snapshot.generation < 0 ? null : snapshot.generation,
      ultimaRevision: snapshot.revision < 0 ? null : snapshot.revision,
      atualizadoEm: snapshot.updatedAt,
      cache: {
        pontos: snapshot.points.length,
        coletores: snapshot.collectors.length,
        rotas: snapshot.routes.length,
        solicitacoes: snapshot.requests.length,
      },
    };
  }

  private ensureAuthenticated(actor: Actor): void {
    if (!actor?.id) {
      throw new AppError({ statusCode: 401, code: 'NAO_AUTENTICADO', message: 'Identidade não informada.' });
    }
  }

  private ensureOperationalState() {
    const snapshot = this.state.getSnapshot();
    if (snapshot.generation < 0) {
      throw new AppError({
        statusCode: 503,
        code: 'DADOS_OPERACIONAIS_INDISPONIVEIS',
        message: 'O backend ainda não recebeu um snapshot da EcoRota.',
      });
    }
    return snapshot;
  }

  private parseLocation(query: GeographicQuery): {
    hasCoordinates: boolean;
    latitude?: number;
    longitude?: number;
    raioKm?: number;
  } {
    const hasLatitude = query.latitude !== undefined;
    const hasLongitude = query.longitude !== undefined;
    if (hasLatitude !== hasLongitude) {
      throw new AppError({
        statusCode: 400,
        code: 'COORDENADAS_INCOMPLETAS',
        message: 'Latitude e longitude devem ser informadas em conjunto.',
      });
    }
    if (query.raioKm !== undefined && !hasLatitude) {
      throw new AppError({
        statusCode: 400,
        code: 'RAIO_SEM_COORDENADAS',
        message: 'O filtro de raio exige latitude e longitude.',
      });
    }
    return {
      hasCoordinates: hasLatitude && hasLongitude,
      latitude: query.latitude,
      longitude: query.longitude,
      raioKm: query.raioKm,
    };
  }

  private serializePoint(
    point: Point,
    stale: boolean,
    location: { hasCoordinates: boolean; latitude?: number; longitude?: number },
  ) {
    const [longitude, latitude] = point.coordinates;
    return {
      id: point.id,
      nome: point.name,
      tipo: POINT_KIND_TO_API[point.kind],
      coordenadas: { latitude, longitude },
      circuito: point.circuit,
      demanda: {
        pendentes: point.demand.pending,
        atribuidas: point.demand.assigned,
        emAtendimento: point.demand.in_service,
        concluidas: point.demand.completed,
        canceladas: point.demand.cancelled,
      },
      distanciaKm: location.hasCoordinates
        ? this.distanceKm(location.latitude!, location.longitude!, latitude, longitude)
        : null,
      dadosDesatualizados: stale,
    };
  }

  private serializeCollector(
    collector: Collector,
    pollIntervalMs: number,
    location: { hasCoordinates: boolean; latitude?: number; longitude?: number },
  ) {
    const coordinates = collector.position?.coordinates;
    const longitude = coordinates?.[0];
    const latitude = coordinates?.[1];
    return {
      id: collector.id,
      nome: collector.name,
      origem: COLLECTOR_ORIGIN_TO_API[collector.origin],
      disponivel: collector.available,
      status: COLLECTOR_STATUS_TO_API[collector.status] ?? collector.status.toUpperCase(),
      circuito: collector.circuit,
      coordenadas: latitude === undefined || longitude === undefined ? null : { latitude, longitude },
      destinoId: collector.destinationId ?? null,
      observadoEm: collector.observedAt,
      telemetriaDesatualizada: this.isStale(collector.observedAt, pollIntervalMs),
      distanciaKm: location.hasCoordinates && latitude !== undefined && longitude !== undefined
        ? this.distanceKm(location.latitude!, location.longitude!, latitude, longitude)
        : null,
    };
  }

  private isStale(observedAt: string, pollIntervalMs: number): boolean {
    const observedTime = new Date(observedAt).getTime();
    if (Number.isNaN(observedTime)) return true;
    return this.now().getTime() - observedTime > Math.max(15_000, pollIntervalMs * 3);
  }

  private distanceKm(latitude1: number, longitude1: number, latitude2: number, longitude2: number): number {
    const toRadians = (degrees: number) => degrees * Math.PI / 180;
    const earthRadiusKm = 6_371;
    const latitudeDelta = toRadians(latitude2 - latitude1);
    const longitudeDelta = toRadians(longitude2 - longitude1);
    const value = Math.sin(latitudeDelta / 2) ** 2
      + Math.cos(toRadians(latitude1)) * Math.cos(toRadians(latitude2))
      * Math.sin(longitudeDelta / 2) ** 2;
    return Number((earthRadiusKm * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))).toFixed(3));
  }
}

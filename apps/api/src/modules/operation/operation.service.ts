/**
 * Transforma o OperationState em respostas REST: pontos próximos, detalhe, coletores e estado da integração.
 * Calcula distância geográfica e sinaliza dados desatualizados sem consultar novamente a EcoRota.
 */
import type { Actor } from '../../auth/actor.js';
import { AppError } from '../../errors/appError.js';
import type { OperationStateStore } from '../../integration/operation-state/operationState.js';
import type { StreamStatus } from '../../integration/ws/ecoRotaWsConsumer.js';
import type { Collector, Point } from '@ecorota/shared';
import type { GeographicQuery } from './operation.schemas.js';
import type {
  IndicatorPeriods,
  OperationIndicatorsRepository,
} from './operationIndicators.repository.js';

// Traduz estados internos do consumidor WSS para nomes públicos em português.
const CONNECTION_TO_API = {
  stopped: 'PARADA',
  connecting: 'CONECTANDO',
  connected: 'CONECTADA',
  waiting_retry: 'AGUARDANDO_RECONEXAO',
  authentication_error: 'ERRO_DE_CREDENCIAL',
} as const;

// Traduz a classificação externa do ponto para o vocabulário da API.
const POINT_KIND_TO_API = { habitual: 'HABITUAL', additional: 'ADICIONAL' } as const;
// Traduz a origem externa do coletor para o contrato público.
const COLLECTOR_ORIGIN_TO_API = { system: 'SISTEMA', custom: 'PERSONALIZADO' } as const;
// Normaliza os estados operacionais conhecidos e permite fallback para estados futuros.
const COLLECTOR_STATUS_TO_API: Record<string, string> = {
  idle: 'OCIOSO',
  moving: 'EM_DESLOCAMENTO',
  collecting: 'COLETANDO',
  unavailable: 'INDISPONIVEL',
};

// Oferece consultas somente de leitura sobre o último estado confirmado em memória.
export class OperationService {
  // Memoriza agregações puramente operacionais e só as recalcula quando geração ou revisão mudam.
  private indicatorCache?: {
    generation: number;
    revision: number;
    value: ReturnType<OperationService['calculateCurrentOperationIndicators']>;
  };

  // Recebe o cache e um provedor opcional da situação da conexão WebSocket.
  constructor(
    private readonly state: OperationStateStore,
    private readonly statusProvider?: () => StreamStatus,
    private readonly now: () => Date = () => new Date(),
    private readonly indicatorsRepository?: OperationIndicatorsRepository,
  ) {}

  // Filtra pontos por raio quando há coordenadas e informa se o snapshot está antigo.
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

  // Localiza um ponto específico ou devolve 404 sem consultar a integração externa.
  getPoint(actor: Actor, pointId: string) {
    this.ensureAuthenticated(actor);
    const snapshot = this.ensureOperationalState();
    const point = snapshot.points.find((item) => item.id === pointId);
    // Diferencia ponto ausente de cache ainda não inicializado.
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

  // Seleciona coletores disponíveis e opcionalmente ordena/filtra pela distância.
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

  // Combina geração/revisão do cache com a telemetria de conexão do consumidor WSS.
  getIntegrationStatus(actor: Actor) {
    // Telemetria detalhada da integração é exclusiva do painel operacional.
    this.ensureOperator(actor, 'Apenas operadores podem consultar o estado da integração.');

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

  // Combina histórico persistido com a projeção atual do cache para alimentar os cards do dashboard.
  async getIndicators(actor: Actor) {
    // Impede que moradores e coletores tenham acesso a métricas administrativas agregadas.
    this.ensureOperator(actor, 'Apenas operadores podem consultar os indicadores operacionais.');
    // Exige um snapshot real para não apresentar zeros como se fossem dados válidos da operação.
    const snapshot = this.ensureOperationalState();
    // A aplicação real sempre injeta o repositório; a guarda evita respostas parciais em montagens incorretas.
    if (!this.indicatorsRepository) {
      throw new AppError({
        statusCode: 503,
        code: 'INDICADORES_HISTORICOS_INDISPONIVEIS',
        message: 'As agregações históricas do painel não estão disponíveis.',
      });
    }

    // Captura uma única referência temporal para que todos os limites pertençam ao mesmo instante.
    const referenceTime = this.now();
    // Calcula os inícios UTC de dia, semana e mês usados tanto na consulta quanto na resposta.
    const periods = this.createIndicatorPeriods(referenceTime);
    // Consulta somente dados próprios; nenhuma chamada à EcoRota é feita durante o carregamento do dashboard.
    const historical = await this.indicatorsRepository.summarize(periods);
    // Reutiliza a projeção quando geração e revisão ainda são as mesmas.
    const current = this.getCachedCurrentOperationIndicators(snapshot);
    // Soma apenas resultados terminais do mês para evitar distorção por solicitações ainda em andamento.
    const terminalCollections = historical.completedCollections.month + historical.cancelledCollectionsInMonth;
    // Evita divisão por zero em meses que ainda não possuem conclusões nem cancelamentos.
    const completionRate = terminalCollections === 0
      ? 0
      : Number((historical.completedCollections.month / terminalCollections * 100).toFixed(2));
    // Calcula telemetria no momento da consulta porque uma posição pode envelhecer sem nova revisão do stream.
    const staleTelemetry = snapshot.collectors.filter(
      (collector) => this.isStale(collector.observedAt, snapshot.pollIntervalMs),
    ).length;

    // Expõe nomes em português e metadados suficientes para o frontend explicar cada indicador.
    return {
      observadoEm: snapshot.observedAt,
      atualizadoEm: snapshot.updatedAt,
      dadosDesatualizados: this.isStale(snapshot.observedAt, snapshot.pollIntervalMs),
      geracao: snapshot.generation,
      revisao: snapshot.revision,
      periodos: {
        fusoHorario: 'UTC',
        inicioDia: periods.dayStart.toISOString(),
        inicioSemana: periods.weekStart.toISOString(),
        inicioMes: periods.monthStart.toISOString(),
        referencia: referenceTime.toISOString(),
      },
      coletasRealizadas: {
        hoje: historical.completedCollections.day,
        semanaAtual: historical.completedCollections.week,
        mesAtual: historical.completedCollections.month,
      },
      tracao: {
        novosMoradores: {
          hoje: historical.newResidents.day,
          semanaAtual: historical.newResidents.week,
          mesAtual: historical.newResidents.month,
        },
        concluidasNoMes: historical.completedCollections.month,
        canceladasNoMes: historical.cancelledCollectionsInMonth,
        taxaConclusaoPercentual: completionRate,
      },
      solicitacoesAtuais: current.requests,
      coletores: {
        ...current.collectors,
        telemetriaDesatualizada: staleTelemetry,
      },
      demandaPorRegiao: current.demandByRegion,
    };
  }

  // Rejeita chamadas que por erro de montagem chegaram sem ator identificado.
  private ensureAuthenticated(actor: Actor): void {
    // Protege chamadas diretas ao serviço que contornaram o middleware.
    if (!actor?.id) {
      throw new AppError({ statusCode: 401, code: 'NAO_AUTENTICADO', message: 'Identidade não informada.' });
    }
  }

  // Centraliza a autorização administrativa usada pelos endpoints de operação.
  private ensureOperator(actor: Actor, message: string): void {
    // Uma identidade ausente continua sendo um problema de autenticação, não apenas de papel.
    this.ensureAuthenticated(actor);
    // Somente o papel OPERADOR possui visão consolidada da plataforma.
    if (actor.role !== 'OPERADOR') {
      throw new AppError({ statusCode: 403, code: 'PAPEL_NAO_AUTORIZADO', message });
    }
  }

  // Impede consultas antes do primeiro snapshot válido da EcoRota.
  private ensureOperationalState() {
    const snapshot = this.state.getSnapshot();
    // Geração negativa representa cache ainda não inicializado por snapshot.
    if (snapshot.generation < 0) {
      throw new AppError({
        statusCode: 503,
        code: 'DADOS_OPERACIONAIS_INDISPONIVEIS',
        message: 'O backend ainda não recebeu um snapshot da EcoRota.',
      });
    }
    return snapshot;
  }

  // Define períodos civis UTC de maneira determinística e sem depender do fuso do servidor.
  private createIndicatorPeriods(reference: Date): IndicatorPeriods {
    // Zera hora, minuto, segundo e milissegundo para obter o começo do dia.
    const dayStart = new Date(Date.UTC(
      reference.getUTCFullYear(),
      reference.getUTCMonth(),
      reference.getUTCDate(),
    ));
    // Converte domingo zero para uma distância de seis dias desde a segunda-feira.
    const daysSinceMonday = (dayStart.getUTCDay() + 6) % 7;
    // Copia o começo do dia antes de recuar até a segunda-feira.
    const weekStart = new Date(dayStart);
    // Subtrai os dias completos necessários sem alterar dayStart.
    weekStart.setUTCDate(weekStart.getUTCDate() - daysSinceMonday);
    // Usa dia um para obter o começo do mês da mesma referência.
    const monthStart = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1));
    // Entrega objetos Date diretamente ao Prisma e à serialização da resposta.
    return { dayStart, weekStart, monthStart };
  }

  // Reutiliza contagens do snapshot enquanto não houver mudança de geração ou revisão.
  private getCachedCurrentOperationIndicators(snapshot: ReturnType<OperationStateStore['getSnapshot']>) {
    // Uma chave idêntica garante que pontos, coletores e solicitações continuam na mesma versão.
    if (this.indicatorCache
      && this.indicatorCache.generation === snapshot.generation
      && this.indicatorCache.revision === snapshot.revision) {
      return this.indicatorCache.value;
    }
    // Calcula uma nova projeção somente quando o estado operacional avançou.
    const value = this.calculateCurrentOperationIndicators(snapshot);
    // Guarda a projeção junto com a versão que a originou.
    this.indicatorCache = { generation: snapshot.generation, revision: snapshot.revision, value };
    // Devolve a mesma referência que ficará disponível para a próxima leitura da revisão.
    return value;
  }

  // Agrega solicitações, coletores e demanda por circuito sem consultar rede nem banco.
  private calculateCurrentOperationIndicators(snapshot: ReturnType<OperationStateStore['getSnapshot']>) {
    // Inicia todas as categorias conhecidas para que o contrato não omita valores iguais a zero.
    const requests = {
      total: snapshot.requests.length,
      pendentes: 0,
      atribuidas: 0,
      emAtendimento: 0,
      concluidas: 0,
      canceladas: 0,
    };
    // Incrementa exatamente uma categoria para cada solicitação presente no snapshot.
    for (const request of snapshot.requests) {
      // Mantém o switch explícito para que novos estados externos não sejam classificados incorretamente.
      switch (request.status) {
        // Conta solicitações que ainda aguardam atribuição.
        case 'pending': requests.pendentes += 1; break;
        // Conta solicitações que já possuem coletor responsável.
        case 'assigned': requests.atribuidas += 1; break;
        // Conta solicitações cuja coleta está sendo executada.
        case 'in_service': requests.emAtendimento += 1; break;
        // Conta solicitações encerradas com sucesso no snapshot atual.
        case 'completed': requests.concluidas += 1; break;
        // Conta solicitações encerradas por cancelamento no snapshot atual.
        case 'cancelled': requests.canceladas += 1; break;
      }
    }

    // Conta capacidade atual com base na disponibilidade informada pela EcoRota.
    const availableCollectors = snapshot.collectors.filter((collector) => collector.available).length;
    // Cria a visão geral de coletores usada nos cards do painel.
    const collectors = {
      total: snapshot.collectors.length,
      disponiveis: availableCollectors,
      indisponiveisOuEmOperacao: snapshot.collectors.length - availableCollectors,
    };
    // Agrupa demanda e capacidade pelo circuito, que representa a região operacional disponível no snapshot.
    const regions = new Map<number, { activeRequests: number; offeredCapacity: number }>();

    // Soma a demanda ativa informada por cada ponto dentro de seu circuito.
    for (const point of snapshot.points) {
      // Reaproveita o acumulador existente ou inicia uma região ainda não encontrada.
      const region = regions.get(point.circuit) ?? { activeRequests: 0, offeredCapacity: 0 };
      // Considera pendentes, atribuídas e em atendimento como demanda ainda ativa.
      region.activeRequests += point.demand.pending + point.demand.assigned + point.demand.in_service;
      // Salva o acumulador atualizado antes de examinar o próximo ponto.
      regions.set(point.circuit, region);
    }
    // Soma somente coletores disponíveis como capacidade ofertada imediatamente.
    for (const collector of snapshot.collectors) {
      // Reaproveita a região criada pelos pontos ou cria uma região composta apenas por coletores.
      const region = regions.get(collector.circuit) ?? { activeRequests: 0, offeredCapacity: 0 };
      // Um coletor indisponível não representa capacidade pronta para nova atribuição.
      if (collector.available) region.offeredCapacity += 1;
      // Salva o acumulador mesmo quando o circuito não possui pontos no snapshot.
      regions.set(collector.circuit, region);
    }

    // Transforma o mapa em uma lista estável, ordenada e pronta para serialização JSON.
    const demandByRegion = [...regions.entries()]
      // Ordena numericamente para impedir que a resposta mude sem alteração dos dados.
      .sort(([leftCircuit], [rightCircuit]) => leftCircuit - rightCircuit)
      // Traduz nomes e calcula o saldo, que fica negativo quando existe déficit operacional.
      .map(([circuit, region]) => ({
        regiao: `Circuito ${circuit}`,
        circuito: circuit,
        solicitacoesAtivas: region.activeRequests,
        capacidadeOfertada: region.offeredCapacity,
        saldoCapacidade: region.offeredCapacity - region.activeRequests,
      }));
    // Entrega somente valores independentes do relógio para permitir a memorização por revisão.
    return { requests, collectors, demandByRegion };
  }

  // Exige latitude/longitude em conjunto e devolve null quando não há filtro geográfico.
  private parseLocation(query: GeographicQuery): {
    hasCoordinates: boolean;
    latitude?: number;
    longitude?: number;
    raioKm?: number;
  } {
    const hasLatitude = query.latitude !== undefined;
    const hasLongitude = query.longitude !== undefined;
    // Uma coordenada isolada não permite calcular distância geográfica.
    if (hasLatitude !== hasLongitude) {
      throw new AppError({
        statusCode: 400,
        code: 'COORDENADAS_INCOMPLETAS',
        message: 'Latitude e longitude devem ser informadas em conjunto.',
      });
    }
    // Raio sem centro geográfico seria ambíguo e é rejeitado.
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

  // Traduz ponto, demanda e distância calculada para o contrato público.
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

  // Traduz coletor/posição e calcula distância e defasagem individual da telemetria.
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

  // Considera antigo o dado que ultrapassou duas janelas esperadas de atualização.
  private isStale(observedAt: string, pollIntervalMs: number): boolean {
    const observedTime = new Date(observedAt).getTime();
    // Data inválida é tratada conservadoramente como telemetria antiga.
    if (Number.isNaN(observedTime)) return true;
    return this.now().getTime() - observedTime > Math.max(15_000, pollIntervalMs * 3);
  }

  // Calcula distância Haversine em quilômetros entre duas coordenadas terrestres.
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

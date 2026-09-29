/**
 * Aplica autorização, antecedência, transições e integração EcoRota ao fluxo de solicitações.
 * Também converte o modelo Prisma para o contrato público em português retornado pelas rotas.
 */
import type { Actor } from '../../auth/actor.js';
import { AppError } from '../../errors/appError.js';
import type { RequestStatus } from '../../generated/prisma/enums.js';
import { EcoRotaIntegrationError, type EcoRotaClient, type EcoRotaRoute } from '../../integration/ecorotaClient.js';
import { POINTS_PER_COMPLETED_COLLECTION } from '../gamification/gamification.rules.js';
import { MATERIAL_TO_API, STATUS_TO_API, API_TO_STATUS } from './request.schemas.js';
import type { CreateCollectionRequestInput, ListCollectionRequestsQuery } from './request.schemas.js';
import { RepositoryRuleError, type RequestDetails, type RequestRepository } from './request.repository.js';

// Limita cancelamento aos estados que ainda não encerraram definitivamente a solicitação.
const CANCELLABLE_STATUSES: RequestStatus[] = ['SCHEDULED', 'PENDING', 'ASSIGNED', 'IN_SERVICE'];
// Representa a antecedência mínima de 24 horas em milissegundos.
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Traduz violações transacionais em AppError com status e códigos estáveis para a API.
function mapRepositoryError(error: unknown): never {
  // Somente violações conhecidas recebem tradução específica; demais erros são propagados.
  if (error instanceof RepositoryRuleError) {
    const errors = {
      ENDERECO_NAO_ENCONTRADO: [404, 'ENDERECO_NAO_ENCONTRADO', 'O endereço não existe ou não pertence ao morador.'],
      PONTO_COLETA_NAO_ENCONTRADO: [404, 'PONTO_COLETA_NAO_ENCONTRADO', 'Escolha um ponto de coleta ativo cadastrado pelo operador.'],
      SOLICITACAO_DUPLICADA: [409, 'SOLICITACAO_DUPLICADA', 'Já existe uma solicitação aberta para este endereço na mesma data.'],
      COLETOR_INDISPONIVEL: [409, 'COLETOR_INDISPONIVEL', 'O coletor informado não existe ou não está disponível.'],
      TRANSICAO_INVALIDA: [409, 'TRANSICAO_INVALIDA', 'A solicitação não está no estado exigido para esta operação.'],
    } as const;
    const [statusCode, code, message] = errors[error.rule];
    throw new AppError({ statusCode, code, message });
  }
  throw error;
}

// Decide propriedade para morador/coletor e concede visão global somente ao operador.
function canAccess(actor: Actor, request: RequestDetails): boolean {
  // Operador possui visão global para administrar o fluxo.
  if (actor.role === 'OPERADOR') return true;
  // Morador só acessa solicitações de sua propriedade.
  if (actor.role === 'MORADOR') return request.residentId === actor.id;
  return request.collectorProfile?.userId === actor.id;
}

// Interrompe com 404 para não revelar a existência de solicitação pertencente a outro usuário.
function ensureCanAccess(actor: Actor, request: RequestDetails): void {
  // Usa 404 em vez de 403 para não confirmar a existência de recurso alheio.
  if (!canAccess(actor, request)) {
    throw new AppError({
      statusCode: 403,
      code: 'SOLICITACAO_NAO_AUTORIZADA',
      message: 'O usuário não tem permissão para acessar esta solicitação.',
    });
  }
}

// Traduz uma transição persistida para o formato público do histórico.
function serializeHistoryItem(item: RequestDetails['statusHistory'][number]) {
  return {
    id: item.id,
    statusAnterior: item.fromStatus ? STATUS_TO_API[item.fromStatus] : null,
    statusAtual: STATUS_TO_API[item.toStatus],
    origem: item.source,
    motivo: item.reason,
    alteradoPorUsuarioId: item.changedByUserId,
    ocorridoEm: item.occurredAt.toISOString(),
  };
}

// Monta a visão completa da solicitação com endereço, materiais, coletor, histórico e pontos.
export function serializeRequest(request: RequestDetails) {
  return {
    id: request.id,
    referenciaExterna: request.externalReference,
    status: STATUS_TO_API[request.status],
    statusSincronizacao: request.syncStatus,
    integracao: {
      pontoColetaExternoId: request.externalPointId,
      pontoColetaId: request.collectionPointId,
      solicitacaoEcoRotaId: request.ecoRotaRequestId,
      coletorEcoRotaId: request.externalCollectorId,
    },
    dataDesejada: request.desiredAt.toISOString(),
    motivoCancelamento: request.cancellationReason,
    fotoConclusaoUrl: request.completionPhotoUrl,
    concluidaEm: request.completedAt?.toISOString() ?? null,
    criadoEm: request.createdAt.toISOString(),
    endereco: request.address ? {
      id: request.address.id,
      rotulo: request.address.label,
      logradouro: request.address.street,
      numero: request.address.number,
      bairro: request.address.district,
      cidade: request.address.city,
      estado: request.address.state,
      cep: request.address.zipCode,
      latitude: Number(request.address.latitude),
      longitude: Number(request.address.longitude),
    } : null,
    pontoColeta: request.collectionPoint ? {
      id: request.collectionPoint.id,
      nome: request.collectionPoint.name,
      tipo: request.collectionPoint.kind === 'ADDITIONAL' ? 'ADICIONAL' : 'HABITUAL',
      circuito: request.collectionPoint.circuit,
      coordenadas: { latitude: Number(request.collectionPoint.latitude), longitude: Number(request.collectionPoint.longitude) },
    } : null,
    materiais: request.materials.map((material) => ({
      id: material.id,
      tipo: MATERIAL_TO_API[material.materialType],
      quantidadeEstimada: material.estimatedQuantity === null ? null : Number(material.estimatedQuantity),
      unidade: material.unit,
    })),
    coletor: request.collectorProfile
      ? {
        id: request.collectorProfile.user.id,
        nome: request.collectorProfile.user.name,
        telefone: request.collectorProfile.user.phone,
      }
      : null,
    // Pontos que cada participante (morador e coletor) recebe quando a coleta é concluída.
    pontosPrevistos: POINTS_PER_COMPLETED_COLLECTION,
    pontosConcedidos: request.pointsLogs.map((entry) => ({
      usuarioId: entry.userId,
      pontos: entry.points,
      motivo: entry.reason,
    })),
  };
}

// Parte do estado operacional usada para estimar a chegada do coletor.
export interface ArrivalSource {
  getSnapshot(): { routes: EcoRotaRoute[]; observedAt: string };
}

// Estima a chegada pela rota que a EcoRota calculou para o coletor atribuído. Só vale para solicitações
// sincronizadas com a EcoRota, ainda atribuídas, cuja rota vai para o ponto delas; senão devolve null.
export function estimateArrival(request: RequestDetails, snapshot: ReturnType<ArrivalSource['getSnapshot']>): string | null {
  if (request.status !== 'ASSIGNED' || !request.externalCollectorId || !request.externalPointId) return null;
  const route = snapshot.routes.find((item) => item.collectorId === request.externalCollectorId);
  if (!route || route.destinationId !== request.externalPointId) return null;
  const observedAt = Date.parse(snapshot.observedAt);
  if (Number.isNaN(observedAt) || route.remainingMs < 0) return null;
  return new Date(observedAt + route.remainingMs).toISOString();
}

// Orquestra regras, autorização, persistência e comandos HTTP enviados à EcoRota.
export class RequestService {
  // Recebe persistência e integração externa separadamente para permitir testes e execução sem credencial.
  constructor(
    private readonly repository: RequestRepository,
    private readonly ecoRotaClient?: EcoRotaClient,
    private readonly arrivalSource?: ArrivalSource,
  ) {}

  // Contrato público da solicitação mais a previsão de chegada, quando a EcoRota permite calcular.
  private serialize(request: RequestDetails) {
    const snapshot = this.arrivalSource?.getSnapshot();
    return { ...serializeRequest(request), previsaoChegada: snapshot ? estimateArrival(request, snapshot) : null };
  }

  // Valida morador/antecedência, persiste localmente e tenta criar a contraparte EcoRota.
  async create(actor: Actor, input: CreateCollectionRequestInput) {
    // Somente moradores iniciam novas solicitações de coleta.
    if (actor.role !== 'MORADOR') {
      throw new AppError({ statusCode: 403, code: 'PAPEL_NAO_AUTORIZADO', message: 'Apenas moradores podem solicitar coletas.' });
    }
    if (!input.pontoColetaId && !(input.enderecoId && input.pontoColetaExternoId)) {
      throw new AppError({ statusCode: 400, code: 'PONTO_COLETA_OBRIGATORIO', message: 'Escolha um ponto de coleta antes de solicitar.' });
    }
    if (input.pontoColetaId && (input.enderecoId || input.pontoColetaExternoId)) {
      throw new AppError({ statusCode: 400, code: 'LOCAL_COLETA_AMBIGUO', message: 'Informe somente o ponto de coleta selecionado.' });
    }
    const desiredAt = new Date(input.dataDesejada);
    // Data precisa ser válida e futura antes da verificação transacional de duplicidade.
    if (Number.isNaN(desiredAt.getTime()) || desiredAt.getTime() <= Date.now()) {
      throw new AppError({ statusCode: 400, code: 'DATA_DESEJADA_INVALIDA', message: 'A data desejada precisa estar no futuro.' });
    }

    // Mantém a solicitação local mesmo quando a integração externa opcional falha.
    try {
      let request = await this.repository.create(actor.id, input);
      // Só chama EcoRota quando URL e credencial produziram um cliente real/fake.
      if (this.ecoRotaClient && input.pontoColetaExternoId && !input.pontoColetaId) {
        // Marca o vínculo externo após resposta bem-sucedida.
        try {
          const external = await this.ecoRotaClient.createRequest({
            pointId: input.pontoColetaExternoId,
            externalReference: request.externalReference,
          });
          request = await this.repository.markSynchronized(request.id, {
            requestId: external.data.id,
            pointId: external.data.pointId,
            collectorId: external.data.collectorId,
          });
        } catch (error) {
          request = await this.repository.markSyncError(request.id);
      // Erros locais inesperados não podem ser mascarados como falha de sincronização.
      if (!(error instanceof EcoRotaIntegrationError)) throw error;
        }
      }
      return this.serialize(request);
    } catch (error) {
      return mapRepositoryError(error);
    }
  }

  // Converte filtros públicos e delega ao repositório, que restringe resultados pelo ator.
  async list(actor: Actor, query: ListCollectionRequestsQuery) {
    const page = Number(query.pagina ?? 1);
    const limit = Number(query.limite ?? 20);
    // Protege o banco contra paginação inválida ou páginas excessivamente grandes.
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new AppError({ statusCode: 400, code: 'PAGINACAO_INVALIDA', message: 'Página deve ser positiva e limite deve estar entre 1 e 100.' });
    }
    const status = query.status ? API_TO_STATUS[query.status] : undefined;
    // Status textual desconhecido é rejeitado em vez de retornar lista vazia ambígua.
    if (query.status && !status) {
      throw new AppError({ statusCode: 400, code: 'STATUS_INVALIDO', message: 'O filtro de status é inválido.' });
    }
    const start = query.dataInicio ? new Date(query.dataInicio) : undefined;
    const end = query.dataFim ? new Date(query.dataFim) : undefined;
    // Datas de filtro precisam ser ISO válidas quando fornecidas.
    if ((start && Number.isNaN(start.getTime())) || (end && Number.isNaN(end.getTime()))) {
      throw new AppError({ statusCode: 400, code: 'PERIODO_INVALIDO', message: 'O período informado é inválido.' });
    }

    const result = await this.repository.list(actor, { status, start, end, page, limit });
    return {
      dados: result.items.map((item) => this.serialize(item)),
      paginacao: { pagina: page, limite: limit, total: result.total, totalPaginas: Math.ceil(result.total / limit) },
    };
  }

  // Busca por ID e aplica a regra comum de existência/propriedade.
  async get(actor: Actor, id: string): Promise<RequestDetails> {
    const request = await this.repository.findById(id);
    // Centraliza a resposta para UUID inexistente.
    if (!request) {
      throw new AppError({ statusCode: 404, code: 'SOLICITACAO_NAO_ENCONTRADA', message: 'A solicitação de coleta não foi encontrada.' });
    }
    ensureCanAccess(actor, request);
    return request;
  }

  // Retorna a solicitação completa já serializada para a API.
  async detail(actor: Actor, id: string) {
    return this.serialize(await this.get(actor, id));
  }

  // Expõe somente as transições da solicitação que o ator pode consultar.
  async history(actor: Actor, id: string) {
    const request = await this.get(actor, id);
    return { dados: request.statusHistory.map(serializeHistoryItem) };
  }

  // Valida estado/propriedade, cancela externamente quando sincronizada e registra a transição local.
  async cancel(actor: Actor, id: string, reason: string) {
    const request = await this.get(actor, id);
    // Estados finais não podem voltar para cancelado.
    if (!CANCELLABLE_STATUSES.includes(request.status)) {
      throw new AppError({ statusCode: 409, code: 'CANCELAMENTO_NAO_PERMITIDO', message: 'O estado atual não permite cancelamento.' });
    }
    // Operador pode cancelar por decisão operacional sem aplicar antecedência do morador.
    if (actor.role === 'OPERADOR') {
      throw new AppError({ statusCode: 403, code: 'PAPEL_NAO_AUTORIZADO', message: 'O operador não cancela solicitações neste fluxo.' });
    }
    // Morador precisa respeitar a antecedência mínima definida na regra de negócio.
    if (actor.role === 'MORADOR' && request.desiredAt.getTime() - Date.now() < ONE_DAY_MS) {
      throw new AppError({ statusCode: 409, code: 'PRAZO_CANCELAMENTO_EXPIRADO', message: 'O morador só pode cancelar com pelo menos 1 dia de antecedência.' });
    }
    // Executa cancelamento externo antes de consolidar a transição local.
    try {
      // Solicitação ainda não sincronizada não possui recurso externo para cancelar.
      if (this.ecoRotaClient && request.ecoRotaRequestId) {
        await this.ecoRotaClient.cancelRequest(request.ecoRotaRequestId);
      }
      return this.serialize(await this.repository.cancel(id, actor.id, reason.trim()));
    } catch (error) {
      // Falha externa vira 502 e impede divergência intencional entre os sistemas.
      if (error instanceof EcoRotaIntegrationError) {
        await this.repository.markSyncError(id);
        throw new AppError({
          statusCode: 502,
          code: 'FALHA_ECOROTA',
          message: 'Não foi possível confirmar o cancelamento na EcoRota.',
          details: { tentavelNovamente: error.retryable },
        });
      }
      return mapRepositoryError(error);
    }
  }

  // O operador atribui um coletor cadastrado às solicitações feitas nos pontos da plataforma.
  async assign(actor: Actor, id: string, collectorId: string) {
    if (actor.role !== 'OPERADOR') {
      throw new AppError({ statusCode: 403, code: 'PAPEL_NAO_AUTORIZADO', message: 'Apenas o operador pode atribuir coletores.' });
    }
    const request = await this.get(actor, id);
    // A EcoRota escolhe o coletor das solicitações que ela gerencia; atribuir aqui criaria divergência.
    if (request.ecoRotaRequestId) {
      throw new AppError({ statusCode: 409, code: 'ATRIBUICAO_PELA_ECOROTA', message: 'Esta solicitação é atribuída pela EcoRota.' });
    }
    // Apenas solicitações aguardando atendimento podem receber coletor.
    if (!['SCHEDULED', 'PENDING'].includes(request.status)) {
      throw new AppError({ statusCode: 409, code: 'ATRIBUICAO_NAO_PERMITIDA', message: 'A solicitação não está aguardando atribuição.' });
    }
    // Traduz eventual violação transacional detectada durante a atribuição.
    try {
      return this.serialize(await this.repository.assign(id, actor.id, collectorId));
    } catch (error) {
      return mapRepositoryError(error);
    }
  }

  // Permite somente ao coletor responsável mudar ATRIBUIDA para EM_ATENDIMENTO.
  async start(actor: Actor, id: string) {
    // Início só pode ser executado por um usuário coletor.
    if (actor.role !== 'COLETOR') {
      throw new AppError({ statusCode: 403, code: 'PAPEL_NAO_AUTORIZADO', message: 'Apenas o coletor responsável pode iniciar o atendimento.' });
    }
    await this.get(actor, id);
    // Repositório confirma vínculo e estado dentro da transação.
    try {
      return this.serialize(await this.repository.start(id, actor.id));
    } catch (error) {
      return mapRepositoryError(error);
    }
  }

  // Confirma conclusão externa/local e deixa o repositório conceder pontos idempotentes.
  async complete(actor: Actor, id: string, photoUrl: string | null) {
    // Conclusão só pode ser executada por um usuário coletor.
    if (actor.role !== 'COLETOR') {
      throw new AppError({ statusCode: 403, code: 'PAPEL_NAO_AUTORIZADO', message: 'Apenas o coletor responsável pode concluir o atendimento.' });
    }
    const request = await this.get(actor, id);
    // Sincroniza conclusão externa antes de conceder pontos localmente.
    try {
      // Evita repetir a chamada externa quando a conclusão já foi registrada.
      if (this.ecoRotaClient && request.ecoRotaRequestId && request.status !== 'COMPLETED') {
        await this.ecoRotaClient.completeRequest(request.ecoRotaRequestId);
      }
      return this.serialize(await this.repository.complete(id, actor.id, photoUrl));
    } catch (error) {
      // Normaliza falha externa para o contrato HTTP da aplicação.
      if (error instanceof EcoRotaIntegrationError) {
        await this.repository.markSyncError(id);
        throw new AppError({
          statusCode: 502,
          code: 'FALHA_ECOROTA',
          message: 'Não foi possível confirmar a conclusão na EcoRota.',
          details: { tentavelNovamente: error.retryable },
        });
      }
      return mapRepositoryError(error);
    }
  }
}

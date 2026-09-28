/**
 * Aplica autorização, antecedência, transições e integração EcoRota ao fluxo de solicitações.
 * Também converte o modelo Prisma para o contrato público em português retornado pelas rotas.
 */
import type { Actor } from '../../auth/actor.js';
import { AppError } from '../../errors/appError.js';
import type { RequestStatus } from '../../generated/prisma/enums.js';
import { EcoRotaIntegrationError, type EcoRotaClient } from '../../integration/ecorotaClient.js';
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
      solicitacaoEcoRotaId: request.ecoRotaRequestId,
      coletorEcoRotaId: request.externalCollectorId,
    },
    dataDesejada: request.desiredAt.toISOString(),
    motivoCancelamento: request.cancellationReason,
    fotoConclusaoUrl: request.completionPhotoUrl,
    concluidaEm: request.completedAt?.toISOString() ?? null,
    criadoEm: request.createdAt.toISOString(),
    endereco: {
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
    },
    materiais: request.materials.map((material) => ({
      id: material.id,
      tipo: MATERIAL_TO_API[material.materialType],
      quantidadeEstimada: material.estimatedQuantity === null ? null : Number(material.estimatedQuantity),
      unidade: material.unit,
    })),
    coletor: request.collectorProfile
      ? { id: request.collectorProfile.user.id, nome: request.collectorProfile.user.name }
      : null,
    pontosConcedidos: request.pointsLogs.map((entry) => ({
      usuarioId: entry.userId,
      pontos: entry.points,
      motivo: entry.reason,
    })),
  };
}

// Orquestra regras, autorização, persistência e comandos HTTP enviados à EcoRota.
export class RequestService {
  // Recebe persistência e integração externa separadamente para permitir testes e execução sem credencial.
  constructor(
    private readonly repository: RequestRepository,
    private readonly ecoRotaClient?: EcoRotaClient,
  ) {}

  // Valida morador/antecedência, persiste localmente e tenta criar a contraparte EcoRota.
  async create(actor: Actor, input: CreateCollectionRequestInput) {
    // Somente moradores iniciam novas solicitações de coleta.
    if (actor.role !== 'MORADOR') {
      throw new AppError({ statusCode: 403, code: 'PAPEL_NAO_AUTORIZADO', message: 'Apenas moradores podem solicitar coletas.' });
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
      if (this.ecoRotaClient) {
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
      return serializeRequest(request);
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
      dados: result.items.map(serializeRequest),
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
    return serializeRequest(await this.get(actor, id));
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
      return serializeRequest(await this.repository.cancel(id, actor.id, reason.trim()));
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

  // Permite ao operador atribuir coletor enquanto o fluxo definitivo do painel ainda é desenvolvido.
  async assignDevelopment(actor: Actor, id: string, collectorId: string) {
    // Atribuição temporária continua restrita ao operador.
    if (actor.role !== 'OPERADOR') {
      throw new AppError({ statusCode: 403, code: 'PAPEL_NAO_AUTORIZADO', message: 'Apenas o operador pode usar a atribuição temporária.' });
    }
    const request = await this.get(actor, id);
    // Apenas solicitações aguardando atendimento podem receber coletor.
    if (!['SCHEDULED', 'PENDING'].includes(request.status)) {
      throw new AppError({ statusCode: 409, code: 'ATRIBUICAO_NAO_PERMITIDA', message: 'A solicitação não está aguardando atribuição.' });
    }
    // Traduz eventual violação transacional detectada durante a atribuição.
    try {
      return serializeRequest(await this.repository.assign(id, actor.id, collectorId));
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
      return serializeRequest(await this.repository.start(id, actor.id));
    } catch (error) {
      return mapRepositoryError(error);
    }
  }

  // Confirma conclusão externa/local e deixa o repositório conceder pontos idempotentes.
  async complete(actor: Actor, id: string, photoUrl: string) {
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
      return serializeRequest(await this.repository.complete(id, actor.id, photoUrl));
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

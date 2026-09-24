import type { Actor } from '../../auth/actor.js';
import { AppError } from '../../errors/appError.js';
import type { RequestStatus } from '../../generated/prisma/enums.js';
import { MATERIAL_TO_API, STATUS_TO_API, API_TO_STATUS } from './request.schemas.js';
import type { CreateCollectionRequestInput, ListCollectionRequestsQuery } from './request.schemas.js';
import { RepositoryRuleError, type RequestDetails, type RequestRepository } from './request.repository.js';

const CANCELLABLE_STATUSES: RequestStatus[] = ['SCHEDULED', 'PENDING', 'ASSIGNED', 'IN_SERVICE'];
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function mapRepositoryError(error: unknown): never {
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

function canAccess(actor: Actor, request: RequestDetails): boolean {
  if (actor.role === 'OPERADOR') return true;
  if (actor.role === 'MORADOR') return request.residentId === actor.id;
  return request.collectorProfile?.userId === actor.id;
}

function ensureCanAccess(actor: Actor, request: RequestDetails): void {
  if (!canAccess(actor, request)) {
    throw new AppError({
      statusCode: 403,
      code: 'SOLICITACAO_NAO_AUTORIZADA',
      message: 'O usuário não tem permissão para acessar esta solicitação.',
    });
  }
}

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

export function serializeRequest(request: RequestDetails) {
  return {
    id: request.id,
    referenciaExterna: request.externalReference,
    status: STATUS_TO_API[request.status],
    statusSincronizacao: request.syncStatus,
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

export class RequestService {
  constructor(private readonly repository: RequestRepository) {}

  async create(actor: Actor, input: CreateCollectionRequestInput) {
    if (actor.role !== 'MORADOR') {
      throw new AppError({ statusCode: 403, code: 'PAPEL_NAO_AUTORIZADO', message: 'Apenas moradores podem solicitar coletas.' });
    }
    const desiredAt = new Date(input.dataDesejada);
    if (Number.isNaN(desiredAt.getTime()) || desiredAt.getTime() <= Date.now()) {
      throw new AppError({ statusCode: 400, code: 'DATA_DESEJADA_INVALIDA', message: 'A data desejada precisa estar no futuro.' });
    }

    try {
      return serializeRequest(await this.repository.create(actor.id, input));
    } catch (error) {
      return mapRepositoryError(error);
    }
  }

  async list(actor: Actor, query: ListCollectionRequestsQuery) {
    const page = Number(query.pagina ?? 1);
    const limit = Number(query.limite ?? 20);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new AppError({ statusCode: 400, code: 'PAGINACAO_INVALIDA', message: 'Página deve ser positiva e limite deve estar entre 1 e 100.' });
    }
    const status = query.status ? API_TO_STATUS[query.status] : undefined;
    if (query.status && !status) {
      throw new AppError({ statusCode: 400, code: 'STATUS_INVALIDO', message: 'O filtro de status é inválido.' });
    }
    const start = query.dataInicio ? new Date(query.dataInicio) : undefined;
    const end = query.dataFim ? new Date(query.dataFim) : undefined;
    if ((start && Number.isNaN(start.getTime())) || (end && Number.isNaN(end.getTime()))) {
      throw new AppError({ statusCode: 400, code: 'PERIODO_INVALIDO', message: 'O período informado é inválido.' });
    }

    const result = await this.repository.list(actor, { status, start, end, page, limit });
    return {
      dados: result.items.map(serializeRequest),
      paginacao: { pagina: page, limite: limit, total: result.total, totalPaginas: Math.ceil(result.total / limit) },
    };
  }

  async get(actor: Actor, id: string): Promise<RequestDetails> {
    const request = await this.repository.findById(id);
    if (!request) {
      throw new AppError({ statusCode: 404, code: 'SOLICITACAO_NAO_ENCONTRADA', message: 'A solicitação de coleta não foi encontrada.' });
    }
    ensureCanAccess(actor, request);
    return request;
  }

  async detail(actor: Actor, id: string) {
    return serializeRequest(await this.get(actor, id));
  }

  async history(actor: Actor, id: string) {
    const request = await this.get(actor, id);
    return { dados: request.statusHistory.map(serializeHistoryItem) };
  }

  async cancel(actor: Actor, id: string, reason: string) {
    const request = await this.get(actor, id);
    if (!CANCELLABLE_STATUSES.includes(request.status)) {
      throw new AppError({ statusCode: 409, code: 'CANCELAMENTO_NAO_PERMITIDO', message: 'O estado atual não permite cancelamento.' });
    }
    if (actor.role === 'OPERADOR') {
      throw new AppError({ statusCode: 403, code: 'PAPEL_NAO_AUTORIZADO', message: 'O operador não cancela solicitações neste fluxo.' });
    }
    if (actor.role === 'MORADOR' && request.desiredAt.getTime() - Date.now() < ONE_DAY_MS) {
      throw new AppError({ statusCode: 409, code: 'PRAZO_CANCELAMENTO_EXPIRADO', message: 'O morador só pode cancelar com pelo menos 1 dia de antecedência.' });
    }
    try {
      return serializeRequest(await this.repository.cancel(id, actor.id, reason.trim()));
    } catch (error) {
      return mapRepositoryError(error);
    }
  }

  async assignDevelopment(actor: Actor, id: string, collectorId: string) {
    if (actor.role !== 'OPERADOR') {
      throw new AppError({ statusCode: 403, code: 'PAPEL_NAO_AUTORIZADO', message: 'Apenas o operador pode usar a atribuição temporária.' });
    }
    const request = await this.get(actor, id);
    if (!['SCHEDULED', 'PENDING'].includes(request.status)) {
      throw new AppError({ statusCode: 409, code: 'ATRIBUICAO_NAO_PERMITIDA', message: 'A solicitação não está aguardando atribuição.' });
    }
    try {
      return serializeRequest(await this.repository.assign(id, actor.id, collectorId));
    } catch (error) {
      return mapRepositoryError(error);
    }
  }

  async start(actor: Actor, id: string) {
    if (actor.role !== 'COLETOR') {
      throw new AppError({ statusCode: 403, code: 'PAPEL_NAO_AUTORIZADO', message: 'Apenas o coletor responsável pode iniciar o atendimento.' });
    }
    await this.get(actor, id);
    try {
      return serializeRequest(await this.repository.start(id, actor.id));
    } catch (error) {
      return mapRepositoryError(error);
    }
  }

  async complete(actor: Actor, id: string, photoUrl: string) {
    if (actor.role !== 'COLETOR') {
      throw new AppError({ statusCode: 403, code: 'PAPEL_NAO_AUTORIZADO', message: 'Apenas o coletor responsável pode concluir o atendimento.' });
    }
    await this.get(actor, id);
    try {
      return serializeRequest(await this.repository.complete(id, actor.id, photoUrl));
    } catch (error) {
      return mapRepositoryError(error);
    }
  }
}

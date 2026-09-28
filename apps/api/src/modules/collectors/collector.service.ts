/**
 * Coordena o fluxo do coletor: consulta perfil/coletas, valida papel e sincroniza disponibilidade com a EcoRota.
 * Se a integração externa falhar, registra ERROR sem esconder a falha da camada HTTP.
 */
import type { Actor } from '../../auth/actor.js';
import { AppError } from '../../errors/appError.js';
import { EcoRotaIntegrationError, type EcoRotaClient } from '../../integration/ecorotaClient.js';
import type { RequestService } from '../requests/request.service.js';
import type { CollectorProfileDetails, CollectorRepository } from './collector.repository.js';
import type { ListCollectorRequestsQuery, UpdateCollectorAvailabilityInput } from './collector.schemas.js';

// Converte campos Prisma do perfil no contrato em português entregue ao frontend.
function serializeProfile(profile: CollectorProfileDetails) {
  return {
    id: profile.id,
    usuario: {
      id: profile.user.id,
      nome: profile.user.name,
      email: profile.user.email,
    },
    origem: profile.origin,
    coletorEcoRotaId: profile.ecoRotaCollectorId,
    disponivel: profile.available,
    turno: profile.availabilityShift,
    statusSincronizacao: profile.syncStatus,
    atualizadoEm: profile.updatedAt.toISOString(),
  };
}

// Reduz a dependência ao único método de RequestService necessário neste módulo.
type CollectorRequestReader = Pick<RequestService, 'list'>;

// Coordena consultas locais e atualização externa mantendo o estado de sincronização explícito.
export class CollectorService {
  // Recebe perfil, leitor de solicitações e cliente EcoRota opcional.
  constructor(
    private readonly repository: CollectorRepository,
    private readonly requestService: CollectorRequestReader,
    private readonly ecoRotaClient?: EcoRotaClient,
  ) {}

  // Reutiliza a listagem geral, cuja camada de repositório restringe ao coletor identificado.
  async listRequests(actor: Actor, query: ListCollectorRequestsQuery) {
    this.ensureCollector(actor);
    await this.getProfile(actor.id);
    return this.requestService.list(actor, query);
  }

  // Retorna disponibilidade local e situação da última sincronização externa.
  async getAvailability(actor: Actor) {
    this.ensureCollector(actor);
    return serializeProfile(await this.getProfile(actor.id));
  }

  // Salva a intenção, tenta sincronizar quando possível e registra SYNCED ou ERROR.
  async updateAvailability(actor: Actor, input: UpdateCollectorAvailabilityInput) {
    this.ensureCollector(actor);
    const current = await this.getProfile(actor.id);
    // Somente perfis personalizados podem alterar a disponibilidade pelo sistema próprio.
    if (current.origin !== 'CUSTOM') {
      throw new AppError({
        statusCode: 403,
        code: 'COLETOR_NAO_EDITAVEL',
        message: 'Somente coletores personalizados podem alterar a disponibilidade.',
      });
    }

    const shift = input.turno === undefined
      ? current.availabilityShift
      : input.turno?.trim() || null;
    // Disponibilidade ativa exige um turno utilizável para planejamento operacional.
    if (input.disponivel && !shift) {
      throw new AppError({
        statusCode: 400,
        code: 'TURNO_OBRIGATORIO',
        message: 'Informe o turno para deixar o coletor disponível.',
      });
    }

    let profile = await this.repository.updateAvailability(current.id, {
      available: input.disponivel,
      shift,
      syncStatus: 'PENDING',
    });

    // Sem cliente/vínculo externo, mantém a alteração local marcada como pendente.
    if (!this.ecoRotaClient || !profile.ecoRotaCollectorId) {
      return serializeProfile(profile);
    }

    // Tenta refletir a mudança na EcoRota e atualizar o indicador de sincronização.
    try {
      const external = await this.ecoRotaClient.updateCollector(profile.ecoRotaCollectorId, {
        available: input.disponivel,
      });
      profile = await this.repository.updateSyncStatus(profile.id, 'SYNCED', external.data.available);
      return serializeProfile(profile);
    } catch (error) {
      await this.repository.updateSyncStatus(profile.id, 'ERROR');
      // Falha externa conhecida é persistida como ERROR antes de ser propagada.
      if (error instanceof EcoRotaIntegrationError) {
        throw new AppError({
          statusCode: 502,
          code: 'FALHA_ECOROTA',
          message: 'A disponibilidade foi salva localmente, mas não foi confirmada pela EcoRota.',
          details: { estadoLocalSalvo: true, tentavelNovamente: error.retryable },
        });
      }
      throw error;
    }
  }

  // Bloqueia moradores e operadores nos endpoints exclusivos do coletor.
  private ensureCollector(actor: Actor): void {
    // Endpoints deste serviço são exclusivos do papel COLETOR.
    if (actor.role !== 'COLETOR') {
      throw new AppError({
        statusCode: 403,
        code: 'PAPEL_NAO_AUTORIZADO',
        message: 'Esta operação é exclusiva para coletores.',
      });
    }
  }

  // Busca o perfil vinculado e converte ausência em erro 404 público.
  private async getProfile(userId: string): Promise<CollectorProfileDetails> {
    const profile = await this.repository.findByUserId(userId);
    // Usuário com papel coletor mas sem perfil representa inconsistência de cadastro.
    if (!profile) {
      throw new AppError({
        statusCode: 404,
        code: 'PERFIL_COLETOR_NAO_ENCONTRADO',
        message: 'O usuário não possui perfil de coletor.',
      });
    }
    return profile;
  }
}

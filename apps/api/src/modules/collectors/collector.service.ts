import type { Actor } from '../../auth/actor.js';
import { AppError } from '../../errors/appError.js';
import { EcoRotaIntegrationError, type EcoRotaClient } from '../../integration/ecorotaClient.js';
import type { RequestService } from '../requests/request.service.js';
import type { CollectorProfileDetails, CollectorRepository } from './collector.repository.js';
import type { ListCollectorRequestsQuery, UpdateCollectorAvailabilityInput } from './collector.schemas.js';

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

type CollectorRequestReader = Pick<RequestService, 'list'>;

export class CollectorService {
  constructor(
    private readonly repository: CollectorRepository,
    private readonly requestService: CollectorRequestReader,
    private readonly ecoRotaClient?: EcoRotaClient,
  ) {}

  async listRequests(actor: Actor, query: ListCollectorRequestsQuery) {
    this.ensureCollector(actor);
    await this.getProfile(actor.id);
    return this.requestService.list(actor, query);
  }

  async getAvailability(actor: Actor) {
    this.ensureCollector(actor);
    return serializeProfile(await this.getProfile(actor.id));
  }

  async updateAvailability(actor: Actor, input: UpdateCollectorAvailabilityInput) {
    this.ensureCollector(actor);
    const current = await this.getProfile(actor.id);
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

    if (!this.ecoRotaClient || !profile.ecoRotaCollectorId) {
      return serializeProfile(profile);
    }

    try {
      const external = await this.ecoRotaClient.updateCollector(profile.ecoRotaCollectorId, {
        available: input.disponivel,
      });
      profile = await this.repository.updateSyncStatus(profile.id, 'SYNCED', external.data.available);
      return serializeProfile(profile);
    } catch (error) {
      await this.repository.updateSyncStatus(profile.id, 'ERROR');
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

  private ensureCollector(actor: Actor): void {
    if (actor.role !== 'COLETOR') {
      throw new AppError({
        statusCode: 403,
        code: 'PAPEL_NAO_AUTORIZADO',
        message: 'Esta operação é exclusiva para coletores.',
      });
    }
  }

  private async getProfile(userId: string): Promise<CollectorProfileDetails> {
    const profile = await this.repository.findByUserId(userId);
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

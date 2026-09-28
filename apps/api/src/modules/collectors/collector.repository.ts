/** Lê e atualiza perfil, disponibilidade, turno e estado de sincronização do coletor no PostgreSQL. */
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import type { SyncStatus } from '../../generated/prisma/enums.js';

// Padroniza a inclusão dos dados públicos do usuário em todas as consultas do perfil.
const collectorProfileInclude = { user: { select: { id: true, name: true, email: true } } } as const;
// Deriva do Prisma o tipo exato retornado pelo include acima.
export type CollectorProfileDetails = Prisma.CollectorProfileGetPayload<{
  include: typeof collectorProfileInclude;
}>;

// Define leitura e alterações de disponibilidade/sincronização usadas pelo serviço.
export interface CollectorRepository {
  findByUserId(userId: string): Promise<CollectorProfileDetails | null>;
  updateAvailability(
    profileId: string,
    data: { available: boolean; shift: string | null; syncStatus: SyncStatus },
  ): Promise<CollectorProfileDetails>;
  updateSyncStatus(profileId: string, syncStatus: SyncStatus, available?: boolean): Promise<CollectorProfileDetails>;
}

// Implementa as operações selecionando o perfil pelo userId único.
export class PrismaCollectorRepository implements CollectorRepository {
  // Guarda o Prisma compartilhado pela aplicação.
  constructor(private readonly database: PrismaClient) {}

  // Localiza o perfil único e inclui dados públicos do usuário.
  findByUserId(userId: string): Promise<CollectorProfileDetails | null> {
    return this.database.collectorProfile.findUnique({
      where: { userId },
      include: collectorProfileInclude,
    });
  }

  // Atualiza disponibilidade, turno e estado de sincronização em uma única escrita.
  updateAvailability(
    profileId: string,
    data: { available: boolean; shift: string | null; syncStatus: SyncStatus },
  ): Promise<CollectorProfileDetails> {
    return this.database.collectorProfile.update({
      where: { id: profileId },
      data: {
        available: data.available,
        availabilityShift: data.shift,
        syncStatus: data.syncStatus,
      },
      include: collectorProfileInclude,
    });
  }

  // Corrige somente o estado de sincronização e opcionalmente a disponibilidade confirmada.
  updateSyncStatus(
    profileId: string,
    syncStatus: SyncStatus,
    available?: boolean,
  ): Promise<CollectorProfileDetails> {
    return this.database.collectorProfile.update({
      where: { id: profileId },
      data: { syncStatus, ...(available === undefined ? {} : { available }) },
      include: collectorProfileInclude,
    });
  }
}

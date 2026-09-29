/** Testa autorização, serialização e sincronização de disponibilidade do CollectorService com repositórios simulados. */
import { describe, expect, it, vi } from 'vitest';
import { EcoRotaIntegrationError, type EcoRotaClient } from '../src/integration/ecorotaClient.js';
import type { CollectorProfileDetails, CollectorRepository } from '../src/modules/collectors/collector.repository.js';
import { CollectorService } from '../src/modules/collectors/collector.service.js';

// Identifica o coletor usado em todas as verificações de papel e vínculo.
const COLLECTOR_USER_ID = '22222222-2222-4222-8222-222222222222';

// Cria um perfil Prisma completo com possibilidade de sobrescrever o dado relevante ao teste.
function profile(overrides: Partial<CollectorProfileDetails> = {}): CollectorProfileDetails {
  return {
    id: 'profile-1',
    userId: COLLECTOR_USER_ID,
    ecoRotaCollectorId: null,
    origin: 'CUSTOM',
    available: false,
    availabilityShift: null,
    syncStatus: 'PENDING',
    createdAt: new Date('2026-09-24T10:00:00.000Z'),
    updatedAt: new Date('2026-09-24T10:00:00.000Z'),
    user: { id: COLLECTOR_USER_ID, name: 'Coletor', email: 'coletor@example.com' },
    ...overrides,
  };
}

// Cria um repositório fake cujos métodos podem ser inspecionados pelo Vitest.
function repository(current = profile()): CollectorRepository {
  return {
    findByUserId: vi.fn().mockResolvedValue(current),
    updateAvailability: vi.fn().mockImplementation(async (_id, data) => profile({
      ...current,
      available: data.available,
      availabilityShift: data.shift,
      syncStatus: data.syncStatus,
    })),
    updateSyncStatus: vi.fn().mockImplementation(async (_id, status, available) => profile({
      ...current,
      available: available ?? current.available,
      syncStatus: status,
    })),
  };
}

// Simula somente a operação de listagem de RequestService usada pelo módulo.
function requestReader() {
  return { list: vi.fn().mockResolvedValue({ dados: [], paginacao: { total: 0 } }) };
}

// Monta um cliente externo fake destacando apenas a atualização de coletor sob teste.
function ecoRotaClient(updateCollector: EcoRotaClient['updateCollector']): EcoRotaClient {
  const unused = vi.fn(() => Promise.reject(new Error('Não deveria ser chamado.')));
  return {
    createRequest: unused,
    cancelRequest: unused,
    completeRequest: unused,
    getSnapshot: unused,
    listPoints: unused,
    listCollectors: unused,
    updateCollector,
  };
}

describe('CollectorService', () => {
  const actor = { id: COLLECTOR_USER_ID, role: 'COLETOR' as const };

  it('restringe as operações ao papel coletor', async () => {
    const service = new CollectorService(repository(), requestReader());

    await expect(service.getAvailability({ id: 'resident', role: 'MORADOR' })).rejects.toMatchObject({
      code: 'PAPEL_NAO_AUTORIZADO',
    });
  });

  it('exige turno para deixar o coletor disponível', async () => {
    const service = new CollectorService(repository(), requestReader());

    await expect(service.updateAvailability(actor, { disponivel: true })).rejects.toMatchObject({
      code: 'TURNO_OBRIGATORIO',
    });
  });

  it('salva como pendente quando a integração externa não está configurada', async () => {
    const repo = repository();
    const service = new CollectorService(repo, requestReader());

    await expect(service.updateAvailability(actor, { disponivel: true, turno: 'MANHA' })).resolves.toMatchObject({
      disponivel: true,
      turno: 'MANHA',
      statusSincronizacao: 'PENDING',
    });
    expect(repo.updateAvailability).toHaveBeenCalledWith('profile-1', {
      available: true,
      shift: 'MANHA',
      syncStatus: 'PENDING',
    });
  });

  it('confirma disponibilidade na EcoRota quando há vínculo externo', async () => {
    const current = profile({ ecoRotaCollectorId: 'external-collector' });
    const repo = repository(current);
    const updateCollector = vi.fn().mockResolvedValue({
      data: { available: true }, revision: 1, generation: 1, simulationTime: 1, observedAt: new Date().toISOString(),
    });
    const service = new CollectorService(repo, requestReader(), ecoRotaClient(updateCollector));

    await expect(service.updateAvailability(actor, { disponivel: true, turno: 'TARDE' })).resolves.toMatchObject({
      statusSincronizacao: 'SYNCED',
    });
    expect(updateCollector).toHaveBeenCalledWith('external-collector', { available: true });
    expect(repo.updateSyncStatus).toHaveBeenCalledWith('profile-1', 'SYNCED', true);
  });

  it('registra erro quando a EcoRota não confirma a mudança', async () => {
    const current = profile({ ecoRotaCollectorId: 'external-collector' });
    const repo = repository(current);
    const updateCollector = vi.fn().mockRejectedValue(
      new EcoRotaIntegrationError('indisponível', 503, 'UNAVAILABLE', true),
    );
    const service = new CollectorService(repo, requestReader(), ecoRotaClient(updateCollector));

    await expect(service.updateAvailability(actor, { disponivel: true, turno: 'NOITE' })).rejects.toMatchObject({
      code: 'FALHA_ECOROTA',
      details: { estadoLocalSalvo: true, tentavelNovamente: true },
    });
    expect(repo.updateSyncStatus).toHaveBeenCalledWith('profile-1', 'ERROR');
  });

  it('lista somente por meio do contexto do coletor atual', async () => {
    const reader = requestReader();
    const service = new CollectorService(repository(), reader);

    await service.listRequests(actor, { status: 'ATRIBUIDA' });

    expect(reader.list).toHaveBeenCalledWith(actor, { status: 'ATRIBUIDA' });
  });
});

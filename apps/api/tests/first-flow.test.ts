/** Testa as principais regras de negócio do primeiro fluxo de coleta. */
import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../src/errors/appError.js';
import type { RequestRepository, RequestDetails } from '../src/modules/requests/request.repository.js';
import { RequestService } from '../src/modules/requests/request.service.js';
import type { EcoRotaClient } from '../src/integration/ecorotaClient.js';

// Usa um UUID válido e previsível como morador nos cenários de autorização.
const RESIDENT_ID = '11111111-1111-4111-8111-111111111111';

describe('regras do primeiro fluxo', () => {
  const unused = vi.fn(() => Promise.reject(new Error('Não deveria ser chamado.')));

  function createRepository(overrides: Partial<RequestRepository> = {}): RequestRepository {
    return {
      create: unused,
      list: unused,
      findById: unused,
      cancel: unused,
      assign: unused,
      start: unused,
      complete: unused,
      markSynchronized: unused,
      markSyncError: unused,
      ...overrides,
    };
  }

  it('permite criar solicitação somente para data futura', async () => {
    const service = new RequestService(createRepository());

    await expect(service.create(
      { id: RESIDENT_ID, role: 'MORADOR' },
      {
        enderecoId: RESIDENT_ID,
        pontoColetaExternoId: '44444444-4444-4444-8444-444444444444',
        dataDesejada: '2020-01-01T12:00:00.000Z',
        materiais: [{ tipo: 'PAPEL' }],
      },
    )).rejects.toMatchObject({ code: 'DATA_DESEJADA_INVALIDA' } satisfies Partial<AppError>);
  });

  it('cria coleta no ponto do operador sem endereço nem sincronização externa', async () => {
    const pointId = '44444444-4444-4444-8444-444444444444';
    const desiredAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const request = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', residentId: RESIDENT_ID,
      address: null, collectionPointId: pointId,
      collectionPoint: { id: pointId, name: 'Ecoponto Centro', kind: 'HABITUAL', circuit: 2, latitude: -23.5, longitude: -46.6 },
      externalPointId: null, ecoRotaRequestId: null, externalCollectorId: null,
      externalReference: 'pedido-1', status: 'PENDING', syncStatus: 'PENDING',
      desiredAt, cancellationReason: null, completionPhotoUrl: null, completedAt: null,
      createdAt: new Date(), materials: [{ id: 'material-1', materialType: 'PAPER', estimatedQuantity: null, unit: null }],
      collectorProfile: null, pointsLogs: [], statusHistory: [],
    } as unknown as RequestDetails;
    const create = vi.fn().mockResolvedValue(request);
    const createExternal = vi.fn();
    const service = new RequestService(createRepository({ create }), { createRequest: createExternal } as unknown as EcoRotaClient);
    const result = await service.create({ id: RESIDENT_ID, role: 'MORADOR' }, {
      pontoColetaId: pointId, dataDesejada: desiredAt.toISOString(), materiais: [{ tipo: 'PAPEL' }],
    });
    expect(create).toHaveBeenCalledWith(RESIDENT_ID, expect.objectContaining({ pontoColetaId: pointId }));
    expect(createExternal).not.toHaveBeenCalled();
    expect(result).toMatchObject({ endereco: null, pontoColeta: { nome: 'Ecoponto Centro' } });
  });

  it('impede cancelamento do morador com menos de um dia de antecedência', async () => {
    const desiredAt = new Date(Date.now() + 60 * 60 * 1000);
    const request = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      residentId: RESIDENT_ID,
      status: 'PENDING',
      desiredAt,
      collectorProfile: null,
    } as unknown as RequestDetails;
    const service = new RequestService(createRepository({ findById: vi.fn().mockResolvedValue(request) }));

    await expect(service.cancel(
      { id: RESIDENT_ID, role: 'MORADOR' },
      request.id,
      'Mudança de planos',
    )).rejects.toMatchObject({ code: 'PRAZO_CANCELAMENTO_EXPIRADO' } satisfies Partial<AppError>);
  });
});

import type { FastifyRequest } from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { createDevelopmentIdentityMiddleware } from '../src/auth/developmentIdentity.js';
import type { DevelopmentIdentityRepository } from '../src/auth/developmentIdentity.repository.js';
import { AppError } from '../src/errors/appError.js';
import type { RequestRepository, RequestDetails } from '../src/modules/requests/request.repository.js';
import { RequestService } from '../src/modules/requests/request.service.js';

const RESIDENT_ID = '11111111-1111-4111-8111-111111111111';

describe('identidade temporária', () => {
  it('busca o papel no banco em vez de aceitá-lo pelo cabeçalho', async () => {
    const repository: DevelopmentIdentityRepository = {
      findActorById: vi.fn().mockResolvedValue({ id: RESIDENT_ID, role: 'MORADOR' }),
    };
    const middleware = createDevelopmentIdentityMiddleware(repository, 'test');
    const request = { headers: { 'x-usuario-id': RESIDENT_ID } } as unknown as FastifyRequest;

    await middleware(request, {} as never, () => undefined);

    expect(request.actor).toEqual({ id: RESIDENT_ID, role: 'MORADOR' });
    expect(repository.findActorById).toHaveBeenCalledWith(RESIDENT_ID);
  });

  it('é bloqueada em produção', async () => {
    const repository: DevelopmentIdentityRepository = { findActorById: vi.fn() };
    const middleware = createDevelopmentIdentityMiddleware(repository, 'production');
    const request = { headers: { 'x-usuario-id': RESIDENT_ID } } as unknown as FastifyRequest;

    await expect(middleware(request, {} as never, () => undefined)).rejects.toMatchObject({
      code: 'AUTENTICACAO_NAO_IMPLEMENTADA',
    });
  });
});

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

import { describe, expect, it, vi } from 'vitest';
import { ProfileService } from '../src/modules/profiles/profile.service.js';
import type { ProfileRepository } from '../src/modules/profiles/profile.repository.js';

const resident = { id: 'resident-1', name: 'Ana Lima', role: 'MORADOR' as const,
  createdAt: new Date('2026-01-01T00:00:00.000Z'), completedCollections: 3,
  available: null, shift: null };

function repository(): ProfileRepository {
  return {
    get: vi.fn(async (id) => id === resident.id ? resident : null),
    list: vi.fn(async () => ({ profiles: [resident], total: 1 })),
  };
}

describe('perfis básicos', () => {
  it('permite ao operador consultar contagens sem expor dados sensíveis', async () => {
    const result = await new ProfileService(repository()).list({ id: 'operator-1', role: 'OPERADOR' }, { papel: 'MORADOR' });
    expect(result.dados).toEqual([{
      id: resident.id, nome: resident.name, papel: 'MORADOR',
      cadastradoEm: '2026-01-01T00:00:00.000Z', coletasConcluidas: 3,
    }]);
  });

  it('restringe a lista ao operador e o perfil próprio ao titular', async () => {
    const service = new ProfileService(repository());
    await expect(service.list({ id: resident.id, role: 'MORADOR' }, { papel: 'COLETOR' }))
      .rejects.toMatchObject({ statusCode: 403 });
    await expect(service.own({ id: 'other-resident', role: 'MORADOR' }))
      .rejects.toMatchObject({ statusCode: 404 });
    expect(await service.own({ id: resident.id, role: 'MORADOR' })).toMatchObject({ coletasConcluidas: 3 });
  });
});

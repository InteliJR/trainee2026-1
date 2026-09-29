/**
 * Testes da seleção de solicitações que o operador pode atribuir e da descrição dos materiais.
 */
import { describe, expect, it } from 'vitest';
import { describeMaterials, selectAssignable, type AssignableRequestDTO } from './assignmentsApi';

// Solicitação num ponto da plataforma, aguardando coletor; cada cenário altera o que precisa.
function request(overrides: Partial<AssignableRequestDTO> = {}): AssignableRequestDTO {
  return {
    id: 'local-1',
    status: 'PENDENTE',
    dataDesejada: '2026-10-02T13:00:00.000Z',
    criadoEm: '2026-09-28T10:00:00.000Z',
    integracao: { pontoColetaId: 'ponto-local-1', solicitacaoEcoRotaId: null },
    pontoColeta: { nome: 'Ecoponto Centro', circuito: 1 },
    materiais: [{ tipo: 'VIDRO', quantidadeEstimada: 2.5, unidade: 'kg' }],
    coletor: null,
    ...overrides,
  };
}

describe('selectAssignable', () => {
  it('mantém só solicitações de pontos da plataforma, fora da EcoRota e sem coletor', () => {
    const selected = selectAssignable([
      request({ id: 'ok' }),
      request({ id: 'agendada', status: 'AGENDADA' }),
      request({ id: 'ecorota', integracao: { pontoColetaId: null, solicitacaoEcoRotaId: 'eco-1' } }),
      request({ id: 'ja-atribuida', status: 'ATRIBUIDA', coletor: { nome: 'Ana' } }),
      request({ id: 'com-coletor', coletor: { nome: 'Ana' } }),
      request({ id: 'concluida', status: 'CONCLUIDA' }),
    ]);
    expect(selected.map((item) => item.id).sort()).toEqual(['agendada', 'ok']);
  });

  it('ordena pela data desejada mais próxima', () => {
    const selected = selectAssignable([
      request({ id: 'depois', dataDesejada: '2026-10-05T08:00:00.000Z' }),
      request({ id: 'antes', dataDesejada: '2026-10-01T08:00:00.000Z' }),
    ]);
    expect(selected.map((item) => item.id)).toEqual(['antes', 'depois']);
  });
});

describe('describeMaterials', () => {
  it('traduz o material e mostra a quantidade quando informada', () => {
    expect(describeMaterials([{ tipo: 'VIDRO', quantidadeEstimada: 2.5, unidade: 'kg' }])).toBe('Vidro · 2,5 kg');
    expect(describeMaterials([{ tipo: 'PAPEL' }])).toBe('Papel');
    expect(describeMaterials([])).toBe('Material não informado');
  });
});

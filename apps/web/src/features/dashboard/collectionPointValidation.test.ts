import { describe, expect, it } from 'vitest';
import { EMPTY_POINT_FORM, pointInputFromForm, validateCollectionPointForm } from './collectionPointValidation';

describe('formulário de ponto de coleta', () => {
  it('valida os campos obrigatórios e limites geográficos', () => {
    expect(validateCollectionPointForm(EMPTY_POINT_FORM)).toMatchObject({
      nome: expect.any(String),
      latitude: expect.any(String),
      longitude: expect.any(String),
    });
    expect(validateCollectionPointForm({
      ...EMPTY_POINT_FORM,
      nome: 'Ponto',
      latitude: '91',
      longitude: '-181',
      circuito: '1.5',
    })).toMatchObject({
      latitude: expect.any(String),
      longitude: expect.any(String),
      circuito: expect.any(String),
    });
  });

  it('normaliza strings e converte números no payload', () => {
    const input = pointInputFromForm({
      nome: '  Ponto Centro  ',
      tipo: 'ADICIONAL',
      latitude: '-23.55',
      longitude: '-46.63',
      circuito: '2',
      descricao: '  Próximo à praça  ',
      ativo: true,
    });
    expect(input).toEqual({
      nome: 'Ponto Centro',
      tipo: 'ADICIONAL',
      latitude: -23.55,
      longitude: -46.63,
      circuito: 2,
      descricao: 'Próximo à praça',
      ativo: true,
    });
  });
});

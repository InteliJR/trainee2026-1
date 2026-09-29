/**
 * Testes do papel deduzido da área da URL, usado para escolher o cookie de sessão na API.
 */
import { describe, expect, it } from 'vitest';
import { roleForPath } from './area';

describe('roleForPath', () => {
  it('reconhece as três áreas do app', () => {
    expect(roleForPath('/morador')).toBe('MORADOR');
    expect(roleForPath('/morador/acompanhar')).toBe('MORADOR');
    expect(roleForPath('/coletor/coletas/abc')).toBe('COLETOR');
    expect(roleForPath('/dashboard')).toBe('OPERADOR');
    expect(roleForPath('/dashboard/pontos')).toBe('OPERADOR');
    expect(roleForPath('/operador/login')).toBe('OPERADOR');
  });

  it('não atribui papel fora das áreas nem a caminhos parecidos', () => {
    expect(roleForPath('/')).toBeNull();
    expect(roleForPath('/moradores')).toBeNull();
    expect(roleForPath('/dashboards')).toBeNull();
  });
});

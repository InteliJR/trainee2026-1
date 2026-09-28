/**
 * Testes da tradução do saldo de capacidade em estado escrito no painel de demanda por região.
 */
import { describe, expect, it } from 'vitest';
import { capacityState } from './RegionDemand';

describe('capacityState', () => {
  it('avisa falta de capacidade quando há mais solicitações que coletores', () => {
    expect(capacityState(-2).label).toBe('Falta capacidade');
  });

  it('indica o limite quando demanda e capacidade empatam', () => {
    expect(capacityState(0).label).toBe('No limite');
  });

  it('indica folga quando sobram coletores disponíveis', () => {
    expect(capacityState(3).label).toBe('Com folga');
  });
});

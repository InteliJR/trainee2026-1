/**
 * Testes do cálculo da taxa de cancelamento exibida nos KPIs.
 */
import { describe, expect, it } from 'vitest';
import { cancellationRate } from './KpiCards';
import type { OperationIndicators } from './useIndicadores';

// Monta só a parte dos indicadores usada pelo cálculo.
function withMonth(concluidasNoMes: number, canceladasNoMes: number): OperationIndicators {
  return { tracao: { concluidasNoMes, canceladasNoMes } } as OperationIndicators;
}

describe('cancellationRate', () => {
  it('divide as canceladas pelo total encerrado no mês', () => {
    expect(cancellationRate(withMonth(9, 7))).toBeCloseTo(43.75);
  });

  it('é zero quando nada foi encerrado no mês', () => {
    expect(cancellationRate(withMonth(0, 0))).toBe(0);
  });
});

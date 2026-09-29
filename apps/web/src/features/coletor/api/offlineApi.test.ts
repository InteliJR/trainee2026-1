/**
 * Testes da regra que torna iniciar e concluir idempotentes diante de um 409 da API.
 */
import { describe, expect, it } from 'vitest';
import { isAlreadyDone } from './offlineApi';

describe('isAlreadyDone', () => {
  it('considera o início cumprido quando a coleta já está em atendimento ou concluída', () => {
    expect(isAlreadyDone({ type: 'start' }, { status: 'in_service' })).toBe(true);
    expect(isAlreadyDone({ type: 'start' }, { status: 'completed' })).toBe(true);
    expect(isAlreadyDone({ type: 'start' }, { status: 'assigned' })).toBe(false);
  });

  it('considera a conclusão cumprida só quando a coleta está concluída', () => {
    expect(isAlreadyDone({ type: 'complete' }, { status: 'completed' })).toBe(true);
    expect(isAlreadyDone({ type: 'complete' }, { status: 'in_service' })).toBe(false);
  });

  it('não considera cumprida quando a coleta não foi encontrada ou foi cancelada', () => {
    expect(isAlreadyDone({ type: 'start' }, undefined)).toBe(false);
    expect(isAlreadyDone({ type: 'start' }, { status: 'cancelled' })).toBe(false);
  });
});

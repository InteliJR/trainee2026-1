/**
 * Sessão do operador, usada pelo login e pelo guarda do dashboard.
 */
import { checkSession, loginAs, logout, type SessionCheck, type SessionUser } from '../../lib/session';

// Mensagem mostrada quando alguém entra com uma conta que não é de operador.
export const WRONG_ROLE_MESSAGE = 'Esta conta não é de operador. Moradores e coletores entram pelas próprias áreas.';

// Confere se há sessão de operador. Fica fora dos componentes para ter referência estável no guarda.
export function checkOperatorSession(): Promise<SessionCheck> {
  return checkSession('OPERADOR');
}

export function loginOperator(email: string, senha: string): Promise<SessionUser> {
  return loginAs('OPERADOR', email, senha, WRONG_ROLE_MESSAGE);
}

export function logoutOperator(): Promise<void> {
  return logout('OPERADOR');
}

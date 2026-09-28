/**
 * Sessão do coletor: usa a sessão compartilhada do app (mesmo padrão de residentAuth.ts).
 */
import { checkSession, loginAs, logout, type SessionCheck, type SessionUser } from '../../../lib/session';

// Mensagem mostrada quando alguém entra com uma conta que não é de coletor.
export const WRONG_ROLE_MESSAGE = 'Esta conta não é de coletor. Moradores e operadores entram pela própria área.';

export function checkCollectorSession(): Promise<SessionCheck> {
  return checkSession('COLETOR');
}

export function loginCollector(email: string, senha: string): Promise<SessionUser> {
  return loginAs('COLETOR', email, senha, WRONG_ROLE_MESSAGE);
}

export function logoutCollector(): Promise<void> {
  return logout();
}

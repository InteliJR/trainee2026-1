/**
 * Sessão do morador: usa a sessão compartilhada do app e limpa o cache local de solicitações ao trocar de conta.
 */
import { checkSession, loginAs, logout, type SessionCheck, type SessionUser } from '../../../lib/session';
import { clearResidentCache } from './residentRequests';

// Mensagem mostrada quando alguém entra com uma conta que não é de morador.
export const WRONG_ROLE_MESSAGE = 'Esta conta não é de morador. Coletores entram pela área do coletor.';

// Confere se há sessão de morador.
export function checkResidentSession(): Promise<SessionCheck> {
  return checkSession('MORADOR');
}

// Entra como morador e descarta solicitações de outra conta que tenha usado este aparelho antes.
export async function loginResident(email: string, senha: string): Promise<SessionUser> {
  const user = await loginAs('MORADOR', email, senha, WRONG_ROLE_MESSAGE);
  clearResidentCache();
  return user;
}

// Encerra a sessão e limpa o cache local, para outra pessoa no mesmo aparelho não ver as solicitações.
export async function logoutResident(): Promise<void> {
  clearResidentCache();
  await logout('MORADOR');
}

/**
 * Sessão do coletor: usa a sessão compartilhada do app (mesmo padrão de residentAuth.ts).
 */
import { checkSession, loginAs, logout, type SessionCheck, type SessionUser } from '../../../lib/session';
import { setCollectorOwner } from '../api/offlineQueue';

// Mensagem mostrada quando alguém entra com uma conta que não é de coletor.
export const WRONG_ROLE_MESSAGE = 'Esta conta não é de coletor. Moradores e operadores entram pela própria área.';

export async function checkCollectorSession(): Promise<SessionCheck> {
  const result = await checkSession('COLETOR');
  if (result.kind === 'autorizado') setCollectorOwner(result.user.id);
  if (result.kind === 'sem-sessao') setCollectorOwner(null);
  return result;
}

export async function loginCollector(email: string, senha: string): Promise<SessionUser> {
  const user = await loginAs('COLETOR', email, senha, WRONG_ROLE_MESSAGE);
  setCollectorOwner(user.id);
  return user;
}

export async function logoutCollector(): Promise<void> {
  await logout('COLETOR');
  setCollectorOwner(null);
}

/**
 * Sessão na API real (/api/v1/autenticacao), guardada em cookie httpOnly.
 * Há um cookie por papel: cada área informa o seu papel à API, e morador, coletor e operador
 * podem ficar logados ao mesmo tempo no mesmo navegador. O login recusa contas de outro papel.
 */
import { ApiError, apiRequest } from './api';
import type { Role } from './area';

export type { Role } from './area';

// Dados do usuário devolvidos pela API em login e sessão.
export interface SessionUser {
  id: string;
  nome: string;
  email: string;
  papel: Role;
}

// Resultado da verificação de sessão usado pelos guardas de rota.
export type SessionCheck =
  | { kind: 'autorizado'; user: SessionUser }
  // A API respondeu, mas não há sessão ou ela pertence a outro papel.
  | { kind: 'sem-sessao' }
  // A API não respondeu; a tela decide se segue em modo degradado.
  | { kind: 'offline' };

// Consulta a sessão atual sem lançar erro, para o guarda decidir entre liberar, redirecionar ou seguir offline.
export async function checkSession(role: Role): Promise<SessionCheck> {
  try {
    const { usuario } = await apiRequest<{ usuario: SessionUser }>('GET', '/autenticacao/sessao', undefined, role);
    return usuario.papel === role ? { kind: 'autorizado', user: usuario } : { kind: 'sem-sessao' };
  } catch (error) {
    if (error instanceof ApiError && error.status === 0) return { kind: 'offline' };
    return { kind: 'sem-sessao' };
  }
}

// Entra com e-mail e senha. A API recusa (403) conta de outro papel antes de criar o cookie,
// para não derrubar a sessão desse papel aberta em outra aba.
export async function loginAs(role: Role, email: string, senha: string, wrongRoleMessage: string): Promise<SessionUser> {
  let usuario: SessionUser;
  try {
    ({ usuario } = await apiRequest<{ usuario: SessionUser }>('POST', '/autenticacao/entrar', { email, senha }, role));
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) throw new ApiError(403, wrongRoleMessage);
    throw error;
  }
  // Defesa extra caso a API não confira o papel: desfaz a sessão criada para a conta errada.
  if (usuario.papel !== role) {
    await logout(usuario.papel).catch(() => undefined);
    throw new ApiError(403, wrongRoleMessage);
  }
  return usuario;
}

// Encerra só a sessão do papel informado; os outros papéis continuam logados no navegador.
export async function logout(role: Role): Promise<void> {
  await apiRequest('POST', '/autenticacao/sair', undefined, role);
}

// Traduz falhas do login em mensagens curtas para a tela.
export function loginErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'E-mail ou senha incorretos.';
    if (error.status === 0) return 'Sem conexão com o servidor. Verifique sua internet e tente de novo.';
    return error.message;
  }
  return 'Não foi possível entrar agora. Tente de novo.';
}

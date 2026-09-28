/**
 * Sessão na API real (/api/v1/autenticacao), guardada em cookie httpOnly.
 * A API aceita qualquer papel no login; cada área do app confere o papel e recusa os outros.
 */
import { ApiError, apiRequest } from './api';

export type Role = 'MORADOR' | 'COLETOR' | 'OPERADOR';

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
    const { usuario } = await apiRequest<{ usuario: SessionUser }>('GET', '/autenticacao/sessao');
    return usuario.papel === role ? { kind: 'autorizado', user: usuario } : { kind: 'sem-sessao' };
  } catch (error) {
    if (error instanceof ApiError && error.status === 0) return { kind: 'offline' };
    return { kind: 'sem-sessao' };
  }
}

// Entra com e-mail e senha; se a conta for de outro papel, encerra a sessão criada e avisa.
export async function loginAs(role: Role, email: string, senha: string, wrongRoleMessage: string): Promise<SessionUser> {
  const { usuario } = await apiRequest<{ usuario: SessionUser }>('POST', '/autenticacao/entrar', { email, senha });
  if (usuario.papel !== role) {
    await logout().catch(() => undefined);
    throw new ApiError(403, wrongRoleMessage);
  }
  return usuario;
}

// Encerra a sessão no servidor.
export async function logout(): Promise<void> {
  await apiRequest('POST', '/autenticacao/sair');
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

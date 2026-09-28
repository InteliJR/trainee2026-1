/**
 * Autenticação do morador na API real (/api/v1/autenticacao), com a sessão guardada em cookie httpOnly.
 * A API aceita qualquer papel no login; aqui a área do morador recusa contas de coletor ou operador.
 */
import { ResidentApiError, apiRequest } from './residentApi';
import { clearResidentCache } from './residentRequests';

// Dados do usuário devolvidos pela API em login e sessão.
export interface SessionUser {
  id: string;
  nome: string;
  email: string;
  papel: 'MORADOR' | 'COLETOR' | 'OPERADOR';
}

// Resultado da verificação de sessão usado pelo guarda de rotas.
export type ResidentSession =
  | { kind: 'morador'; user: SessionUser }
  // A API respondeu, mas não há sessão ou ela pertence a outro papel.
  | { kind: 'sem-sessao' }
  // A API não respondeu; as telas seguem em modo demonstração.
  | { kind: 'offline' };

// Mensagem mostrada quando alguém entra com uma conta que não é de morador.
export const WRONG_ROLE_MESSAGE = 'Esta conta não é de morador. Coletores entram pela área do coletor.';

// Consulta a sessão atual sem lançar erro, para o guarda decidir entre liberar, redirecionar ou seguir offline.
export async function checkResidentSession(): Promise<ResidentSession> {
  try {
    const { usuario } = await apiRequest<{ usuario: SessionUser }>('GET', '/autenticacao/sessao');
    return usuario.papel === 'MORADOR' ? { kind: 'morador', user: usuario } : { kind: 'sem-sessao' };
  } catch (error) {
    if (error instanceof ResidentApiError && error.status === 0) return { kind: 'offline' };
    return { kind: 'sem-sessao' };
  }
}

// Entra com e-mail e senha; se a conta for de outro papel, encerra a sessão criada e avisa.
export async function loginResident(email: string, senha: string): Promise<SessionUser> {
  const { usuario } = await apiRequest<{ usuario: SessionUser }>('POST', '/autenticacao/entrar', { email, senha });
  if (usuario.papel !== 'MORADOR') {
    await logoutResident().catch(() => undefined);
    throw new ResidentApiError(403, WRONG_ROLE_MESSAGE);
  }
  // Descarta solicitações de outra conta que tenha usado este aparelho antes.
  clearResidentCache();
  return usuario;
}

// Encerra a sessão e limpa o cache local, para outra pessoa no mesmo aparelho não ver as solicitações.
export async function logoutResident(): Promise<void> {
  clearResidentCache();
  await apiRequest('POST', '/autenticacao/sair');
}

// Autenticação na API real (testada em 2026-09-27 contra apps/api, branch feat/backend).
// Corpo e resposta em português: {email, senha} -> {usuario: {nome, email, ...}}.
import { ApiError } from '../api/errors';
import { request } from '../api/http';
import { MESSAGES } from '../lib/messages';
import type { AuthApi, Collector } from './types';

interface UsuarioDTO {
  nome: string;
  email: string;
  papel: 'MORADOR' | 'COLETOR' | 'OPERADOR';
}

const fromDTO = (u: UsuarioDTO): Collector => ({ name: u.nome, email: u.email });

export const httpAuth: AuthApi = {
  async login(email, password) {
    const { usuario } = await request<{ usuario: UsuarioDTO }>('POST', '/autenticacao/entrar', { email, senha: password });
    // A API aceita qualquer papel; a área do coletor encerra a sessão de moradores e operadores.
    if (usuario.papel !== 'COLETOR') {
      await request<void>('POST', '/autenticacao/sair').catch(() => undefined);
      throw new ApiError(403, MESSAGES.wrongRole);
    }
    return fromDTO(usuario);
  },
  logout: () => request<void>('POST', '/autenticacao/sair'),
  async me() {
    try {
      const { usuario } = await request<{ usuario: UsuarioDTO }>('GET', '/autenticacao/sessao');
      // Sessão de outro papel (ex.: morador logado no mesmo navegador) não vale como coletor.
      return usuario.papel === 'COLETOR' ? fromDTO(usuario) : null;
    } catch {
      return null;
    }
  },
};

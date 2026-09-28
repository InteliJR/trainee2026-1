// Autenticação na API real (testada em 2026-09-27 contra apps/api, branch feat/backend).
// Corpo e resposta em português: {email, senha} -> {usuario: {nome, email, ...}}.
import { request } from '../api/http';
import type { AuthApi, Collector } from './types';

interface UsuarioDTO {
  nome: string;
  email: string;
}

const fromDTO = (u: UsuarioDTO): Collector => ({ name: u.nome, email: u.email });

export const httpAuth: AuthApi = {
  async login(email, password) {
    const { usuario } = await request<{ usuario: UsuarioDTO }>('POST', '/autenticacao/entrar', { email, senha: password });
    return fromDTO(usuario);
  },
  logout: () => request<void>('POST', '/autenticacao/sair'),
  async me() {
    try {
      const { usuario } = await request<{ usuario: UsuarioDTO }>('GET', '/autenticacao/sessao');
      return fromDTO(usuario);
    } catch {
      return null;
    }
  },
};

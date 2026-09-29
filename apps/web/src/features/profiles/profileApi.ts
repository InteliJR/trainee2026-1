import { apiRequest } from '../../lib/api';

export interface BasicProfile {
  id: string;
  nome: string;
  email?: string;
  papel: 'MORADOR' | 'COLETOR';
  cadastradoEm: string;
  coletasConcluidas: number;
  disponivel?: boolean | null;
  turno?: string | null;
}

export interface CreateProfileInput {
  nome: string;
  email: string;
  telefone?: string;
  senha: string;
  papel: 'MORADOR' | 'COLETOR';
}

export interface UpdateProfileInput {
  nome?: string;
  email?: string;
  telefone?: string | null;
}

export const getOwnProfile = () => apiRequest<BasicProfile>('GET', '/perfis/me');

export const listProfiles = (role: BasicProfile['papel'], page: number) =>
  apiRequest<{ dados: BasicProfile[]; paginacao: { pagina: number; total: number; totalPaginas: number } }>(
    'GET', `/operacao/perfis?papel=${role}&pagina=${page}`,
  );

export const createProfile = (input: CreateProfileInput) =>
  apiRequest<BasicProfile>('POST', '/operacao/perfis', input);

export const updateProfile = (id: string, input: UpdateProfileInput) =>
  apiRequest<BasicProfile>('PATCH', `/operacao/perfis/${encodeURIComponent(id)}`, input);

export const deleteProfile = (id: string) =>
  apiRequest<void>('DELETE', `/operacao/perfis/${encodeURIComponent(id)}`);

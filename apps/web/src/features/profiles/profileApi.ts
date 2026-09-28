import { apiRequest } from '../../lib/api';

export interface BasicProfile {
  id: string;
  nome: string;
  papel: 'MORADOR' | 'COLETOR';
  cadastradoEm: string;
  coletasConcluidas: number;
  disponivel?: boolean | null;
  turno?: string | null;
}

export const getOwnProfile = () => apiRequest<BasicProfile>('GET', '/perfis/me');

export const listProfiles = (role: BasicProfile['papel'], page: number) =>
  apiRequest<{ dados: BasicProfile[]; paginacao: { pagina: number; total: number; totalPaginas: number } }>(
    'GET', `/operacao/perfis?papel=${role}&pagina=${page}`,
  );

/**
 * Descobre qual papel (morador, coletor ou operador) a tela atual representa.
 * A API guarda um cookie de sessão por papel; o front informa o papel da área em cada chamada
 * (cabeçalho X-EcoRota-Papel e handshake do Socket.IO), e assim cada aba usa a própria sessão.
 */

export type Role = 'MORADOR' | 'COLETOR' | 'OPERADOR';

// Cabeçalho lido pela API para escolher qual cookie de sessão usar.
export const ROLE_HEADER = 'X-EcoRota-Papel';

// Traduz o começo do caminho na área do app; fora das áreas (ex.: tela inicial) não há papel.
export function roleForPath(pathname: string): Role | null {
  if (pathname === '/morador' || pathname.startsWith('/morador/')) return 'MORADOR';
  if (pathname === '/coletor' || pathname.startsWith('/coletor/')) return 'COLETOR';
  if (/^\/(dashboard|operador)(\/|$)/.test(pathname)) return 'OPERADOR';
  return null;
}

// Papel da tela aberta nesta aba.
export function currentAreaRole(): Role | null {
  return typeof window === 'undefined' ? null : roleForPath(window.location.pathname);
}

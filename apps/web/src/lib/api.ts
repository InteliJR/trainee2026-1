/**
 * Chamada à API real (prefixo /api/v1) com o cookie de sessão, compartilhada pelas áreas do app.
 * Respostas de erro viram ApiError com o status HTTP e a mensagem em português devolvida pela API.
 */
import { ROLE_HEADER, currentAreaRole, type Role } from './area';

// Usa VITE_API_URL quando definida, como o restante do frontend; senão passa pelo proxy /api do Vite.
const BASE = `${import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL ?? '')}/api/v1`;

// Erro com o status HTTP e a mensagem devolvida pela API; status 0 significa sem conexão.
export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

// Faz a chamada com o cookie de sessão e converte respostas de erro em ApiError.
// `role` indica de qual área é a sessão; sem ele, vale o papel da tela aberta.
export async function apiRequest<T>(method: string, path: string, body?: unknown, role?: Role | null): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const areaRole = role ?? currentAreaRole();
  if (areaRole) headers[ROLE_HEADER] = areaRole;
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      credentials: 'include',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Sem conexão com a API.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, data?.mensagem ?? `A API respondeu com status ${response.status}.`);
  }
  return data as T;
}

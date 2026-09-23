// Autenticação na API real (arquitetura-Luiz.md §10.1: POST /auth/login → JWT em cookie httpOnly, role COLETOR).
// Rotas NOVAS, não constam na arquitetura-Luiz.md: POST /auth/logout e GET /auth/me (restaura a sessão ao recarregar).
// [COMBINAR COM O DEV 1]
import { request } from '../api/http';
import type { AuthApi, Collector } from './types';

export const httpAuth: AuthApi = {
  login: (email, password) => request<Collector>('POST', '/auth/login', { email, password }),
  logout: () => request<void>('POST', '/auth/logout'),
  me: () => request<Collector>('GET', '/auth/me').catch(() => null),
};

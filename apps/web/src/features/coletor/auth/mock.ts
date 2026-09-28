// Login simulado enquanto o Dev 1 não entrega POST /auth/login (PLANO.md, Dia 6).
// Coletores custom são cadastrados pelo time (arquitetura-Luiz.md §9), então só existe login, sem cadastro.
// A sessão fica em localStorage. Ative a API real com VITE_USE_MOCK=false.
import { ApiError } from '../api/errors';
import type { AuthApi, Collector } from './types';

export const MOCK_COLLECTOR = { name: 'Carlos Andrade', email: 'carlos@ecorota.com', password: 'coletor123' };

const SESSION_KEY = 'ecorota.mock.coletor.session.v1';
const LATENCY_MS = 250;

const delay = () => new Promise((r) => setTimeout(r, LATENCY_MS));

function readSession(): Collector | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Collector) : null;
  } catch {
    return null;
  }
}

function writeSession(collector: Collector | null): void {
  try {
    if (collector) localStorage.setItem(SESSION_KEY, JSON.stringify(collector));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage indisponível: sessão só dura até recarregar */
  }
}

export const mockAuth: AuthApi = {
  async login(email, password) {
    await delay();
    if (email.trim().toLowerCase() !== MOCK_COLLECTOR.email || password !== MOCK_COLLECTOR.password) {
      throw new ApiError(401, 'E-mail ou senha incorretos');
    }
    const collector = { name: MOCK_COLLECTOR.name, email: MOCK_COLLECTOR.email };
    writeSession(collector);
    return collector;
  },

  async logout() {
    await delay();
    writeSession(null);
  },

  async me() {
    await delay();
    return readSession();
  },
};

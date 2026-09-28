export interface Collector {
  name: string;
  email: string;
}

// Contrato de autenticação do coletor. `mock.ts` implementa agora; `http.ts` entra quando o Dev 1 entregar as rotas.
export interface AuthApi {
  login(email: string, password: string): Promise<Collector>;
  logout(): Promise<void>;
  /** Sessão atual, ou null se não houver login. */
  me(): Promise<Collector | null>;
}

import { io, type Socket } from 'socket.io-client';

export interface RealtimeClientOptions {
  usuarioId: string;
  apiUrl?: string;
}

export interface RealtimeRequestEvent {
  idExterno: string;
  referenciaExterna: string;
  pontoColetaExternoId: string;
  coletorExternoId: string | null;
  status: 'PENDENTE' | 'ATRIBUIDA' | 'EM_ATENDIMENTO' | 'CONCLUIDA' | 'CANCELADA';
  ocorridoEm: string;
  revisao: number;
  geracao: number;
}

export interface RealtimeCollectorPositionEvent {
  coletorExternoId: string;
  posicao: unknown;
  observadoEm: string;
  revisao: number;
  geracao: number;
}

export interface ServerToClientEvents {
  'operacao:estado-inicial': (snapshot: unknown) => void;
  'operacao:estado-atualizado': (snapshot: unknown) => void;
  'operacao:evento': (event: unknown) => void;
  'solicitacao:atribuida': (event: RealtimeRequestEvent) => void;
  'solicitacao:status-atualizado': (event: RealtimeRequestEvent) => void;
  'solicitacao:concluida': (event: RealtimeRequestEvent) => void;
  'coletor:posicao-atualizada': (event: RealtimeCollectorPositionEvent) => void;
  'rota:atualizada': (event: unknown) => void;
}

export function createRealtimeClient(
  options: RealtimeClientOptions,
): Socket<ServerToClientEvents> {
  const apiUrl = options.apiUrl ?? import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
  return io(`${apiUrl.replace(/\/$/, '')}/tempo-real`, {
    path: '/socket.io',
    auth: { usuarioId: options.usuarioId },
    autoConnect: false,
    transports: ['websocket', 'polling'],
    withCredentials: true,
    reconnection: true,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 30_000,
  });
}

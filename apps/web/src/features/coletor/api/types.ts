import type { RequestStatus } from '@ecorota/shared';
import type { Material } from '../config';

// Endereço exibido na coleta: o ponto de coleta (fluxo atual) ou o endereço do morador (coletas antigas).
export interface CollectorAddress {
  street: string;
  number: string;
  district: string;
  city: string;
}

// Para onde o coletor vai, com coordenadas para o mapa e a navegação. Null quando a API não informou.
export interface CollectorDestination {
  name: string;
  // [longitude, latitude]
  coordinates: [number, number];
}

export interface CollectorTask {
  id: string;
  status: RequestStatus;
  materials: Material[];
  address: CollectorAddress;
  destination: CollectorDestination | null;
  scheduledDate: string; // 'YYYY-MM-DD'
  notes?: string;
  updatedAt: string;
}

// PENDING = ainda não confirmado com a EcoRota; SYNCED = confirmado; ERROR = a EcoRota pode não saber disso.
export type SyncStatus = 'PENDING' | 'SYNCED' | 'ERROR';

export interface CollectorAvailability {
  available: boolean;
  /** Turno cadastrado pelo time (ex.: "Manhã"). Null = nenhum turno definido ainda. */
  shift: string | null;
  syncStatus: SyncStatus;
  updatedAt: string;
}

// Um lançamento de pontos (crédito por uma coleta concluída).
export interface PointsEntry {
  id: string;
  requestId: string | null;
  points: number;
  reason: string;
  createdAt: string;
}

export interface CollectorPoints {
  balance: number;
  entries: PointsEntry[];
}

// Contrato que o front usa; `http.ts` fala com a API real e `offlineApi.ts` guarda ações sem conexão.
export interface CollectorApi {
  listTasks(): Promise<CollectorTask[]>;
  /** Saldo e extrato de pontos (GET /pontuacao/lancamentos, real para morador e coletor). */
  getPoints(): Promise<CollectorPoints>;
  /** Início do atendimento: assigned -> in_service. Sem isso não dá para concluir. */
  startTask(id: string): Promise<void>;
  /** A API real exige a URL de uma foto como comprovação (POST .../conclusao). */
  completeTask(id: string): Promise<void>;
  /** A API real só permite cancelamento pelo morador — em modo real, esta ação fica bloqueada na tela. */
  getAvailability(): Promise<CollectorAvailability>;
  setAvailability(available: boolean): Promise<CollectorAvailability>;
}

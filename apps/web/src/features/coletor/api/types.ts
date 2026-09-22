import type { RequestStatus } from '@ecorota/shared';
import type { Material, PickupIssueReason } from '../config';

// Coleta atribuída ao coletor logado ("ponto de coleta" = local físico; nada a ver com "pontos" de gamificação).
export interface CollectorTask {
  id: string;
  status: RequestStatus;
  materials: Material[];
  pointId: string;
  pointName: string;
  circuit: number;
  scheduledDate: string; // 'YYYY-MM-DD'
  notes?: string;
  updatedAt: string;
}

// Registro de coleta que não deu certo no ponto (Task 3.3).
// Sem `rescheduleDate`, a coleta é encerrada em vez de remarcada.
export interface PickupIssueReport {
  reason: PickupIssueReason;
  /** Obrigatório quando `reason` é 'other'. */
  details?: string;
  /** 'YYYY-MM-DD' — nova data pedida pelo coletor. */
  rescheduleDate?: string;
}

// Contrato que o front usa. `mock.ts` implementa agora; `http.ts` entra quando o Dev 1 entregar as rotas.
export interface CollectorApi {
  listTasks(): Promise<CollectorTask[]>;
  completeTask(id: string): Promise<void>;
  cancelTask(id: string): Promise<void>;
  reportIssue(id: string, report: PickupIssueReport): Promise<void>;
}

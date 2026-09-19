export type RequestStatus =
  | 'pending'
  | 'assigned'
  | 'in_service'
  | 'completed'
  | 'cancelled';

const STATUS_LABEL: Record<RequestStatus, string> = {
  pending: 'Aguardando coletor',
  assigned: 'Coletor a caminho',
  in_service: 'Coletor no local',
  completed: 'Concluída',
  cancelled: 'Cancelada',
};

export function translateStatus(status: RequestStatus): string {
  return STATUS_LABEL[status];
}
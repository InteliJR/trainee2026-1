/**
 * Vocabulário compartilhado dos estados de uma coleta e tradução para textos exibidos ao usuário.
 * Centralizar essa tradução evita que API e frontend mostrem nomes diferentes para o mesmo estado.
 */
export type RequestStatus =
  | 'pending'
  | 'assigned'
  | 'in_service'
  | 'completed'
  | 'cancelled';

// Relaciona cada valor técnico ao texto em português apresentado na interface.
const STATUS_LABEL: Record<RequestStatus, string> = {
  pending: 'Aguardando coletor',
  assigned: 'Coletor a caminho',
  in_service: 'Coletor no local',
  completed: 'Concluída',
  cancelled: 'Cancelada',
};

// Retorna o rótulo conhecido e preserva o valor recebido como fallback defensivo.
export function translateStatus(status: RequestStatus): string {
  return STATUS_LABEL[status];
}

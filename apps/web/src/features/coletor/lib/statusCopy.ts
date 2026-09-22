import type { RequestStatus } from '@ecorota/shared';

// Frase de apoio sob o status, do ponto de vista do coletor. O texto do status vem SEMPRE de `translateStatus`.
export const STATUS_HINT: Record<RequestStatus, string> = {
  pending: 'Aguardando ser atribuída a você.',
  assigned: 'Vá até o ponto de coleta.',
  in_service: 'Você está no local. Faça a coleta e confirme.',
  completed: 'Coleta feita. Bom trabalho!',
  cancelled: 'Esta coleta foi cancelada.',
};

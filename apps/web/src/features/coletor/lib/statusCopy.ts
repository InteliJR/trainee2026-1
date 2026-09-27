import type { RequestStatus } from '@ecorota/shared';

// Frase de apoio sob o status, do ponto de vista do coletor. O texto do status vem SEMPRE de `translateStatus`.
export const STATUS_HINT: Record<RequestStatus, string> = {
  pending: 'Aguardando ser atribuída a você.',
  assigned: 'Vá até o endereço e toque em "Iniciar atendimento" quando chegar.',
  in_service: 'Atendimento em andamento. Faça a coleta e confirme.',
  completed: 'Coleta feita. Bom trabalho!',
  cancelled: 'Esta coleta foi cancelada.',
};

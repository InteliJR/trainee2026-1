import type { RequestStatus } from '@ecorota/shared';

// Atualização do painel enquanto há coletas em andamento (RF15 / RN09 — fallback de polling).
export const TASK_POLL_MS = 5_000;

// A API real só libera a conclusão depois que o coletor chama POST .../inicio (status vira in_service).
export const COMPLETABLE_STATUSES: readonly RequestStatus[] = ['in_service'];

// Só dá para "iniciar atendimento" numa coleta já atribuída.
export const STARTABLE_STATUSES: readonly RequestStatus[] = ['assigned'];

// Coletas ainda por fazer (o painel as separa das encerradas).
export const ACTIVE_STATUSES: readonly RequestStatus[] = ['pending', 'assigned', 'in_service'];

export const MATERIALS = [
  { id: 'paper', label: 'Papel' },
  { id: 'plastic', label: 'Plástico' },
  { id: 'glass', label: 'Vidro' },
  { id: 'metal', label: 'Metal' },
  { id: 'electronics', label: 'Eletrônico' },
  { id: 'organic', label: 'Orgânico' },
  { id: 'other', label: 'Outro' },
] as const;

export type Material = (typeof MATERIALS)[number]['id'];

export const materialLabel = (id: Material): string => MATERIALS.find((m) => m.id === id)?.label ?? id;


import type { RequestStatus } from '@ecorota/shared';

// Atualização do painel enquanto há coletas em andamento (RF15 / RN09 — fallback de polling).
export const TASK_POLL_MS = 5_000;

// A API real só libera a conclusão depois que o coletor chama POST .../inicio (status vira in_service).
export const COMPLETABLE_STATUSES: readonly RequestStatus[] = ['in_service'];

// Só dá para "iniciar atendimento" numa coleta já atribuída.
export const STARTABLE_STATUSES: readonly RequestStatus[] = ['assigned'];

// Coletas que já estão com o coletor e ainda podem ser canceladas no mock.
// Na API real, cancelar é só do morador — o botão fica desabilitado fora do mock.
export const CANCELABLE_STATUSES: readonly RequestStatus[] = ['assigned', 'in_service'];

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

// Coleta que não deu certo (Task 3.3): só se registra estando no local, com o atendimento iniciado.
export const ISSUE_STATUSES: readonly RequestStatus[] = ['in_service'];

// Motivos fechados em vez de texto livre (RNF08: menos digitação, menos leitura).
export const ISSUE_REASONS = [
  { id: 'no_material', label: 'Não tinha material no endereço', description: 'Cheguei lá e não havia o que coletar.' },
  { id: 'address_closed', label: 'Endereço fechado ou sem acesso', description: 'Não consegui entrar no local.' },
  { id: 'wrong_material', label: 'Material diferente do esperado', description: 'O que estava lá não era o combinado.' },
  { id: 'other', label: 'Outro motivo', description: 'Escreva em poucas palavras.' },
] as const;

export type PickupIssueReason = (typeof ISSUE_REASONS)[number]['id'];

export const issueReasonLabel = (id: PickupIssueReason): string =>
  ISSUE_REASONS.find((r) => r.id === id)?.label ?? id;

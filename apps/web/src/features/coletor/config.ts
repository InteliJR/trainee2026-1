import type { RequestStatus } from '@ecorota/shared';

// Atualização do painel enquanto há coletas em andamento (RF15 / RN09 — fallback de polling).
export const TASK_POLL_MS = 5_000;

// Guia de integração: o coletor só conclui depois que o status vira `in_service`.
export const COMPLETABLE_STATUSES: readonly RequestStatus[] = ['in_service'];

// Coletas que já estão com o coletor e ainda podem ser canceladas. [CONFIRMAR COM O TIME]
export const CANCELABLE_STATUSES: readonly RequestStatus[] = ['assigned', 'in_service'];

// Coletas ainda por fazer (o painel as separa das encerradas).
export const ACTIVE_STATUSES: readonly RequestStatus[] = ['pending', 'assigned', 'in_service'];

export const MATERIALS = [
  { id: 'paper', label: 'Papel' },
  { id: 'plastic', label: 'Plástico' },
  { id: 'glass', label: 'Vidro' },
  { id: 'metal', label: 'Metal' },
  { id: 'electronics', label: 'Eletrônico' },
] as const;

export type Material = (typeof MATERIALS)[number]['id'];

export const materialLabel = (id: Material): string => MATERIALS.find((m) => m.id === id)?.label ?? id;

// Coleta que não deu certo (Task 3.3): só se registra estando no ponto de coleta.
export const ISSUE_STATUSES: readonly RequestStatus[] = ['in_service'];

// Motivos fechados em vez de texto livre (RNF08: menos digitação, menos leitura).
// Trabalhamos com PONTOS DE COLETA: o coletor vai ao ponto, não à casa do morador.
export const ISSUE_REASONS = [
  { id: 'no_material', label: 'Não tinha material no ponto', description: 'Cheguei ao ponto e não havia o que coletar.' },
  { id: 'point_closed', label: 'Ponto fechado ou sem acesso', description: 'Não consegui entrar no local.' },
  { id: 'wrong_material', label: 'Material diferente do esperado', description: 'O que estava lá não era o combinado.' },
  { id: 'other', label: 'Outro motivo', description: 'Escreva em poucas palavras.' },
] as const;

export type PickupIssueReason = (typeof ISSUE_REASONS)[number]['id'];

export const issueReasonLabel = (id: PickupIssueReason): string =>
  ISSUE_REASONS.find((r) => r.id === id)?.label ?? id;

// Reagendamento: a partir de amanhã e no máximo 30 dias à frente.
// RN02 diz "1 dia" na docs_mafe e "2 h" na arquitetura-Luiz.md §10.1 — segui a docs_mafe. [CONFIRMAR COM O TIME]
export const RESCHEDULE_MIN_DAYS = 1;
export const RESCHEDULE_MAX_DAYS = 30;

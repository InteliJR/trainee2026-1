import { ApiError } from '../api/errors';

// RNF08: textos curtos, sem jargão. Diz o que houve e o que fazer.
export const MESSAGES = {
  loadError: 'Não deu para carregar. Confira a internet e tente de novo.',
  actionError: 'Não deu certo agora. Tente de novo em instantes.',
  serviceUnstable: 'O serviço está instável agora. Tente de novo em instantes.',
  notOnSite: 'Ainda não dá para confirmar. A coleta precisa estar no local.',
  cannotCancel: 'Esta coleta não pode mais ser cancelada.',
  wrongCredentials: 'E-mail ou senha incorretos. Confira e tente de novo.',
} as const;

export function friendlyError(error: unknown, fallback: string = MESSAGES.loadError): string {
  if (error instanceof ApiError && (error.status === 429 || error.status >= 500)) return MESSAGES.serviceUnstable;
  return fallback;
}

export const statusOf = (error: unknown): number | undefined => (error instanceof ApiError ? error.status : undefined);

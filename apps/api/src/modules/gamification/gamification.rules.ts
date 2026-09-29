/**
 * Regras de pontuação, num lugar só: usadas ao creditar pontos e expostas ao frontend,
 * para a tela mostrar o mesmo valor que a API realmente concede.
 */

// Pontos creditados ao morador e ao coletor quando a coleta é concluída.
export const POINTS_PER_COMPLETED_COLLECTION = 100;

// Contrato público das regras, em português como o restante da API.
export function publicPointsRules() {
  return { pontosPorColetaConcluida: POINTS_PER_COMPLETED_COLLECTION };
}

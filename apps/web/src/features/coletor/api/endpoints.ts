// Caminhos reais da API (testados contra apps/api em 2026-09-27, branch feat/backend). Prefixo /api/v1 no http.ts.
export const endpoints = {
  tasks: '/coletor/solicitacoes', // GET — coletas atribuídas ao coletor logado (resposta paginada: { dados, paginacao })
  startTask: (id: string) => `/solicitacoes-coleta/${id}/inicio`, // POST — assigned -> in_service
  completeTask: (id: string) => `/solicitacoes-coleta/${id}/conclusao`, // POST — exige { fotoUrl }
  availability: '/coletor/disponibilidade', // GET/PATCH — { disponivel, turno }
  points: '/pontuacao/lancamentos', // GET — { saldo, dados }, mesma rota que o morador usa
} as const;

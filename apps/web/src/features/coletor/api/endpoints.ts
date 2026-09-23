// Caminhos da nossa API (Fastify), conforme arquitetura-Luiz.md §10.2. O front nunca chama a EcoRota direto.
export const endpoints = {
  tasks: '/collector/requests', // GET — coletas atribuídas ao coletor logado
  completeTask: (id: string) => `/collector/requests/${id}/complete`, // POST — só coletor custom e status in_service
  cancelTask: (id: string) => `/collector/requests/${id}/cancel`, // POST
  // POST — coleta não realizada no ponto (+ reagendamento).
  // Rota NOVA: não consta na arquitetura-Luiz.md §10.2. [COMBINAR COM O DEV 1]
  reportIssue: (id: string) => `/collector/requests/${id}/issue`,
  // POST — disponibilidade do coletor, conforme arquitetura-Luiz.md §10.2.
  // GET — leitura do estado atual: rota NOVA, não consta na arquitetura-Luiz.md §10.2. [COMBINAR COM O DEV 1]
  availability: '/collector/availability',
} as const;

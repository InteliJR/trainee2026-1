/**
 * Dados da página de atribuição: solicitações feitas nos pontos da plataforma que esperam coletor,
 * coletores cadastrados e a chamada que atribui um ao outro. As solicitações que a EcoRota gerencia
 * ficam de fora, porque lá é a própria EcoRota que escolhe o coletor.
 */
import { apiRequest } from '../../lib/api';
import { listProfiles, type BasicProfile } from '../profiles/profileApi';

// Campos da solicitação que a página usa (contrato em português da API).
export interface AssignableRequestDTO {
  id: string;
  status: string;
  dataDesejada: string;
  criadoEm: string;
  integracao: { pontoColetaId?: string | null; solicitacaoEcoRotaId?: string | null };
  pontoColeta: { nome: string; circuito: number } | null;
  materiais: Array<{ tipo: string; quantidadeEstimada?: number | null; unidade?: string | null }>;
  coletor: { nome: string } | null;
}

interface Page<T> {
  dados: T[];
  paginacao?: { totalPaginas: number };
}

// Status em que a API aceita atribuir coletor.
const AWAITING_STATUSES = ['PENDENTE', 'AGENDADA'];

// Nomes dos materiais como a API os envia.
const MATERIAL_LABELS: Record<string, string> = {
  PAPEL: 'Papel',
  PLASTICO: 'Plástico',
  VIDRO: 'Vidro',
  METAL: 'Metal',
  ELETRONICOS: 'Eletrônicos',
  ORGANICO: 'Orgânico',
  OUTRO: 'Outro',
};

// Mantém só o que o operador pode atribuir: ponto da plataforma, fora da EcoRota, ainda sem coletor.
// Ordena pela data desejada, para o pedido mais urgente aparecer primeiro.
export function selectAssignable(requests: AssignableRequestDTO[]): AssignableRequestDTO[] {
  return requests
    .filter((request) => AWAITING_STATUSES.includes(request.status))
    .filter((request) => Boolean(request.integracao.pontoColetaId) && !request.integracao.solicitacaoEcoRotaId)
    .filter((request) => !request.coletor)
    .sort((a, b) => Date.parse(a.dataDesejada) - Date.parse(b.dataDesejada));
}

// Descreve o material e a quantidade informada, como "Vidro · 2,5 kg".
export function describeMaterials(materials: AssignableRequestDTO['materiais']): string {
  if (materials.length === 0) return 'Material não informado';
  return materials.map((material) => {
    const label = MATERIAL_LABELS[material.tipo] ?? material.tipo;
    if (material.quantidadeEstimada == null) return label;
    const quantity = material.quantidadeEstimada.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
    return `${label} · ${quantity} ${material.unidade ?? ''}`.trim();
  }).join(', ');
}

// Busca todas as páginas de solicitações visíveis ao operador e devolve as atribuíveis.
export async function fetchAssignableRequests(): Promise<AssignableRequestDTO[]> {
  const all: AssignableRequestDTO[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const response = await apiRequest<Page<AssignableRequestDTO>>('GET', `/solicitacoes-coleta?pagina=${page}&limite=100`);
    all.push(...response.dados);
    totalPages = response.paginacao?.totalPaginas ?? 1;
    page += 1;
  } while (page <= totalPages);
  return selectAssignable(all);
}

// Busca todos os coletores cadastrados, com a disponibilidade atual de cada um.
export async function fetchCollectors(): Promise<BasicProfile[]> {
  const all: BasicProfile[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const response = await listProfiles('COLETOR', page);
    all.push(...response.dados);
    totalPages = response.paginacao.totalPaginas;
    page += 1;
  } while (page <= totalPages);
  return all;
}

// Atribui o coletor (id do usuário) à solicitação.
export function assignCollector(requestId: string, collectorId: string): Promise<AssignableRequestDTO> {
  return apiRequest<AssignableRequestDTO>(
    'POST',
    `/operacao/solicitacoes-coleta/${encodeURIComponent(requestId)}/atribuicao`,
    { coletorId: collectorId },
  );
}

/**
 * Cliente da API real para as telas do morador (prefixo /api/v1, contrato em português).
 * Esta é a camada que traduz pontos, endereços e solicitações da API para os tipos usados nas telas.
 */
import type { RequestStatus } from '@ecorota/shared';
import { ApiError, apiRequest } from '../../../lib/api';
import { materialOptions, shiftOptions } from '../data/mockSolicitacao';
import type {
  CollectionPoint,
  MaterialCategory,
  ResidentCollectionRequest,
  ResidentRequestDraft,
  Shift,
  StatusTimelineItem,
} from '../types';

// ---------- Contratos da API ----------

export interface PointDTO {
  id: string;
  nome: string;
  tipo: string;
  coordenadas: { latitude: number; longitude: number };
  circuito: number;
  demanda: { pendentes: number; atribuidas: number; emAtendimento: number; concluidas: number; canceladas: number };
  distanciaKm: number | null;
}

export interface AddressDTO {
  id: string;
  logradouro: string;
  numero: string;
  bairro: string;
  latitude: number;
  longitude: number;
  padrao: boolean;
}

export interface RequestDTO {
  id: string;
  referenciaExterna: string;
  status: string;
  integracao: { pontoColetaExternoId: string };
  dataDesejada: string;
  criadoEm: string;
  concluidaEm: string | null;
  endereco: { logradouro: string; numero: string; bairro: string };
  materiais: Array<{ tipo: string }>;
  coletor: { nome: string } | null;
  pontosConcedidos: Array<{ pontos: number }>;
}

// ---------- Traduções ----------

// Materiais da tela → enum da API. A API não tem óleo; ele segue como OUTRO.
const MATERIAL_TO_API: Record<MaterialCategory, string> = {
  papel: 'PAPEL',
  plastico: 'PLASTICO',
  vidro: 'VIDRO',
  metal: 'METAL',
  eletronicos: 'ELETRONICOS',
  oleo: 'OUTRO',
};

const MATERIAL_FROM_API: Record<string, MaterialCategory> = {
  PAPEL: 'papel',
  PLASTICO: 'plastico',
  VIDRO: 'vidro',
  METAL: 'metal',
  ELETRONICOS: 'eletronicos',
  ORGANICO: 'oleo',
  OUTRO: 'oleo',
};

// AGENDADA ainda não chegou à fila da EcoRota; para o morador, equivale a aguardando coletor.
const STATUS_FROM_API: Record<string, RequestStatus> = {
  AGENDADA: 'pending',
  PENDENTE: 'pending',
  ATRIBUIDA: 'assigned',
  EM_ATENDIMENTO: 'in_service',
  CONCLUIDA: 'completed',
  CANCELADA: 'cancelled',
};

// Horário de início de cada turno, usado para montar a data desejada enviada à API.
const SHIFT_START_HOUR: Record<Shift, number> = { manha: 8, tarde: 13, noite: 18 };

// Converte um ponto da API no formato do passo "Selecione o ponto".
export function pointFromApi(dto: PointDTO): CollectionPoint {
  const kind = dto.tipo === 'ADICIONAL' ? 'additional' : 'habitual';
  return {
    id: dto.id,
    name: dto.nome,
    kind,
    coordinates: [dto.coordenadas.longitude, dto.coordenadas.latitude],
    circuit: dto.circuito,
    demand: {
      pending: dto.demanda.pendentes,
      assigned: dto.demanda.atribuidas,
      in_service: dto.demanda.emAtendimento,
      completed: dto.demanda.concluidas,
      cancelled: dto.demanda.canceladas,
    },
    address: kind === 'habitual' ? 'Ponto habitual da rota' : 'Ponto adicional',
    // Os pontos da EcoRota não têm bairro; o circuito faz o papel de região no filtro.
    neighborhood: `Circuito ${dto.circuito}`,
    distanceKm: dto.distanciaKm === null ? 0 : Math.round(dto.distanciaKm * 10) / 10,
    // A EcoRota não informa restrição de material por ponto; todos aceitam qualquer categoria.
    accepts: materialOptions.map((material) => material.id),
    nextAvailability: 'Conforme a rota do coletor',
  };
}

// Monta a data desejada combinando o dia escolhido com o início do turno, no fuso do navegador.
export function desiredDateToIso(date: string, shift: Shift): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day, SHIFT_START_HOUR[shift], 0, 0).toISOString();
}

// Descobre o turno a partir da hora da data desejada.
function shiftFromDate(date: Date): Shift {
  const hour = date.getHours();
  if (hour < 12) return 'manha';
  if (hour < 18) return 'tarde';
  return 'noite';
}

// Formata a data no padrão AAAA-MM-DD usado pela tela, no fuso do navegador.
function localDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Formata a hora no padrão HH:MM usado pela linha do tempo.
function clock(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// Linha do tempo padrão da tela; só as etapas com horário conhecido vêm preenchidas.
export function buildTimeline(createdAt: string | null, completedAt: string | null = null): StatusTimelineItem[] {
  return [
    { status: 'pending', label: 'Solicitação recebida', occurredAt: clock(createdAt), description: 'Seu pedido entrou na fila do ponto selecionado.' },
    { status: 'assigned', label: 'Coletor a caminho', occurredAt: null, description: 'Você será avisado quando um coletor assumir.' },
    { status: 'in_service', label: 'Coletor no local', occurredAt: null, description: 'O coletor confirma a chegada antes da retirada.' },
    { status: 'completed', label: 'Coleta concluída', occurredAt: clock(completedAt), description: 'Os pontos serão creditados após a conclusão.' },
  ];
}

// Converte uma solicitação da API no formato das telas "Acompanhar status" e "Histórico".
export function requestFromApi(dto: RequestDTO, pointNames: ReadonlyMap<string, string>): ResidentCollectionRequest {
  const materialId = MATERIAL_FROM_API[dto.materiais[0]?.tipo ?? 'OUTRO'] ?? 'oleo';
  const material = materialOptions.find((option) => option.id === materialId)!;
  const desired = new Date(dto.dataDesejada);
  const shift = shiftOptions.find((option) => option.id === shiftFromDate(desired))!;
  const grantedPoints = dto.pontosConcedidos.reduce((sum, entry) => sum + entry.pontos, 0);
  return {
    id: dto.id,
    externalReference: dto.referenciaExterna,
    protocol: `ECO-${dto.id.slice(-6).toUpperCase()}`,
    materialId,
    materialName: material.name,
    pointName: pointNames.get(dto.integracao.pontoColetaExternoId) ?? 'Ponto de coleta',
    pointAddress: `${dto.endereco.logradouro}, ${dto.endereco.numero}`,
    neighborhood: dto.endereco.bairro,
    scheduledDate: localDate(desired),
    shiftLabel: shift.label,
    shiftWindow: shift.window,
    status: STATUS_FROM_API[dto.status] ?? 'pending',
    collectorName: dto.coletor?.nome ?? null,
    collectorPhone: null,
    estimatedArrival: null,
    pointsPreview: grantedPoints > 0 ? grantedPoints : material.points,
    timeline: buildTimeline(dto.criadoEm, dto.concluidaEm),
  };
}

// ---------- Chamadas ----------

// Endereço usado na solicitação: o padrão do morador ou, na falta dele, o primeiro cadastrado.
export async function fetchDefaultAddress(): Promise<AddressDTO | null> {
  const { dados } = await apiRequest<{ dados: AddressDTO[] }>('GET', '/enderecos');
  return dados.find((address) => address.padrao) ?? dados[0] ?? null;
}

// Pontos reais da EcoRota, com distância calculada a partir do endereço quando ele é informado.
export async function fetchCollectionPoints(near?: { latitude: number; longitude: number }): Promise<CollectionPoint[]> {
  const query = near ? `?latitude=${near.latitude}&longitude=${near.longitude}` : '';
  const { dados } = await apiRequest<{ dados: PointDTO[] }>('GET', `/pontos-coleta${query}`);
  return dados.map(pointFromApi);
}

// Solicitações do morador autenticado, já no formato das telas.
export async function fetchResidentRequests(): Promise<ResidentCollectionRequest[]> {
  const [{ dados }, points] = await Promise.all([
    apiRequest<{ dados: RequestDTO[] }>('GET', '/solicitacoes-coleta'),
    // Sem os pontos, as solicitações aparecem com nome genérico em vez de falhar a tela inteira.
    apiRequest<{ dados: PointDTO[] }>('GET', '/pontos-coleta').then((response) => response.dados).catch(() => [] as PointDTO[]),
  ]);
  const pointNames = new Map(points.map((point) => [point.id, point.nome]));
  return dados.map((dto) => requestFromApi(dto, pointNames));
}

// Cria a solicitação no endereço padrão do morador.
export async function createRequestInApi(draft: ResidentRequestDraft, point: CollectionPoint): Promise<ResidentCollectionRequest> {
  if (!draft.materialId || !draft.shift || !draft.desiredDate) {
    throw new ApiError(400, 'Complete os dados da coleta antes de continuar.');
  }
  const address = await fetchDefaultAddress();
  if (!address) throw new ApiError(400, 'Cadastre um endereço antes de solicitar uma coleta.');
  const dto = await apiRequest<RequestDTO>('POST', '/solicitacoes-coleta', {
    enderecoId: address.id,
    pontoColetaExternoId: point.id,
    dataDesejada: desiredDateToIso(draft.desiredDate, draft.shift),
    materiais: [{ tipo: MATERIAL_TO_API[draft.materialId] }],
  });
  return requestFromApi(dto, new Map([[point.id, point.name]]));
}

// Cancela a solicitação; a API exige motivo e confirmação explícita.
export async function cancelRequestInApi(requestId: string): Promise<void> {
  await apiRequest('POST', `/solicitacoes-coleta/${requestId}/cancelamento`, {
    motivo: 'Cancelada pelo morador no aplicativo.',
    confirmado: true,
  });
}

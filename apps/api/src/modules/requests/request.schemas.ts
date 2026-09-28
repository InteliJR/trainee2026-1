/**
 * Traduz materiais/status entre API e Prisma e define os JSON Schemas de criação e transições da solicitação.
 * O Fastify usa estes schemas para rejeitar corpos inválidos antes de executar regra de negócio.
 */
import type { MaterialType, RequestStatus } from '../../generated/prisma/enums.js';

// Converte nomes de material recebidos em português para o enum persistido pelo Prisma.
export const API_TO_MATERIAL: Record<string, MaterialType> = {
  PAPEL: 'PAPER',
  PLASTICO: 'PLASTIC',
  VIDRO: 'GLASS',
  METAL: 'METAL',
  ELETRONICOS: 'ELECTRONICS',
  ORGANICO: 'ORGANIC',
  OUTRO: 'OTHER',
};

// Gera automaticamente o mapa inverso usado nas respostas sem duplicar traduções.
export const MATERIAL_TO_API: Record<MaterialType, string> = Object.fromEntries(
  Object.entries(API_TO_MATERIAL).map(([api, database]) => [database, api]),
) as Record<MaterialType, string>;

// Converte filtros de status públicos para o enum interno do banco.
export const API_TO_STATUS: Record<string, RequestStatus> = {
  AGENDADA: 'SCHEDULED',
  PENDENTE: 'PENDING',
  ATRIBUIDA: 'ASSIGNED',
  EM_ATENDIMENTO: 'IN_SERVICE',
  CONCLUIDA: 'COMPLETED',
  CANCELADA: 'CANCELLED',
};

// Gera o mapa inverso que serializa status internos em português.
export const STATUS_TO_API: Record<RequestStatus, string> = Object.fromEntries(
  Object.entries(API_TO_STATUS).map(([api, database]) => [database, api]),
) as Record<RequestStatus, string>;

// Contrato tipado do corpo necessário para solicitar uma coleta.
export interface CreateCollectionRequestInput {
  enderecoId: string;
  pontoColetaExternoId: string;
  dataDesejada: string;
  materiais: Array<{
    tipo: keyof typeof API_TO_MATERIAL;
    quantidadeEstimada?: number;
    unidade?: string;
  }>;
}

// Contrato dos filtros e paginação aceitos na listagem.
export interface ListCollectionRequestsQuery {
  status?: keyof typeof API_TO_STATUS;
  dataInicio?: string;
  dataFim?: string;
  pagina?: string;
  limite?: string;
}

// Valida endereço, data futura, ponto externo e pelo menos um material.
export const createCollectionRequestBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['enderecoId', 'pontoColetaExternoId', 'dataDesejada', 'materiais'],
  properties: {
    enderecoId: { type: 'string', format: 'uuid' },
    pontoColetaExternoId: { type: 'string', format: 'uuid' },
    dataDesejada: { type: 'string', format: 'date-time' },
    materiais: {
      type: 'array',
      minItems: 1,
      maxItems: 20,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['tipo'],
        properties: {
          tipo: { type: 'string', enum: Object.keys(API_TO_MATERIAL) },
          quantidadeEstimada: { type: 'number', exclusiveMinimum: 0 },
          unidade: { type: 'string', minLength: 1, maxLength: 20 },
        },
      },
    },
  },
} as const;

// Exige uma justificativa textual para registrar o motivo do cancelamento.
export const cancellationBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['motivo', 'confirmado'],
  properties: {
    motivo: { type: 'string', minLength: 3, maxLength: 500 },
    confirmado: { const: true },
  },
} as const;

// Exige o UUID do usuário coletor selecionado pelo operador.
export const assignmentBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['coletorId'],
  properties: { coletorId: { type: 'string', format: 'uuid' } },
} as const;

// Exige uma URL HTTP/HTTPS para a foto que comprova a conclusão.
export const conclusionBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['fotoUrl'],
  properties: { fotoUrl: { type: 'string', format: 'uri', maxLength: 500 } },
} as const;

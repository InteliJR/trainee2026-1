import type { MaterialType, RequestStatus } from '../../generated/prisma/enums.js';

export const API_TO_MATERIAL: Record<string, MaterialType> = {
  PAPEL: 'PAPER',
  PLASTICO: 'PLASTIC',
  VIDRO: 'GLASS',
  METAL: 'METAL',
  ELETRONICOS: 'ELECTRONICS',
  ORGANICO: 'ORGANIC',
  OUTRO: 'OTHER',
};

export const MATERIAL_TO_API: Record<MaterialType, string> = Object.fromEntries(
  Object.entries(API_TO_MATERIAL).map(([api, database]) => [database, api]),
) as Record<MaterialType, string>;

export const API_TO_STATUS: Record<string, RequestStatus> = {
  AGENDADA: 'SCHEDULED',
  PENDENTE: 'PENDING',
  ATRIBUIDA: 'ASSIGNED',
  EM_ATENDIMENTO: 'IN_SERVICE',
  CONCLUIDA: 'COMPLETED',
  CANCELADA: 'CANCELLED',
};

export const STATUS_TO_API: Record<RequestStatus, string> = Object.fromEntries(
  Object.entries(API_TO_STATUS).map(([api, database]) => [database, api]),
) as Record<RequestStatus, string>;

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

export interface ListCollectionRequestsQuery {
  status?: keyof typeof API_TO_STATUS;
  dataInicio?: string;
  dataFim?: string;
  pagina?: string;
  limite?: string;
}

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

export const cancellationBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['motivo', 'confirmado'],
  properties: {
    motivo: { type: 'string', minLength: 3, maxLength: 500 },
    confirmado: { const: true },
  },
} as const;

export const assignmentBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['coletorId'],
  properties: { coletorId: { type: 'string', format: 'uuid' } },
} as const;

export const conclusionBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['fotoUrl'],
  properties: { fotoUrl: { type: 'string', format: 'uri', maxLength: 500 } },
} as const;

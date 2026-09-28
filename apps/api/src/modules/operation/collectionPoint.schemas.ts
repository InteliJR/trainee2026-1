export type CollectionPointKindInput = 'HABITUAL' | 'ADICIONAL';

export interface CreateCollectionPointInput {
  nome: string;
  tipo: CollectionPointKindInput;
  latitude: number;
  longitude: number;
  circuito: number;
  descricao?: string;
  ativo?: boolean;
}

export interface UpdateCollectionPointInput {
  nome?: string;
  tipo?: CollectionPointKindInput;
  latitude?: number;
  longitude?: number;
  circuito?: number;
  descricao?: string | null;
  ativo?: boolean;
}

export interface ListCollectionPointsQuery {
  tipo?: CollectionPointKindInput;
  circuito?: string;
  ativo?: string;
}

export interface CollectionPointParams {
  pontoId: string;
}

export const collectionPointParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['pontoId'],
  properties: { pontoId: { type: 'string', format: 'uuid' } },
} as const;

const properties = {
  nome: { type: 'string', minLength: 2, maxLength: 120 },
  tipo: { type: 'string', enum: ['HABITUAL', 'ADICIONAL'] },
  latitude: { type: 'number', minimum: -90, maximum: 90 },
  longitude: { type: 'number', minimum: -180, maximum: 180 },
  circuito: { type: 'integer', minimum: 1 },
  descricao: { anyOf: [{ type: 'string', maxLength: 500 }, { type: 'null' }] },
  ativo: { type: 'boolean' },
} as const;

export const createCollectionPointBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['nome', 'tipo', 'latitude', 'longitude', 'circuito'],
  properties,
} as const;

export const updateCollectionPointBodySchema = {
  type: 'object',
  additionalProperties: false,
  minProperties: 1,
  properties,
} as const;

export const listCollectionPointsQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    tipo: { type: 'string', enum: ['HABITUAL', 'ADICIONAL'] },
    circuito: { type: 'string', pattern: '^[1-9]\\d*$' },
    ativo: { type: 'string', enum: ['true', 'false'] },
  },
} as const;

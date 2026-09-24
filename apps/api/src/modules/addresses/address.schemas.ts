export interface CreateAddressInput {
  rotulo: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  latitude: number;
  longitude: number;
  referencia?: string;
  fotoUrl?: string;
  padrao?: boolean;
}

export const createAddressBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['rotulo', 'logradouro', 'numero', 'bairro', 'cidade', 'estado', 'cep', 'latitude', 'longitude'],
  properties: {
    rotulo: { type: 'string', minLength: 1, maxLength: 50 },
    logradouro: { type: 'string', minLength: 2, maxLength: 180 },
    numero: { type: 'string', minLength: 1, maxLength: 20 },
    complemento: { type: 'string', maxLength: 100 },
    bairro: { type: 'string', minLength: 2, maxLength: 100 },
    cidade: { type: 'string', minLength: 2, maxLength: 100 },
    estado: { type: 'string', pattern: '^[A-Za-z]{2}$' },
    cep: { type: 'string', pattern: '^\\d{5}-?\\d{3}$' },
    latitude: { type: 'number', minimum: -90, maximum: 90 },
    longitude: { type: 'number', minimum: -180, maximum: 180 },
    referencia: { type: 'string', maxLength: 200 },
    fotoUrl: { type: 'string', format: 'uri', maxLength: 500 },
    padrao: { type: 'boolean', default: false },
  },
} as const;


/** Valida coordenadas, raio geográfico e identificador de ponto usados nas consultas operacionais. */
export interface GeographicQuery {
  latitude?: number;
  longitude?: number;
  raioKm?: number;
}

// Aceita coordenadas opcionais somente dentro dos limites geográficos e raio positivo.
export const geographicQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    latitude: { type: 'number', minimum: -90, maximum: 90 },
    longitude: { type: 'number', minimum: -180, maximum: 180 },
    raioKm: { type: 'number', exclusiveMinimum: 0, maximum: 500 },
  },
} as const;

// Exige UUID no parâmetro de detalhe do ponto de coleta.
export const pointParamsSchema = {
  type: 'object',
  required: ['pontoId'],
  properties: { pontoId: { type: 'string', format: 'uuid' } },
} as const;

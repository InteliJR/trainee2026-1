export interface GeographicQuery {
  latitude?: number;
  longitude?: number;
  raioKm?: number;
}

export const geographicQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    latitude: { type: 'number', minimum: -90, maximum: 90 },
    longitude: { type: 'number', minimum: -180, maximum: 180 },
    raioKm: { type: 'number', exclusiveMinimum: 0, maximum: 500 },
  },
} as const;

export const pointParamsSchema = {
  type: 'object',
  required: ['pontoId'],
  properties: { pontoId: { type: 'string', format: 'uuid' } },
} as const;


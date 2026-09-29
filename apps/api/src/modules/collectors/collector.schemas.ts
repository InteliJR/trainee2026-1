/** Define os campos e a validação para consulta de coletas e alteração de disponibilidade do coletor. */
import type { ListCollectionRequestsQuery } from '../requests/request.schemas.js';

// Reutiliza os mesmos filtros de status, período e paginação das solicitações gerais.
export type ListCollectorRequestsQuery = ListCollectionRequestsQuery;

// Representa a escolha de disponibilidade e um turno opcional do coletor.
export interface UpdateCollectorAvailabilityInput {
  disponivel: boolean;
  turno?: string | null;
}

// Valida booleano obrigatório e limita o turno a uma string curta.
export const updateCollectorAvailabilityBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['disponivel'],
  properties: {
    disponivel: { type: 'boolean' },
    turno: {
      anyOf: [
        { type: 'string', minLength: 2, maxLength: 80 },
        { type: 'null' },
      ],
    },
  },
} as const;

// Posição enviada pelo app do coletor durante uma coleta; a precisão (em metros) é opcional.
export interface ShareCollectorPositionInput {
  latitude: number;
  longitude: number;
  precisao?: number;
}

export const shareCollectorPositionBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['latitude', 'longitude'],
  properties: {
    latitude: { type: 'number', minimum: -90, maximum: 90 },
    longitude: { type: 'number', minimum: -180, maximum: 180 },
    precisao: { type: 'number', minimum: 0 },
  },
} as const;

import type { ListCollectionRequestsQuery } from '../requests/request.schemas.js';

export type ListCollectorRequestsQuery = ListCollectionRequestsQuery;

export interface UpdateCollectorAvailabilityInput {
  disponivel: boolean;
  turno?: string | null;
}

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


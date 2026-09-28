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

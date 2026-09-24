import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { AppError } from '../src/errors/appError.js';

describe('tratamento de erros', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp({
      logger: false,
      healthRepository: { isDatabaseAvailable: async () => true },
    });

    app.get('/teste/conflito', async () => {
      throw new AppError({
        statusCode: 409,
        code: 'REGRA_DE_NEGOCIO',
        message: 'A operação viola uma regra de negócio.',
        details: { campo: 'exemplo' },
      });
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('converte AppError para o contrato público em português', async () => {
    const response = await app.inject({ method: 'GET', url: '/teste/conflito' });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      codigo: 'REGRA_DE_NEGOCIO',
      mensagem: 'A operação viola uma regra de negócio.',
      detalhes: { campo: 'exemplo' },
    });
  });
});

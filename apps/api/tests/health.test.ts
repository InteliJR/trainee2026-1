import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import type { HealthRepository } from '../src/modules/health/health.repository.js';

function createApp(databaseAvailable: boolean): FastifyInstance {
  const healthRepository: HealthRepository = {
    isDatabaseAvailable: async () => databaseAvailable,
  };

  return buildApp({ healthRepository, logger: false });
}

describe('módulo de saúde', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('responde 200 quando o banco está disponível', async () => {
    app = createApp(true);

    const response = await app.inject({ method: 'GET', url: '/api/v1/saude' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'ok',
      bancoDeDados: 'conectado',
    });
  });

  it('responde erro padronizado quando o banco está indisponível', async () => {
    app = createApp(false);

    const response = await app.inject({ method: 'GET', url: '/api/v1/saude' });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      codigo: 'BANCO_INDISPONIVEL',
      mensagem: 'A API está ativa, mas o banco de dados está indisponível.',
      detalhes: null,
    });
  });

  it('remove a rota provisória em inglês', async () => {
    app = createApp(true);

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(404);
    expect(response.json().codigo).toBe('ROTA_NAO_ENCONTRADA');
  });
});

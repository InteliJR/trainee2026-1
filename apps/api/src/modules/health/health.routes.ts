/** Registra GET /api/v1/saude e delega a montagem da resposta ao HealthService. */
import type { FastifyPluginAsync } from 'fastify';
import type { HealthService } from './health.service.js';

// Exige que o serviço seja fornecido na montagem do plugin.
export interface HealthRoutesOptions {
  service: HealthService;
}

// Associa GET /saude à consulta do serviço e devolve o resultado com status 200.
export const healthRoutes: FastifyPluginAsync<HealthRoutesOptions> = async (app, options) => {
  // Executa a verificação a cada chamada para refletir quedas recentes do banco.
  app.get('/saude', async () => options.service.execute());
};

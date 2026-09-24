import type { FastifyPluginAsync } from 'fastify';
import type { HealthService } from './health.service.js';

export interface HealthRoutesOptions {
  service: HealthService;
}

export const healthRoutes: FastifyPluginAsync<HealthRoutesOptions> = async (app, options) => {
  app.get('/saude', async () => options.service.execute());
};

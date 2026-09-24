import Fastify from 'fastify';
import { errorHandler, notFoundHandler } from './errors/errorHandler.js';
import type { HealthRepository } from './modules/health/health.repository.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { HealthService } from './modules/health/health.service.js';

export interface BuildAppOptions {
  healthRepository: HealthRepository;
  logger?: boolean;
}

export function buildApp(options: BuildAppOptions) {
  const app = Fastify({ logger: options.logger ?? true });
  const healthService = new HealthService(options.healthRepository);

  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(notFoundHandler);

  app.register(healthRoutes, {
    prefix: '/api/v1',
    service: healthService,
  });

  return app;
}

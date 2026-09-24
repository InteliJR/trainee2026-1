import Fastify from 'fastify';
import { createDevelopmentIdentityMiddleware } from './auth/developmentIdentity.js';
import { PrismaDevelopmentIdentityRepository } from './auth/developmentIdentity.repository.js';
import type { NodeEnvironment } from './config/validateEnv.js';
import { errorHandler, notFoundHandler } from './errors/errorHandler.js';
import type { PrismaClient } from './generated/prisma/client.js';
import type { EcoRotaClient } from './integration/ecorotaClient.js';
import { PrismaAddressRepository } from './modules/addresses/address.repository.js';
import { addressRoutes } from './modules/addresses/address.routes.js';
import { AddressService } from './modules/addresses/address.service.js';
import { PrismaGamificationRepository } from './modules/gamification/gamification.repository.js';
import { gamificationRoutes } from './modules/gamification/gamification.routes.js';
import { GamificationService } from './modules/gamification/gamification.service.js';
import type { HealthRepository } from './modules/health/health.repository.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { HealthService } from './modules/health/health.service.js';
import { PrismaRequestRepository } from './modules/requests/request.repository.js';
import { requestRoutes } from './modules/requests/request.routes.js';
import { RequestService } from './modules/requests/request.service.js';

export interface BuildAppOptions {
  healthRepository: HealthRepository;
  database?: PrismaClient;
  ecoRotaClient?: EcoRotaClient;
  nodeEnv?: NodeEnvironment;
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

  if (options.database) {
    const identify = createDevelopmentIdentityMiddleware(
      new PrismaDevelopmentIdentityRepository(options.database),
      options.nodeEnv ?? 'development',
    );

    app.register(addressRoutes, {
      prefix: '/api/v1',
      identify,
      service: new AddressService(new PrismaAddressRepository(options.database)),
    });
    app.register(requestRoutes, {
      prefix: '/api/v1',
      identify,
      service: new RequestService(new PrismaRequestRepository(options.database), options.ecoRotaClient),
    });
    app.register(gamificationRoutes, {
      prefix: '/api/v1',
      identify,
      service: new GamificationService(new PrismaGamificationRepository(options.database)),
    });
  }

  return app;
}

/**
 * Monta a aplicação Fastify sem abrir porta de rede.
 * Conecta erros, cookie JWT, CORS, serviços, repositórios e rotas REST; essa separação permite testes com app.inject.
 */
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import { createAuthenticationMiddleware } from './auth/authentication.js';
import { AuthTokenService } from './auth/authToken.js';
import type { NodeEnvironment } from './config/validateEnv.js';
import { errorHandler, notFoundHandler } from './errors/errorHandler.js';
import type { PrismaClient } from './generated/prisma/client.js';
import type { EcoRotaClient } from './integration/ecorotaClient.js';
import { operationState } from './integration/operation-state/index.js';
import { collectorPositions } from './realtime/collectorPositions.js';
import type { StreamStatus } from './integration/ws/ecoRotaWsConsumer.js';
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
import { operationRoutes } from './modules/operation/operation.routes.js';
import { OperationService } from './modules/operation/operation.service.js';
import { PrismaOperationIndicatorsRepository } from './modules/operation/operationIndicators.repository.js';
import { PrismaCollectionPointRepository } from './modules/operation/collectionPoint.repository.js';
import { collectionPointRoutes } from './modules/operation/collectionPoint.routes.js';
import { CollectionPointService } from './modules/operation/collectionPoint.service.js';
import { PrismaCollectorRepository } from './modules/collectors/collector.repository.js';
import { collectorRoutes } from './modules/collectors/collector.routes.js';
import { CollectorService } from './modules/collectors/collector.service.js';
import { PrismaAuthRepository } from './modules/auth/auth.repository.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { AuthService } from './modules/auth/auth.service.js';
import type { LocalCollectorSimulation } from './modules/local-simulation/localCollectorSimulation.js';
import { localSimulationRoutes } from './modules/local-simulation/localSimulation.routes.js';
import { PrismaProfileRepository } from './modules/profiles/profile.repository.js';
import { profileRoutes } from './modules/profiles/profile.routes.js';
import { ProfileService } from './modules/profiles/profile.service.js';

// Permite injetar banco, integrações, ambiente e logger para produção ou testes isolados.
export interface BuildAppOptions {
  healthRepository: HealthRepository;
  database?: PrismaClient;
  ecoRotaClient?: EcoRotaClient;
  localSimulation?: LocalCollectorSimulation;
  streamStatusProvider?: () => StreamStatus;
  nodeEnv?: NodeEnvironment;
  jwtSecret?: string;
  webOrigin?: string;
  logger?: boolean;
}

// Constrói o grafo de dependências e registra todos os plugins sob o prefixo /api/v1.
export function buildApp(options: BuildAppOptions) {
  // Cria a instância e permite silenciar logs em testes.
  const app = Fastify({ logger: options.logger ?? true });
  // Define ambiente e origem uma única vez para cookies e CORS.
  const nodeEnv = options.nodeEnv ?? 'development';
  const webOrigin = options.webOrigin ?? 'http://localhost:5173';
  // Saúde é independente dos módulos de negócio e sempre fica disponível.
  const healthService = new HealthService(options.healthRepository);

  // Faz o parse seguro dos cookies antes que qualquer middleware tente ler a sessão JWT.
  app.register(cookie);
  // Autoriza somente o frontend configurado e permite o envio do cookie entre origens.
  app.register(cors, { origin: webOrigin, credentials: true });

  // Garante o mesmo formato de falha para rotas registradas e URLs inexistentes.
  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(notFoundHandler);

  // Registra saúde mesmo quando nenhum Prisma completo foi injetado.
  app.register(healthRoutes, {
    prefix: '/api/v1',
    service: healthService,
  });

  // Registra módulos persistentes somente quando o cliente de banco está disponível.
  if (options.database) {
    // Impede que módulos protegidos sejam montados sem um segredo real de assinatura.
    if (!options.jwtSecret) throw new Error('JWT_SECRET é obrigatório para registrar as rotas protegidas.');
    // Compartilha o mesmo repositório entre cadastro, login, sessão e confirmação do ator.
    const authRepository = new PrismaAuthRepository(options.database);
    // Compartilha assinatura e verificação entre rotas REST e o restante da aplicação.
    const tokenService = new AuthTokenService(options.jwtSecret);
    // Substitui definitivamente o cabeçalho temporário pelo cookie JWT.
    const identify = createAuthenticationMiddleware(tokenService, authRepository);
    // Compartilha RequestService com rotas gerais e fluxo específico do coletor.
    const requestService = new RequestService(
      new PrismaRequestRepository(options.database),
      options.ecoRotaClient,
      // Rotas da EcoRota em memória, usadas para estimar a chegada do coletor.
      operationState,
    );

    // Registra os quatro endpoints de autenticação antes das demais rotas protegidas.
    app.register(authRoutes, {
      prefix: '/api/v1',
      service: new AuthService(authRepository),
      tokenService,
      authenticate: identify,
      nodeEnv,
    });

    // Conecta cada plugin a seus serviços/repositórios e mantém o prefixo versionado uniforme.
    app.register(addressRoutes, {
      prefix: '/api/v1',
      identify,
      service: new AddressService(new PrismaAddressRepository(options.database)),
    });
    // Expõe o ciclo de vida das solicitações.
    app.register(requestRoutes, {
      prefix: '/api/v1',
      identify,
      service: requestService,
    });
    // Expõe somente consultas de gamificação.
    app.register(gamificationRoutes, {
      prefix: '/api/v1',
      identify,
      service: new GamificationService(new PrismaGamificationRepository(options.database)),
    });
    // Expõe leituras do cache operacional compartilhado.
    app.register(operationRoutes, {
      prefix: '/api/v1',
      identify,
      service: new OperationService(
        operationState,
        options.streamStatusProvider,
        // Mantém o relógio padrão do serviço sem criar uma dependência global adicional.
        undefined,
        // Fornece as contagens históricas de coletas e novos moradores persistidas no Supabase.
        new PrismaOperationIndicatorsRepository(options.database),
      ),
    });
    app.register(collectionPointRoutes, {
      prefix: '/api/v1',
      identify,
      service: new CollectionPointService(new PrismaCollectionPointRepository(options.database)),
    });
    app.register(profileRoutes, {
      prefix: '/api/v1',
      identify,
      service: new ProfileService(new PrismaProfileRepository(options.database)),
    });
    if (options.localSimulation) {
      app.register(localSimulationRoutes, {
        prefix: '/api/v1',
        identify,
        simulation: options.localSimulation,
      });
    }
    // Expõe perfil, coletas e disponibilidade do coletor.
    app.register(collectorRoutes, {
      prefix: '/api/v1',
      identify,
      service: new CollectorService(
        new PrismaCollectorRepository(options.database),
        requestService,
        options.ecoRotaClient,
        collectorPositions,
      ),
    });
  }

  // Devolve a aplicação pronta para listen em produção ou inject nos testes.
  return app;
}

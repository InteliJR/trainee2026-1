import type { Actor } from '../auth/actor.js';

declare module 'fastify' {
  interface FastifyRequest {
    actor: Actor;
  }
}


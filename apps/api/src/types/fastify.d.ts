// Amplia o Fastify para que toda requisição possa carregar o ator confirmado pelo middleware de identidade.
import type { Actor } from '../auth/actor.js';

declare module 'fastify' {
  interface FastifyRequest {
    actor: Actor;
  }
}

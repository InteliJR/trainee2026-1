import type { FastifyPluginAsync, preHandlerHookHandler } from 'fastify';
import { authorizeRoles } from '../../auth/authentication.js';
import { AppError } from '../../errors/appError.js';
import type { LocalCollectorSimulation } from './localCollectorSimulation.js';

interface Options {
  simulation: LocalCollectorSimulation;
  identify: preHandlerHookHandler;
}

interface StartBody {
  pontoOrigemId: string;
  pontoDestinoId: string;
}

const startBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['pontoOrigemId', 'pontoDestinoId'],
  properties: {
    pontoOrigemId: { type: 'string', format: 'uuid' },
    pontoDestinoId: { type: 'string', format: 'uuid' },
  },
} as const;

function translate(error: unknown): never {
  const code = error instanceof Error ? error.message : '';
  const errors: Record<string, { statusCode: number; message: string }> = {
    PONTOS_SIMULACAO_DEVEM_SER_DISTINTOS: { statusCode: 400, message: 'Escolha dois pontos diferentes para a simulação.' },
    PONTO_LOCAL_NAO_ENCONTRADO: { statusCode: 404, message: 'Um dos pontos locais não foi encontrado.' },
    PONTO_LOCAL_INATIVO: { statusCode: 409, message: 'Os dois pontos precisam estar ativos.' },
    SIMULACAO_LOCAL_EM_EXECUCAO: { statusCode: 409, message: 'Já existe uma simulação local em execução.' },
  };
  const match = errors[code];
  if (!match) throw error;
  throw new AppError({ statusCode: match.statusCode, code, message: match.message });
}

export const localSimulationRoutes: FastifyPluginAsync<Options> = async (app, options) => {
  const operatorOnly = [options.identify, authorizeRoles('OPERADOR')];

  app.get('/operacao/simulacao-local', { preHandler: operatorOnly }, async () => options.simulation.getSnapshot());

  app.post<{ Body: StartBody }>(
    '/operacao/simulacao-local/iniciar',
    { preHandler: operatorOnly, schema: { body: startBodySchema } },
    async (request) => {
      try {
        return await options.simulation.start(request.body.pontoOrigemId, request.body.pontoDestinoId);
      } catch (error) {
        return translate(error);
      }
    },
  );

  app.post('/operacao/simulacao-local/parar', { preHandler: operatorOnly }, async () => options.simulation.stop());
};

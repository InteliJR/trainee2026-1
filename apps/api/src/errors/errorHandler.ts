import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from './appError.js';

export interface ErrorResponse {
  codigo: string;
  mensagem: string;
  detalhes: unknown;
}

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
): FastifyReply {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      codigo: error.code,
      mensagem: error.message,
      detalhes: error.details,
    } satisfies ErrorResponse);
  }

  if (error.validation) {
    return reply.status(400).send({
      codigo: 'DADOS_INVALIDOS',
      mensagem: 'Os dados enviados são inválidos.',
      detalhes: error.validation,
    } satisfies ErrorResponse);
  }

  request.log.error({ err: error }, 'Erro não tratado na requisição');

  return reply.status(500).send({
    codigo: 'ERRO_INTERNO',
    mensagem: 'Ocorreu um erro interno no servidor.',
    detalhes: null,
  } satisfies ErrorResponse);
}

export function notFoundHandler(request: FastifyRequest, reply: FastifyReply): FastifyReply {
  return reply.status(404).send({
    codigo: 'ROTA_NAO_ENCONTRADA',
    mensagem: `A rota ${request.method} ${request.url} não foi encontrada.`,
    detalhes: null,
  } satisfies ErrorResponse);
}

/** Traduz erros conhecidos, validações e falhas inesperadas para o formato único de resposta da API. */
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from './appError.js';

// Contrato uniforme devolvido pela API para permitir tratamento previsível no frontend.
export interface ErrorResponse {
  codigo: string;
  mensagem: string;
  detalhes: unknown;
}

// Separa erros esperados, falhas de schema e erros 500 antes de montar a resposta.
export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
): FastifyReply {
  // Preserva status e código das violações previstas pelas regras de negócio.
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      codigo: error.code,
      mensagem: error.message,
      detalhes: error.details,
    } satisfies ErrorResponse);
  }

  // Traduz erros produzidos pelos JSON Schemas do Fastify para 400.
  if (error.validation) {
    return reply.status(400).send({
      codigo: 'DADOS_INVALIDOS',
      mensagem: 'Os dados enviados são inválidos.',
      detalhes: error.validation,
    } satisfies ErrorResponse);
  }

  // Registra detalhes somente no servidor e devolve mensagem segura ao cliente.
  request.log.error({ err: error }, 'Erro não tratado na requisição');

  return reply.status(500).send({
    codigo: 'ERRO_INTERNO',
    mensagem: 'Ocorreu um erro interno no servidor.',
    detalhes: null,
  } satisfies ErrorResponse);
}

// Retorna 404 padronizado incluindo o método e a URL que não encontraram rota.
export function notFoundHandler(request: FastifyRequest, reply: FastifyReply): FastifyReply {
  return reply.status(404).send({
    codigo: 'ROTA_NAO_ENCONTRADA',
    mensagem: `A rota ${request.method} ${request.url} não foi encontrada.`,
    detalhes: null,
  } satisfies ErrorResponse);
}

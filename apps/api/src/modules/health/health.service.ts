/** Combina estado da API e disponibilidade do banco para produzir a resposta do endpoint de saúde. */
import { AppError } from '../../errors/appError.js';
import type { HealthRepository } from './health.repository.js';

// Descreve a resposta de sucesso enviada quando aplicação e banco estão disponíveis.
export interface HealthResponse {
  status: 'ok';
  bancoDeDados: 'conectado';
  horario: string;
}

// Converte indisponibilidade do banco em AppError 503 em vez de retornar falso silenciosamente.
export class HealthService {
  // Recebe a verificação de banco para permitir simulações nos testes.
  constructor(private readonly repository: HealthRepository) {}

  // Confirma o banco e monta horário atual somente quando todo o serviço está saudável.
  async execute(): Promise<HealthResponse> {
    const databaseAvailable = await this.repository.isDatabaseAvailable();

    // Torna indisponibilidade explícita para balanceadores e monitoramento.
    if (!databaseAvailable) {
      throw new AppError({
        statusCode: 503,
        code: 'BANCO_INDISPONIVEL',
        message: 'A API está ativa, mas o banco de dados está indisponível.',
      });
    }

    return {
      status: 'ok',
      bancoDeDados: 'conectado',
      horario: new Date().toISOString(),
    };
  }
}

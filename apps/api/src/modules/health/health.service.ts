import { AppError } from '../../errors/appError.js';
import type { HealthRepository } from './health.repository.js';

export interface HealthResponse {
  status: 'ok';
  bancoDeDados: 'conectado';
  horario: string;
}

export class HealthService {
  constructor(private readonly repository: HealthRepository) {}

  async execute(): Promise<HealthResponse> {
    const databaseAvailable = await this.repository.isDatabaseAvailable();

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

/** Camada de acesso que executa uma consulta mínima para confirmar disponibilidade do PostgreSQL. */
import type { PrismaClient } from '../../generated/prisma/client.js';

// Permite trocar a verificação Prisma por um fake nos testes do endpoint.
export interface HealthRepository {
  isDatabaseAvailable(): Promise<boolean>;
}

// Usa SELECT 1 para testar a conexão sem depender de uma tabela de negócio.
export class PrismaHealthRepository implements HealthRepository {
  // Guarda o Prisma compartilhado usado na consulta de disponibilidade.
  constructor(private readonly database: PrismaClient) {}

  // Retorna false em qualquer falha de conexão para o serviço produzir 503 controlado.
  async isDatabaseAvailable(): Promise<boolean> {
    // Isola falhas do driver para devolver um booleano simples ao serviço.
    try {
      await this.database.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}

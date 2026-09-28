/**
 * Consulta no PostgreSQL os indicadores históricos que não podem ser reconstruídos pelo snapshot atual da EcoRota.
 * O serviço operacional combina este resumo com demanda, capacidade e telemetria mantidas em memória.
 */
import type { PrismaClient } from '../../generated/prisma/client.js';
import { RequestStatus, UserRole } from '../../generated/prisma/enums.js';

// Define os inícios dos períodos usados nas contagens históricas.
export interface IndicatorPeriods {
  // Marca o começo do dia atual em UTC.
  dayStart: Date;
  // Marca a segunda-feira que iniciou a semana atual em UTC.
  weekStart: Date;
  // Marca o primeiro dia do mês atual em UTC.
  monthStart: Date;
}

// Agrupa contagens históricas já calculadas pelo banco.
export interface HistoricalOperationIndicators {
  // Conta coletas concluídas em cada janela solicitada.
  completedCollections: {
    day: number;
    week: number;
    month: number;
  };
  // Conta moradores cadastrados em cada janela solicitada.
  newResidents: {
    day: number;
    week: number;
    month: number;
  };
  // Conta cancelamentos do mês para calcular a taxa entre resultados terminais.
  cancelledCollectionsInMonth: number;
}

// Abstrai as agregações para permitir testes do serviço sem abrir uma conexão real.
export interface OperationIndicatorsRepository {
  // Devolve todas as contagens em uma única unidade lógica de leitura.
  summarize(periods: IndicatorPeriods): Promise<HistoricalOperationIndicators>;
}

// Executa as contagens com o mesmo Prisma compartilhado pelos demais módulos.
export class PrismaOperationIndicatorsRepository implements OperationIndicatorsRepository {
  // Guarda a conexão injetada pelo bootstrap da aplicação.
  constructor(private readonly database: PrismaClient) {}

  // Consulta períodos e papéis diretamente por índices e campos persistidos.
  async summarize(periods: IndicatorPeriods): Promise<HistoricalOperationIndicators> {
    // Executa as contagens independentes em paralelo dentro de uma transação de leitura.
    const [
      completedDay,
      completedWeek,
      completedMonth,
      residentsDay,
      residentsWeek,
      residentsMonth,
      cancelledMonth,
    ] = await this.database.$transaction([
      // Usa completedAt para contar somente conclusões efetivamente confirmadas.
      this.database.collectionRequest.count({
        where: { status: RequestStatus.COMPLETED, completedAt: { gte: periods.dayStart } },
      }),
      // Reaproveita a mesma condição com o começo da semana.
      this.database.collectionRequest.count({
        where: { status: RequestStatus.COMPLETED, completedAt: { gte: periods.weekStart } },
      }),
      // Limita a contagem mensal ao mês corrente.
      this.database.collectionRequest.count({
        where: { status: RequestStatus.COMPLETED, completedAt: { gte: periods.monthStart } },
      }),
      // Conta somente usuários moradores criados desde o início do dia.
      this.database.user.count({
        where: { role: UserRole.MORADOR, createdAt: { gte: periods.dayStart } },
      }),
      // Conta somente usuários moradores criados desde o início da semana.
      this.database.user.count({
        where: { role: UserRole.MORADOR, createdAt: { gte: periods.weekStart } },
      }),
      // Conta somente usuários moradores criados desde o início do mês.
      this.database.user.count({
        where: { role: UserRole.MORADOR, createdAt: { gte: periods.monthStart } },
      }),
      // Usa updatedAt porque o modelo atual não possui um campo cancelledAt dedicado.
      this.database.collectionRequest.count({
        where: { status: RequestStatus.CANCELLED, updatedAt: { gte: periods.monthStart } },
      }),
    ]);

    // Converte o vetor posicional em um objeto explícito consumido pelo serviço.
    return {
      completedCollections: { day: completedDay, week: completedWeek, month: completedMonth },
      newResidents: { day: residentsDay, week: residentsWeek, month: residentsMonth },
      cancelledCollectionsInMonth: cancelledMonth,
    };
  }
}

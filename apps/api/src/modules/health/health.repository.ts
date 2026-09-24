import type { PrismaClient } from '../../generated/prisma/client.js';

export interface HealthRepository {
  isDatabaseAvailable(): Promise<boolean>;
}

export class PrismaHealthRepository implements HealthRepository {
  constructor(private readonly database: PrismaClient) {}

  async isDatabaseAvailable(): Promise<boolean> {
    try {
      await this.database.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}

import type { PrismaClient } from '../generated/prisma/client.js';
import type { Actor } from './actor.js';

export interface DevelopmentIdentityRepository {
  findActorById(id: string): Promise<Actor | null>;
}

export class PrismaDevelopmentIdentityRepository implements DevelopmentIdentityRepository {
  constructor(private readonly database: PrismaClient) {}

  async findActorById(id: string): Promise<Actor | null> {
    return this.database.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });
  }
}


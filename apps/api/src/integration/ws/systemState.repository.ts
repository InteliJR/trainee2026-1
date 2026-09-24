import type { PrismaClient } from '../../generated/prisma/client.js';

export interface StreamCursor {
  generation: number;
  revision: number;
  snapshotAt?: Date;
}

export interface SystemStateRepository {
  saveStreamCursor(cursor: StreamCursor): Promise<void>;
}

export class PrismaSystemStateRepository implements SystemStateRepository {
  constructor(private readonly database: PrismaClient) {}

  async saveStreamCursor(cursor: StreamCursor): Promise<void> {
    await this.database.systemState.upsert({
      where: { key: 'ecorota-stream' },
      update: {
        generation: cursor.generation,
        lastRevision: cursor.revision,
        ...(cursor.snapshotAt ? { lastSnapshotAt: cursor.snapshotAt } : {}),
      },
      create: {
        key: 'ecorota-stream',
        generation: cursor.generation,
        lastRevision: cursor.revision,
        lastSnapshotAt: cursor.snapshotAt,
      },
    });
  }
}


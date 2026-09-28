/** Persiste geração, revisão e horário do último snapshot para observabilidade da sincronização externa. */
import type { PrismaClient } from '../../generated/prisma/client.js';

// Reúne a posição externa que deve ser persistida após processamento bem-sucedido.
export interface StreamCursor {
  generation: number;
  revision: number;
  snapshotAt?: Date;
}

// Abstrai a persistência do cursor para o consumidor não conhecer Prisma.
export interface SystemStateRepository {
  saveStreamCursor(cursor: StreamCursor): Promise<void>;
}

// Usa upsert em uma chave fixa para manter apenas o cursor mais recente do stream.
export class PrismaSystemStateRepository implements SystemStateRepository {
  // Guarda o Prisma compartilhado usado no upsert do cursor.
  constructor(private readonly database: PrismaClient) {}

  // Cria ou atualiza o registro fixo sem duplicar estado do stream.
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

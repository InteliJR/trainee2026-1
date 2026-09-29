/**
 * Posições dos coletores cadastrados na plataforma (não os da EcoRota), enviadas pelo app do coletor.
 * Ficam só em memória e expiram: um coletor que fechou o app some do mapa em vez de ficar parado nele.
 */
import { EventEmitter } from 'node:events';

export interface CollectorPositionEntry {
  // UUID do usuário coletor.
  collectorUserId: string;
  name: string;
  // [longitude, latitude]
  coordinates: [number, number];
  accuracyMeters: number | null;
  observedAt: string;
}

// Tempo máximo sem nova posição antes de o coletor deixar de aparecer.
export const POSITION_MAX_AGE_MS = 5 * 60_000;

export class CollectorPositionStore {
  private readonly positions = new Map<string, CollectorPositionEntry>();
  private readonly emitter = new EventEmitter();

  constructor(private readonly now: () => number = () => Date.now()) {}

  // Guarda a posição mais recente do coletor e avisa quem acompanha em tempo real.
  update(entry: CollectorPositionEntry): void {
    this.positions.set(entry.collectorUserId, entry);
    this.emitter.emit('update', entry);
  }

  // Posições ainda recentes; as antigas são descartadas aqui.
  list(): CollectorPositionEntry[] {
    const limit = this.now() - POSITION_MAX_AGE_MS;
    for (const [id, entry] of this.positions) {
      if (Date.parse(entry.observedAt) < limit) this.positions.delete(id);
    }
    return [...this.positions.values()];
  }

  onUpdate(listener: (entry: CollectorPositionEntry) => void): () => void {
    this.emitter.on('update', listener);
    return () => this.emitter.off('update', listener);
  }
}

// Instância única compartilhada pela rota do coletor e pelo Socket.IO.
export const collectorPositions = new CollectorPositionStore();

import type { CollectionPoint, CollectionPointKind, PrismaClient } from '../../generated/prisma/client.js';

export interface CollectionPointFilters {
  kind?: CollectionPointKind;
  circuit?: number;
  active?: boolean;
}

export interface CreateCollectionPointData {
  name: string;
  kind: CollectionPointKind;
  latitude: number;
  longitude: number;
  circuit: number;
  description: string | null;
  active: boolean;
  createdByUserId: string;
}

export type UpdateCollectionPointData = Partial<Omit<CreateCollectionPointData, 'createdByUserId'>>;

export interface CollectionPointRepository {
  create(data: CreateCollectionPointData): Promise<CollectionPoint>;
  list(filters: CollectionPointFilters): Promise<CollectionPoint[]>;
  findById(id: string): Promise<CollectionPoint | null>;
  update(id: string, data: UpdateCollectionPointData): Promise<CollectionPoint | null>;
  archive(id: string): Promise<boolean>;
}

export class PrismaCollectionPointRepository implements CollectionPointRepository {
  constructor(private readonly database: PrismaClient) {}

  create(data: CreateCollectionPointData): Promise<CollectionPoint> {
    return this.database.collectionPoint.create({ data });
  }

  list(filters: CollectionPointFilters): Promise<CollectionPoint[]> {
    return this.database.collectionPoint.findMany({
      where: {
        deletedAt: null,
        kind: filters.kind,
        circuit: filters.circuit,
        active: filters.active,
      },
      orderBy: [{ active: 'desc' }, { circuit: 'asc' }, { name: 'asc' }],
    });
  }

  findById(id: string): Promise<CollectionPoint | null> {
    return this.database.collectionPoint.findFirst({ where: { id, deletedAt: null } });
  }

  async update(id: string, data: UpdateCollectionPointData): Promise<CollectionPoint | null> {
    const result = await this.database.collectionPoint.updateMany({
      where: { id, deletedAt: null },
      data,
    });
    if (result.count === 0) return null;
    return this.database.collectionPoint.findUnique({ where: { id } });
  }

  async archive(id: string): Promise<boolean> {
    const result = await this.database.collectionPoint.updateMany({
      where: { id, deletedAt: null },
      data: { active: false, deletedAt: new Date() },
    });
    return result.count === 1;
  }
}

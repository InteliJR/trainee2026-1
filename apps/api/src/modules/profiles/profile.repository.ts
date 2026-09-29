import type { PrismaClient } from '../../generated/prisma/client.js';
import type { UserRole } from '../../generated/prisma/enums.js';
import { AuthRepositoryConflictError, isPrismaUniqueConstraintError } from '../auth/auth.repository.js';

export interface ListedProfile {
  id: string;
  name: string;
  email: string | null;
  role: Extract<UserRole, 'MORADOR' | 'COLETOR'>;
  createdAt: Date;
  completedCollections: number;
  available: boolean | null;
  shift: string | null;
}

export interface CreateProfileData {
  name: string;
  email: string;
  phone: string | null;
  passwordHash: string;
  role: ListedProfile['role'];
}

export interface UpdateProfileData {
  name?: string;
  email?: string;
  phone?: string | null;
}

export interface ProfileRepository {
  list(role: ListedProfile['role'], page: number, limit: number): Promise<{ profiles: ListedProfile[]; total: number }>;
  get(userId: string): Promise<ListedProfile | null>;
  create(data: CreateProfileData): Promise<ListedProfile>;
  update(userId: string, data: UpdateProfileData): Promise<ListedProfile | null>;
  remove(userId: string): Promise<boolean>;
}

export class PrismaProfileRepository implements ProfileRepository {
  constructor(private readonly database: PrismaClient) {}

  async create(data: CreateProfileData): Promise<ListedProfile> {
    let user;
    try {
      user = await this.database.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: { name: data.name, email: data.email, phone: data.phone, passwordHash: data.passwordHash, role: data.role },
          select: { id: true, name: true, email: true, role: true, createdAt: true },
        });
        if (data.role === 'COLETOR') {
          await tx.collectorProfile.create({ data: { userId: created.id, available: false } });
        }
        return created;
      });
    } catch (error) {
      // E-mail e telefone são únicos; a rota transforma este erro em 409 em vez de 500.
      if (isPrismaUniqueConstraintError(error)) throw new AuthRepositoryConflictError();
      throw error;
    }
    return { id: user.id, name: user.name, email: user.email, role: user.role as ListedProfile['role'], createdAt: user.createdAt, completedCollections: 0, available: null, shift: null };
  }

  async update(userId: string, data: UpdateProfileData): Promise<ListedProfile | null> {
    try {
      const updated = await this.database.user.update({
        where: { id: userId },
        data: { ...(data.name !== undefined && { name: data.name }), ...(data.email !== undefined && { email: data.email }), ...(data.phone !== undefined && { phone: data.phone }) },
        select: { id: true, name: true, email: true, role: true, createdAt: true, collectorProfile: { select: { available: true, availabilityShift: true } } },
      });
      return {
        id: updated.id, name: updated.name, email: updated.email, role: updated.role as ListedProfile['role'], createdAt: updated.createdAt, completedCollections: 0,
        available: updated.collectorProfile?.available ?? null, shift: updated.collectorProfile?.availabilityShift ?? null,
      };
    } catch { return null; }
  }

  async remove(userId: string): Promise<boolean> {
    try { await this.database.user.delete({ where: { id: userId } }); return true; } catch { return false; }
  }

  async get(userId: string): Promise<ListedProfile | null> {
    const user = await this.database.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, createdAt: true, collectorProfile: { select: { id: true, available: true, availabilityShift: true } } },
    });
    if (!user || (user.role !== 'MORADOR' && user.role !== 'COLETOR')) return null;
    const completedCollections = await this.database.collectionRequest.count({
      where: user.role === 'MORADOR'
        ? { residentId: user.id, status: 'COMPLETED' }
        : { collectorProfileId: user.collectorProfile?.id ?? '', status: 'COMPLETED' },
    });
    return {
      id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt, completedCollections,
      available: user.collectorProfile?.available ?? null,
      shift: user.collectorProfile?.availabilityShift ?? null,
    };
  }

  async list(role: ListedProfile['role'], page: number, limit: number) {
    const where = { role };
    const [users, total] = await this.database.$transaction([
      this.database.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          collectorProfile: { select: { id: true, available: true, availabilityShift: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.database.user.count({ where }),
    ]);

    const ids = users.map((user) => user.id);
    const profileIds = users.flatMap((user) => user.collectorProfile ? [user.collectorProfile.id] : []);
    const counts = role === 'MORADOR'
      ? await this.database.collectionRequest.groupBy({
          by: ['residentId'],
          where: { status: 'COMPLETED', residentId: { in: ids } },
          _count: { _all: true },
        })
      : await this.database.collectionRequest.groupBy({
          by: ['collectorProfileId'],
          where: { status: 'COMPLETED', collectorProfileId: { in: profileIds } },
          _count: { _all: true },
        });
    const countById = new Map<string, number>();
    if (role === 'MORADOR') {
      for (const row of counts) {
        if ('residentId' in row) countById.set(row.residentId, row._count._all);
      }
    } else {
      for (const row of counts) {
        if ('collectorProfileId' in row && row.collectorProfileId) countById.set(row.collectorProfileId, row._count._all);
      }
    }

    return {
      total,
      profiles: users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role,
        createdAt: user.createdAt,
        completedCollections: countById.get(role === 'MORADOR' ? user.id : user.collectorProfile?.id ?? '') ?? 0,
        available: user.collectorProfile?.available ?? null,
        shift: user.collectorProfile?.availabilityShift ?? null,
      })),
    };
  }
}

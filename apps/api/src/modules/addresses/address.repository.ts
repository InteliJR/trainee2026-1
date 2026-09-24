import type { Address, PrismaClient } from '../../generated/prisma/client.js';
import type { CreateAddressInput } from './address.schemas.js';

export interface AddressRepository {
  create(userId: string, input: CreateAddressInput): Promise<Address>;
  listByUser(userId: string): Promise<Address[]>;
}

export class PrismaAddressRepository implements AddressRepository {
  constructor(private readonly database: PrismaClient) {}

  async create(userId: string, input: CreateAddressInput): Promise<Address> {
    return this.database.$transaction(async (transaction) => {
      if (input.padrao) {
        await transaction.address.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return transaction.address.create({
        data: {
          userId,
          label: input.rotulo.trim(),
          street: input.logradouro.trim(),
          number: input.numero.trim(),
          complement: input.complemento?.trim() || null,
          district: input.bairro.trim(),
          city: input.cidade.trim(),
          state: input.estado.toUpperCase(),
          zipCode: input.cep.replace(/\D/g, ''),
          latitude: input.latitude,
          longitude: input.longitude,
          reference: input.referencia?.trim() || null,
          photoUrl: input.fotoUrl?.trim() || null,
          isDefault: input.padrao ?? false,
        },
      });
    });
  }

  listByUser(userId: string): Promise<Address[]> {
    return this.database.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }
}


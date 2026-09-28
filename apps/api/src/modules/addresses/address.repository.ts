/** Persiste endereços e garante no PostgreSQL que somente um endereço do morador fique como padrão. */
import type { Address, PrismaClient } from '../../generated/prisma/client.js';
import type { CreateAddressInput } from './address.schemas.js';

// Define somente as operações de persistência necessárias ao serviço de endereços.
export interface AddressRepository {
  create(userId: string, input: CreateAddressInput): Promise<Address>;
  listByUser(userId: string): Promise<Address[]>;
}

// Implementa criação e listagem preservando propriedade e unicidade lógica do endereço padrão.
export class PrismaAddressRepository implements AddressRepository {
  // Guarda o Prisma compartilhado pela aplicação.
  constructor(private readonly database: PrismaClient) {}

  // Usa transação para remover o padrão anterior antes de criar um novo padrão.
  async create(userId: string, input: CreateAddressInput): Promise<Address> {
    return this.database.$transaction(async (transaction) => {
      // Novo padrão exige desmarcar os anteriores dentro da mesma transação.
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

  // Lista somente endereços do usuário, priorizando o padrão e depois os mais recentes.
  listByUser(userId: string): Promise<Address[]> {
    return this.database.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }
}

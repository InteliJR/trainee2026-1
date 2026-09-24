import type { Actor } from '../../auth/actor.js';
import { AppError } from '../../errors/appError.js';
import type { Address } from '../../generated/prisma/client.js';
import type { AddressRepository } from './address.repository.js';
import type { CreateAddressInput } from './address.schemas.js';

function ensureResident(actor: Actor): void {
  if (actor.role !== 'MORADOR') {
    throw new AppError({
      statusCode: 403,
      code: 'PAPEL_NAO_AUTORIZADO',
      message: 'Apenas moradores podem gerenciar endereços.',
    });
  }
}

export function serializeAddress(address: Address) {
  return {
    id: address.id,
    rotulo: address.label,
    logradouro: address.street,
    numero: address.number,
    complemento: address.complement,
    bairro: address.district,
    cidade: address.city,
    estado: address.state,
    cep: address.zipCode,
    latitude: Number(address.latitude),
    longitude: Number(address.longitude),
    referencia: address.reference,
    fotoUrl: address.photoUrl,
    padrao: address.isDefault,
    criadoEm: address.createdAt.toISOString(),
    atualizadoEm: address.updatedAt.toISOString(),
  };
}

export class AddressService {
  constructor(private readonly repository: AddressRepository) {}

  async create(actor: Actor, input: CreateAddressInput) {
    ensureResident(actor);
    const address = await this.repository.create(actor.id, input);
    return serializeAddress(address);
  }

  async list(actor: Actor) {
    ensureResident(actor);
    const addresses = await this.repository.listByUser(actor.id);
    return addresses.map(serializeAddress);
  }
}


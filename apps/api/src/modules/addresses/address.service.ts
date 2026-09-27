/** Aplica autorização de morador, normaliza campos e converte endereços Prisma para a resposta pública. */
import type { Actor } from '../../auth/actor.js';
import { AppError } from '../../errors/appError.js';
import type { Address } from '../../generated/prisma/client.js';
import type { AddressRepository } from './address.repository.js';
import type { CreateAddressInput } from './address.schemas.js';

// Impede coletores e operadores de manipularem endereços pelo fluxo destinado ao morador.
function ensureResident(actor: Actor): void {
  // Endereço de coleta pertence ao domínio do morador neste MVP.
  if (actor.role !== 'MORADOR') {
    throw new AppError({
      statusCode: 403,
      code: 'PAPEL_NAO_AUTORIZADO',
      message: 'Apenas moradores podem gerenciar endereços.',
    });
  }
}

// Traduz nomes internos e Decimal do Prisma para um JSON simples em português.
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

// Coordena autorização, repositório e serialização sem conhecer detalhes HTTP.
export class AddressService {
  // Recebe somente o contrato de persistência necessário ao serviço.
  constructor(private readonly repository: AddressRepository) {}

  // Confirma o papel, persiste e serializa o endereço recém-criado.
  async create(actor: Actor, input: CreateAddressInput) {
    ensureResident(actor);
    const address = await this.repository.create(actor.id, input);
    return serializeAddress(address);
  }

  // Confirma o papel e serializa todos os endereços pertencentes ao ator.
  async list(actor: Actor) {
    ensureResident(actor);
    const addresses = await this.repository.listByUser(actor.id);
    return addresses.map(serializeAddress);
  }
}

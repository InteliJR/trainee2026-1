/**
 * Persistência de usuários usada pelo cadastro, login, sessão e middleware JWT.
 * Todas as consultas selecionam apenas os campos exigidos pelo caso de uso atual.
 */
import type { PrismaClient, User } from '../../generated/prisma/client.js';
import type { UserRole } from '../../generated/prisma/enums.js';
import type { Actor } from '../../auth/actor.js';
import type { AuthenticatedActorRepository } from '../../auth/authentication.js';

// Representa os dados necessários para verificar senha durante o login.
export type AuthenticationUser = Pick<
  User,
  'id' | 'name' | 'email' | 'phone' | 'passwordHash' | 'role' | 'createdAt' | 'updatedAt'
>;
// Representa a resposta segura de cadastro e sessão, sem o hash da senha.
export type PublicUser = Pick<User, 'id' | 'name' | 'email' | 'phone' | 'role' | 'createdAt' | 'updatedAt'>;

// Define os dados normalizados que podem ser persistidos em um cadastro público.
export interface CreateUserInput {
  name: string;
  email: string;
  phone: string | null;
  passwordHash: string;
  role: Extract<UserRole, 'MORADOR' | 'COLETOR'>;
}

// Abstrai o Prisma para manter regras de senha, sessão e erros dentro do serviço.
export interface AuthRepository extends AuthenticatedActorRepository {
  // Procura credenciais pelo e-mail já normalizado.
  findByEmail(email: string): Promise<AuthenticationUser | null>;
  // Procura dados seguros usados na resposta da sessão.
  findPublicById(id: string): Promise<PublicUser | null>;
  // Cria usuário e perfil de coletor de forma atômica quando necessário.
  create(input: CreateUserInput): Promise<PublicUser>;
}

// Sinaliza conflito de unicidade sem expor detalhes do driver no serviço.
export class AuthRepositoryConflictError extends Error {
  // Mantém um nome estável para logs e verificações de instância.
  constructor() {
    super('Já existe usuário com e-mail ou telefone informado.');
    this.name = 'AuthRepositoryConflictError';
  }
}

// Implementa as consultas e a transação de cadastro no PostgreSQL.
export class PrismaAuthRepository implements AuthRepository {
  // Guarda o Prisma compartilhado pelo bootstrap.
  constructor(private readonly database: PrismaClient) {}

  // Busca os campos mínimos usados para validar credenciais.
  findByEmail(email: string): Promise<AuthenticationUser | null> {
    return this.database.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        passwordHash: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  // Busca o contrato seguro devolvido por cadastro, login e sessão.
  findPublicById(id: string): Promise<PublicUser | null> {
    return this.database.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  // Confirma a identidade atual usada pelo middleware sem selecionar credenciais.
  findActorById(id: string): Promise<Actor | null> {
    return this.database.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });
  }

  // Cria usuário e perfil especializado dentro da mesma transação.
  async create(input: CreateUserInput): Promise<PublicUser> {
    // Captura somente conflitos conhecidos e preserva outras falhas para o handler central.
    try {
      // Garante rollback completo caso a criação do perfil de coletor falhe.
      return await this.database.$transaction(async (transaction) => {
        // Persiste o usuário com o hash já calculado pelo serviço.
        const user = await transaction.user.create({
          data: {
            name: input.name,
            email: input.email,
            phone: input.phone,
            passwordHash: input.passwordHash,
            role: input.role,
          },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        // Coletores precisam do perfil que controla disponibilidade e vínculo EcoRota.
        if (input.role === 'COLETOR') {
          // O perfil começa indisponível até o próprio coletor configurar seu turno.
          await transaction.collectorProfile.create({
            data: { userId: user.id, available: false },
          });
        }
        // Devolve somente os campos públicos selecionados na criação.
        return user;
      });
    } catch (error) {
      // Prisma identifica violações de campos únicos pelo código P2002.
      if (isPrismaUniqueConstraintError(error)) throw new AuthRepositoryConflictError();
      // Falhas de infraestrutura ou programação continuam com sua causa original.
      throw error;
    }
  }
}

// Reconhece o formato mínimo de um erro Prisma sem acoplar o domínio à classe gerada.
function isPrismaUniqueConstraintError(error: unknown): boolean {
  // Exige objeto não nulo antes de tentar acessar a propriedade code.
  if (typeof error !== 'object' || error === null) return false;
  // Converte somente o campo conhecido e compara o código oficial de unicidade.
  return 'code' in error && error.code === 'P2002';
}

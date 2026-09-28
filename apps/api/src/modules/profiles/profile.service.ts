import type { Actor } from '../../auth/actor.js';
import { AppError } from '../../errors/appError.js';
import type { ListedProfile, ProfileRepository } from './profile.repository.js';

export class ProfileService {
  constructor(private readonly repository: ProfileRepository) {}

  async own(actor: Actor) {
    if (actor.role !== 'MORADOR' && actor.role !== 'COLETOR') {
      throw new AppError({ statusCode: 403, code: 'PAPEL_NAO_AUTORIZADO', message: 'Perfil indisponível para esta conta.' });
    }
    const profile = await this.repository.get(actor.id);
    if (!profile) throw new AppError({ statusCode: 404, code: 'PERFIL_NAO_ENCONTRADO', message: 'Perfil não encontrado.' });
    return this.serialize(profile);
  }

  private serialize(profile: ListedProfile) {
    return {
      id: profile.id, nome: profile.name, papel: profile.role,
      cadastradoEm: profile.createdAt.toISOString(), coletasConcluidas: profile.completedCollections,
      ...(profile.role === 'COLETOR' ? { disponivel: profile.available, turno: profile.shift } : {}),
    };
  }

  async list(actor: Actor, query: { papel: ListedProfile['role']; pagina?: string }) {
    if (actor.role !== 'OPERADOR') {
      throw new AppError({ statusCode: 403, code: 'PAPEL_NAO_AUTORIZADO', message: 'Apenas operadores podem consultar perfis.' });
    }
    const page = Number(query.pagina ?? 1);
    if (!Number.isInteger(page) || page < 1) {
      throw new AppError({ statusCode: 400, code: 'PAGINACAO_INVALIDA', message: 'Página inválida.' });
    }
    const limit = 20;
    const { profiles, total } = await this.repository.list(query.papel, page, limit);
    return {
      dados: profiles.map((profile) => this.serialize(profile)),
      paginacao: { pagina: page, limite: limit, total, totalPaginas: Math.ceil(total / limit) },
    };
  }
}

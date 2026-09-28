/**
 * Regras de cadastro, login e sessão: normaliza dados, protege senhas e nunca expõe passwordHash.
 * O serviço não manipula cookies nem JWT, mantendo transporte separado da regra de identidade.
 */
import { compare, hash } from 'bcryptjs';
import type { Actor } from '../../auth/actor.js';
import { AppError } from '../../errors/appError.js';
import {
  AuthRepositoryConflictError,
  type AuthRepository,
  type PublicUser,
} from './auth.repository.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';

// Usa custo adequado ao MVP sem armazenar configuração sensível no cliente.
const PASSWORD_HASH_ROUNDS = 12;
// Mantém o tempo do login semelhante quando o e-mail não existe, reduzindo enumeração por duração.
const DUMMY_PASSWORD_HASH = '$2b$12$csFfOl93L6StiYK2pMDUge9tjeImUXViR5pwk5pDqnTN25fotH1nK';

// Orquestra o repositório e o bcrypt para entregar somente usuários públicos.
export class AuthService {
  // Recebe o repositório testável e permite custo menor somente em testes unitários controlados.
  constructor(
    private readonly repository: AuthRepository,
    private readonly hashRounds: number = PASSWORD_HASH_ROUNDS,
  ) {}

  // Cria morador ou coletor depois de normalizar e proteger a senha.
  async register(input: RegisterInput) {
    // Normaliza o nome sem alterar letras ou acentos escolhidos pela pessoa.
    const name = input.nome.trim().replace(/\s+/g, ' ');
    // E-mails são tratados sem distinção entre maiúsculas e minúsculas no login.
    const email = input.email.trim().toLowerCase();
    // Converte telefone vazio em null para respeitar a unicidade opcional do banco.
    const phone = input.telefone?.trim() || null;
    // Bcrypt considera no máximo 72 bytes; a guarda evita duas senhas diferentes produzirem o mesmo hash efetivo.
    if (Buffer.byteLength(input.senha, 'utf8') > 72) {
      throw new AppError({
        statusCode: 400,
        code: 'SENHA_MUITO_LONGA',
        message: 'A senha deve possuir no máximo 72 bytes.',
      });
    }

    // Evita custo de hash quando o e-mail já está cadastrado; cadastro pode informar conflito explicitamente.
    if (await this.repository.findByEmail(email)) {
      throw this.userConflictError();
    }
    // Calcula um hash com salt aleatório; a senha original nunca chega ao repositório.
    const passwordHash = await hash(input.senha, this.hashRounds);

    // Converte corrida de unicidade entre duas requisições simultâneas no mesmo erro público.
    try {
      // Persiste usuário e eventual perfil de coletor dentro da transação do repositório.
      const user = await this.repository.create({
        name,
        email,
        phone,
        passwordHash,
        role: input.papel,
      });
      // Serializa datas e nomes em português sem incluir credenciais.
      return this.serializeUser(user);
    } catch (error) {
      // Oculta se o conflito ocorreu em e-mail ou telefone para manter um contrato simples.
      if (error instanceof AuthRepositoryConflictError) throw this.userConflictError();
      // Erros inesperados seguem para o handler central e para os logs do servidor.
      throw error;
    }
  }

  // Valida e-mail e senha com mensagem idêntica para usuário ausente ou senha incorreta.
  async login(input: LoginInput) {
    // Aplica a mesma normalização usada no cadastro.
    const email = input.email.trim().toLowerCase();
    // Busca as credenciais sem carregar relações ou dados desnecessários.
    const user = await this.repository.findByEmail(email);
    // Compara contra hash fictício quando o usuário não existe para reduzir diferença temporal observável.
    const passwordMatches = await compare(input.senha, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
    // Usa o mesmo código e mensagem nos dois casos para evitar enumeração de contas.
    if (!user || !passwordMatches) {
      throw new AppError({
        statusCode: 401,
        code: 'CREDENCIAIS_INVALIDAS',
        message: 'E-mail ou senha inválidos.',
      });
    }
    // Devolve o ator que será colocado no JWT e o usuário seguro mostrado na resposta.
    return {
      actor: { id: user.id, role: user.role } satisfies Actor,
      user: this.serializeUser(user),
    };
  }

  // Recarrega o usuário da sessão para nunca devolver dados incorporados ao JWT.
  async getSession(actor: Actor) {
    // Consulta campos públicos atuais pelo UUID já confirmado pelo middleware.
    const user = await this.repository.findPublicById(actor.id);
    // Uma exclusão entre middleware e serviço invalida a sessão de maneira segura.
    if (!user) {
      throw new AppError({
        statusCode: 401,
        code: 'SESSAO_DESATUALIZADA',
        message: 'O usuário da sessão não está mais disponível.',
      });
    }
    // Mantém o mesmo contrato de usuário usado por cadastro e login.
    return this.serializeUser(user);
  }

  // Constrói o erro reutilizado por verificação prévia e conflito transacional.
  private userConflictError(): AppError {
    // Retorna 409 porque os dados são válidos, mas violam unicidade da entidade.
    return new AppError({
      statusCode: 409,
      code: 'USUARIO_JA_CADASTRADO',
      message: 'Já existe uma conta com o e-mail ou telefone informado.',
    });
  }

  // Traduz o registro seguro para o vocabulário público em português.
  private serializeUser(user: PublicUser) {
    // Nenhum spread é usado para impedir inclusão acidental de passwordHash em mudanças futuras.
    return {
      id: user.id,
      nome: user.name,
      email: user.email,
      telefone: user.phone,
      papel: user.role,
      criadoEm: user.createdAt.toISOString(),
      atualizadoEm: user.updatedAt.toISOString(),
    };
  }
}

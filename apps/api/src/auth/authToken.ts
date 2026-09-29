/**
 * Emite e valida o JWT de sessão compartilhado pelas rotas Fastify e pelo handshake Socket.IO.
 * O token contém somente o UUID e o papel; dados pessoais e credenciais nunca entram no payload.
 */
import { jwtVerify, SignJWT } from 'jose';
import type { NodeEnvironment } from '../config/validateEnv.js';
import { UserRole } from '../generated/prisma/enums.js';
import { AppError } from '../errors/appError.js';
import type { Actor } from './actor.js';

// Nome do cookie de sessão sem papel, mantido para sessões antigas e clientes que não informam a área.
export const SESSION_COOKIE_NAME = 'ecorota_sessao';
// Cabeçalho com o papel da área que faz a requisição (morador, coletor ou operador).
export const SESSION_ROLE_HEADER = 'x-ecorota-papel';
// Ordem usada quando o cliente não informa a área e só existe cookie por papel.
const ROLE_COOKIE_ORDER: UserRole[] = [UserRole.MORADOR, UserRole.COLETOR, UserRole.OPERADOR];

// Um cookie por papel permite manter morador, coletor e operador logados ao mesmo tempo no mesmo navegador.
export function sessionCookieNameFor(role: UserRole): string {
  return `${SESSION_COOKIE_NAME}_${role.toLowerCase()}`;
}

// Lê o papel informado pela área; valores desconhecidos são ignorados, nunca confiados.
export function parseSessionRole(value: unknown): UserRole | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') return null;
  const role = raw.trim().toUpperCase();
  return (ROLE_COOKIE_ORDER as string[]).includes(role) ? (role as UserRole) : null;
}

// Escolhe qual cookie ler. O papel só decide o cookie: o token continua passando pela verificação completa.
export function pickSessionToken(
  cookies: Record<string, string | undefined>,
  requestedRole: UserRole | null,
): string | undefined {
  if (requestedRole) return cookies[sessionCookieNameFor(requestedRole)] ?? cookies[SESSION_COOKIE_NAME];
  return cookies[SESSION_COOKIE_NAME]
    ?? ROLE_COOKIE_ORDER.map((role) => cookies[sessionCookieNameFor(role)]).find(Boolean);
}
// Mantém a sessão curta o bastante para limitar o impacto de um token eventualmente comprometido.
export const SESSION_DURATION_SECONDS = 8 * 60 * 60;
// Identifica de forma estável quem emitiu os tokens aceitos por esta API.
const TOKEN_ISSUER = 'ecorota-api';
// Impede que um token válido para outro consumidor seja aceito pela aplicação web.
const TOKEN_AUDIENCE = 'ecorota-web';

// Define somente as opções de cookie que não dependem da resposta HTTP atual.
export function createSessionCookieOptions(nodeEnv: NodeEnvironment) {
  // Produção exige HTTPS, enquanto desenvolvimento local precisa aceitar HTTP.
  const secure = nodeEnv === 'production';
  // Devolve um objeto reutilizado por login, logout e testes de contrato.
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_DURATION_SECONDS,
  };
}

// Encapsula os detalhes criptográficos para que nenhuma rota manipule o segredo diretamente.
export class AuthTokenService {
  // Guarda o segredo já convertido para bytes, formato esperado pelo JOSE.
  private readonly secret: Uint8Array;

  // Recebe somente um segredo já validado pela configuração da aplicação.
  constructor(secret: string) {
    // Uma segunda guarda impede uso inseguro quando a classe é instanciada fora do bootstrap normal.
    if (secret.length < 32) {
      throw new Error('JWT_SECRET deve possuir pelo menos 32 caracteres.');
    }
    // Converte UTF-8 uma única vez em vez de repetir o trabalho a cada requisição.
    this.secret = new TextEncoder().encode(secret);
  }

  // Cria um token HS256 com duração, emissor e público explicitamente delimitados.
  issue(actor: Actor): Promise<string> {
    // Usa papel como única claim privada necessária para detectar sessão desatualizada.
    return new SignJWT({ papel: actor.role })
      // Restringe o algoritmo aceito à família simétrica selecionada pelo projeto.
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      // Usa sub para o UUID conforme a convenção padrão do JWT.
      .setSubject(actor.id)
      // Marca esta API como emissora do token.
      .setIssuer(TOKEN_ISSUER)
      // Marca o frontend EcoRota como destinatário esperado.
      .setAudience(TOKEN_AUDIENCE)
      // Registra o instante de emissão para auditoria e validação temporal.
      .setIssuedAt()
      // Limita a sessão ao período definido em segundos.
      .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
      // Assina o conteúdo com o segredo mantido exclusivamente no backend.
      .sign(this.secret);
  }

  // Valida assinatura e claims antes de converter o payload em identidade mínima.
  async verify(token: string): Promise<Actor> {
    // Transforma qualquer falha criptográfica ou estrutural no mesmo erro público de sessão.
    try {
      // Exige algoritmo, emissor e público corretos além da expiração validada pelo JOSE.
      const { payload } = await jwtVerify(token, this.secret, {
        algorithms: ['HS256'],
        issuer: TOKEN_ISSUER,
        audience: TOKEN_AUDIENCE,
      });
      // Extrai somente as duas claims que formam o ator da aplicação.
      const userId = payload.sub;
      const role = payload.papel;
      // Rejeita tokens válidos criptograficamente, porém sem UUID ou com papel desconhecido.
      if (typeof userId !== 'string' || !Object.values(UserRole).includes(role as UserRole)) {
        throw new Error('Payload de sessão inválido.');
      }
      // Devolve o ator tipado; o middleware ainda confirmará existência e papel no banco.
      return { id: userId, role: role as UserRole };
    } catch {
      // Não diferencia expiração, assinatura ou formato para não entregar pistas ao cliente.
      throw new AppError({
        statusCode: 401,
        code: 'SESSAO_INVALIDA',
        message: 'A sessão é inválida ou expirou. Entre novamente.',
      });
    }
  }
}

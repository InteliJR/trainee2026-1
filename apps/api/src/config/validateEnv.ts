/**
 * Converte process.env em configuração tipada e impede a subida da API quando algum valor é inválido.
 * Os demais módulos recebem esta configuração em vez de interpretar strings de ambiente por conta própria.
 */
export type NodeEnvironment = 'development' | 'test' | 'production';

// Forma final consumida pelo servidor depois que strings opcionais foram normalizadas.
export interface AppEnvironment {
  nodeEnv: NodeEnvironment;
  port: number;
  ecorotaUrl: string;
  ecorotaKey: string;
  // Origem exata do frontend autorizada a abrir conexões Socket.IO pelo navegador.
  webOrigin: string;
  databaseUrl: string;
  directDatabaseUrl: string;
  jwtSecret: string;
}

// Lista fechada usada para rejeitar nomes de ambiente digitados incorretamente.
const NODE_ENVIRONMENTS: NodeEnvironment[] = ['development', 'test', 'production'];

// Aceita somente os dois esquemas de URI reconhecidos pelo driver PostgreSQL.
function isPostgresUrl(value: string): boolean {
  return value.startsWith('postgresql://') || value.startsWith('postgres://');
}

// Faz parse seguro e restringe URLs externas aos protocolos HTTP e HTTPS.
function isHttpUrl(value: string): boolean {
  // URL pode lançar exceção para texto malformado; o validador converte isso em false.
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// Acumula todos os problemas de configuração e os apresenta juntos antes de criar qualquer conexão.
export function validateEnvironment(values: NodeJS.ProcessEnv): AppEnvironment {
  const errors: string[] = [];

  const rawNodeEnv = values.NODE_ENV ?? 'development';
  const nodeEnv = NODE_ENVIRONMENTS.includes(rawNodeEnv as NodeEnvironment)
    ? (rawNodeEnv as NodeEnvironment)
    : 'development';

  // Registra ambiente desconhecido sem prosseguir silenciosamente com o fallback.
  if (!NODE_ENVIRONMENTS.includes(rawNodeEnv as NodeEnvironment)) {
    errors.push('NODE_ENV deve ser development, test ou production.');
  }

  const port = Number(values.PORT ?? 3000);
  // Garante que o sistema operacional aceite a porta configurada.
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    errors.push('PORT deve ser um número inteiro entre 1 e 65535.');
  }

  const databaseUrl = values.DATABASE_URL?.trim() ?? '';
  // Exige a conexão de runtime e valida seu protocolo quando presente.
  if (!databaseUrl) {
    errors.push('DATABASE_URL é obrigatória.');
  } else if (!isPostgresUrl(databaseUrl)) {
    // Valor presente ainda precisa usar o protocolo aceito pelo adapter PostgreSQL.
    errors.push('DATABASE_URL deve ser uma URI PostgreSQL iniciada por postgresql:// ou postgres://.');
  }

  const directDatabaseUrl = values.DIRECT_URL?.trim() ?? '';
  // DIRECT_URL é opcional na API, mas precisa ser PostgreSQL quando usada pelo Prisma CLI.
  if (directDatabaseUrl && !isPostgresUrl(directDatabaseUrl)) {
    errors.push('DIRECT_URL deve ser uma URI PostgreSQL iniciada por postgresql:// ou postgres://.');
  }

  const ecorotaUrl = values.ECOROTA_URL?.trim() ?? '';
  const ecorotaKey = values.ECOROTA_KEY?.trim() ?? '';
  // Usa o endereço padrão do Vite quando WEB_ORIGIN não foi definido no ambiente local.
  const webOrigin = values.WEB_ORIGIN?.trim() || 'http://localhost:5173';

  // Valida a URL externa antes de qualquer cliente tentar usá-la.
  if (ecorotaUrl && !isHttpUrl(ecorotaUrl)) {
    errors.push('ECOROTA_URL deve ser uma URL HTTP ou HTTPS válida.');
  }

  // Impede integração parcialmente configurada, que produziria erros pouco claros.
  if (Boolean(ecorotaUrl) !== Boolean(ecorotaKey)) {
    errors.push('ECOROTA_URL e ECOROTA_KEY devem ser configuradas em conjunto.');
  }

  // Impede que uma origem malformada seja repassada à configuração CORS do Socket.IO.
  if (!isHttpUrl(webOrigin)) {
    // Explica qual variável precisa ser corrigida antes de iniciar a API.
    errors.push('WEB_ORIGIN deve ser uma URL HTTP ou HTTPS válida.');
  }

  const jwtSecret = values.JWT_SECRET?.trim() ?? '';
  // A autenticação real depende do segredo em qualquer ambiente que execute a API.
  if (!jwtSecret) {
    errors.push('JWT_SECRET é obrigatória.');
  // Rejeita segredos curtos que não oferecem entropia adequada para HS256.
  } else if (jwtSecret.length < 32) {
    errors.push('JWT_SECRET deve possuir pelo menos 32 caracteres.');
  }

  // Apresenta todos os erros encontrados em uma única exceção de inicialização.
  if (errors.length > 0) {
    throw new Error(`Variáveis de ambiente inválidas:\n- ${errors.join('\n- ')}`);
  }

  return Object.freeze({
    nodeEnv,
    port,
    ecorotaUrl,
    ecorotaKey,
    // Disponibiliza ao bootstrap a origem já normalizada e validada.
    webOrigin,
    databaseUrl,
    directDatabaseUrl,
    jwtSecret,
  });
}

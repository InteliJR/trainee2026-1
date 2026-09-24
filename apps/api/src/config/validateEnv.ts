export type NodeEnvironment = 'development' | 'test' | 'production';

export interface AppEnvironment {
  nodeEnv: NodeEnvironment;
  port: number;
  ecorotaUrl: string;
  ecorotaKey: string;
  databaseUrl: string;
  directDatabaseUrl: string;
  jwtSecret: string;
}

const NODE_ENVIRONMENTS: NodeEnvironment[] = ['development', 'test', 'production'];

function isPostgresUrl(value: string): boolean {
  return value.startsWith('postgresql://') || value.startsWith('postgres://');
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateEnvironment(values: NodeJS.ProcessEnv): AppEnvironment {
  const errors: string[] = [];

  const rawNodeEnv = values.NODE_ENV ?? 'development';
  const nodeEnv = NODE_ENVIRONMENTS.includes(rawNodeEnv as NodeEnvironment)
    ? (rawNodeEnv as NodeEnvironment)
    : 'development';

  if (!NODE_ENVIRONMENTS.includes(rawNodeEnv as NodeEnvironment)) {
    errors.push('NODE_ENV deve ser development, test ou production.');
  }

  const port = Number(values.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    errors.push('PORT deve ser um número inteiro entre 1 e 65535.');
  }

  const databaseUrl = values.DATABASE_URL?.trim() ?? '';
  if (!databaseUrl) {
    errors.push('DATABASE_URL é obrigatória.');
  } else if (!isPostgresUrl(databaseUrl)) {
    errors.push('DATABASE_URL deve ser uma URI PostgreSQL iniciada por postgresql:// ou postgres://.');
  }

  const directDatabaseUrl = values.DIRECT_URL?.trim() ?? '';
  if (directDatabaseUrl && !isPostgresUrl(directDatabaseUrl)) {
    errors.push('DIRECT_URL deve ser uma URI PostgreSQL iniciada por postgresql:// ou postgres://.');
  }

  const ecorotaUrl = values.ECOROTA_URL?.trim() ?? '';
  const ecorotaKey = values.ECOROTA_KEY?.trim() ?? '';

  if (ecorotaUrl && !isHttpUrl(ecorotaUrl)) {
    errors.push('ECOROTA_URL deve ser uma URL HTTP ou HTTPS válida.');
  }

  if (Boolean(ecorotaUrl) !== Boolean(ecorotaKey)) {
    errors.push('ECOROTA_URL e ECOROTA_KEY devem ser configuradas em conjunto.');
  }

  const jwtSecret = values.JWT_SECRET?.trim() ?? '';
  if (jwtSecret && jwtSecret.length < 32) {
    errors.push('JWT_SECRET deve possuir pelo menos 32 caracteres.');
  }

  if (errors.length > 0) {
    throw new Error(`Variáveis de ambiente inválidas:\n- ${errors.join('\n- ')}`);
  }

  return Object.freeze({
    nodeEnv,
    port,
    ecorotaUrl,
    ecorotaKey,
    databaseUrl,
    directDatabaseUrl,
    jwtSecret,
  });
}

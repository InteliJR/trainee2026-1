import 'dotenv/config';

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  ecorotaUrl: process.env.ECOROTA_URL ?? '',
  ecorotaKey: process.env.ECOROTA_KEY ?? '',
  databaseUrl: process.env.DATABASE_URL ?? '',
  jwtSecret: process.env.JWT_SECRET ?? '',
};
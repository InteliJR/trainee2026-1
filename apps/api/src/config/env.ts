/** Carrega o .env da raiz do monorepo e exporta somente valores que passaram pela validação. */
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { validateEnvironment } from './validateEnv.js';

// Resolve a localização absoluta do .env independentemente do diretório em que o comando foi executado.
const rootEnvPath = fileURLToPath(new URL('../../../../.env', import.meta.url));
config({ path: rootEnvPath });

// Disponibiliza uma configuração imutável e validada para o restante da API.
export const env = validateEnvironment(process.env);

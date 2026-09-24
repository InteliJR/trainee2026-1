import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { validateEnvironment } from './validateEnv.js';

const rootEnvPath = fileURLToPath(new URL('../../../../.env', import.meta.url));
config({ path: rootEnvPath });

export const env = validateEnvironment(process.env);
